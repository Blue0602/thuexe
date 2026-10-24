/*
 * Thuê VF3 Click — lịch thuê xe đọc từ Cloudflare D1 qua Worker công khai.
 * Chỉ xem lịch và kiểm tra trước khi SOẠN tin Zalo; chưa đặt/giữ xe hoặc thu tiền.
 * Dùng chung cho /vf3/, /vf8/, /kia-k5/.
 */
(() => {
  "use strict";

  const form = document.querySelector('#bookingForm[data-rental-car]');
  if (!form) return;

  const carId = form.dataset.rentalCar;
  const inputIds = {
    vf3: ["pickup", "dropoff"],
    vf8: ["startDate", "endDate"],
    "kia-k5": ["pickup", "dropoff"]
  };
  if (!Object.hasOwn(inputIds, carId)) return;

  const [pickupId, dropoffId] = inputIds[carId];
  const pickup = document.getElementById(pickupId);
  const dropoff = document.getElementById(dropoffId);
  const info = document.getElementById("rentalCalendarFeedback");
  const submitButton = form.querySelector('button[type="submit"]');
  if (!pickup || !dropoff || !info || !submitButton) return;

  // Endpoint dạng: /api/occupied?vehicle=vf8&from=YYYY-MM-DD&to=YYYY-MM-DD.
  const API_BASE = "https://thuevf3click-api.hgpure2003.workers.dev";
  const MS_PER_DAY = 86400000;
  const VN_DATE = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
  });

  const state = {
    busy: new Set(),
    ready: false,
    checking: false,
    replay: false,
    startPicker: null,
    endPicker: null
  };

  function vietnamDay(timestamp) {
    const parts = Object.fromEntries(
      VN_DATE.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function dayNumber(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function addDays(ymd, amount) {
    return new Date(dayNumber(ymd) + amount * MS_PER_DAY).toISOString().slice(0, 10);
  }

  function formatCalendarDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseUTC(value) {
    if (typeof value !== "string" || !value.trim()) return NaN;
    let timestamp = value.trim().replace(" ", "T");
    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(timestamp)) timestamp += "Z";
    return Date.parse(timestamp);
  }

  function note(text, type = "info") {
    info.textContent = text;
    info.dataset.state = type;
  }

  function setReady(value) {
    state.ready = value;
    submitButton.disabled = !value || state.checking;
  }

  function dateWindow() {
    const today = vietnamDay(Date.now());
    return { today, limit: addDays(today, 89) };
  }

  async function getBusyDays() {
    const { today, limit } = dateWindow();
    // API lọc theo mốc ngày UTC. Chồng hai cửa sổ ở giữa để bao phủ
    // toàn bộ 90 ngày giờ VN, kể cả khoảng vắt qua 00:00 UTC.
    const requests = [
      [addDays(today, -1), addDays(today, 45)],
      [addDays(today, 44), addDays(today, 91)]
    ];

    const all = await Promise.all(requests.map(async ([from, to]) => {
      const url = new URL("/api/occupied", API_BASE);
      url.searchParams.set("vehicle", carId);
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);

      const response = await fetch(url.toString(), {
        method: "GET", cache: "no-store", headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`API trả lỗi HTTP ${response.status}`);

      const data = await response.json();
      if (data?.success !== true || !Array.isArray(data.intervals)) {
        throw new Error("API không trả về intervals hợp lệ");
      }
      if (data.vehicle_active === false) {
        throw new Error("Xe hiện không nhận đặt lịch");
      }
      return data.intervals;
    }));

    const result = new Set();
    for (const interval of all.flat()) {
      const start = parseUTC(interval.start_utc);
      const end = parseUTC(interval.end_utc);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        throw new Error("Khoảng thời gian bận từ API không hợp lệ");
      }
      const first = vietnamDay(start);
      // Khoảng UTC là [start,end): mốc kết thúc không được tính trùng.
      const last = vietnamDay(end - 1);
      for (let time = dayNumber(first); time <= dayNumber(last); time += MS_PER_DAY) {
        const day = new Date(time).toISOString().slice(0, 10);
        if (day >= today && day <= limit) result.add(day);
      }
    }
    return result;
  }

  function validateSelection(showMessage = true) {
    if (!state.ready) {
      if (showMessage) note("Lịch chưa sẵn sàng. Không thể kiểm tra ngày thuê.", "error");
      return false;
    }

    const from = pickup.value;
    const to = dropoff.value;
    if (!from || !to) {
      if (showMessage) note("Vui lòng chọn đủ ngày nhận và ngày trả xe.");
      return false;
    }

    const { today, limit } = dateWindow();
    if (from < today || to > limit || from > to) {
      if (showMessage) note("Khoảng ngày không hợp lệ hoặc ngoài phạm vi 90 ngày.", "error");
      return false;
    }

    const start = dayNumber(from);
    const end = dayNumber(to);
    for (let d = start; d <= end; d += MS_PER_DAY) {
      const day = new Date(d).toISOString().slice(0, 10);
      if (state.busy.has(day)) {
        if (showMessage) note(`Có lịch thuê/khóa xe vào ngày ${day}. Vui lòng chọn khoảng khác.`, "error");
        return false;
      }
    }

    // Tính số ngày thuê dự kiến: nhận/trả cùng ngày = 1 ngày;
    // chênh lệch ngày tính theo ngày, giá và số giờ sẽ được xác nhận sau.
    const totalDays = Math.max(1, Math.round((end - start) / MS_PER_DAY));
    if (showMessage) note(
      `Dự kiến ${totalDays} ngày thuê. Hiện chưa thấy lịch bận; ` +
      "nhân viên sẽ xác nhận lần cuối sau khi nhận tin nhắn.",
      "success"
    );
    return true;
  }

  function decorateDay(_dates, _dateStr, _instance, dayElement) {
    const day = formatCalendarDate(dayElement.dateObj);
    if (state.busy.has(day)) {
      dayElement.classList.add("rental-busy-day");
      dayElement.title = "Xe có lịch thuê hoặc đang khóa lịch";
    }
  }

  function updatePickerRestrictions() {
    const { today, limit } = dateWindow();
    const disabled = [date => state.busy.has(formatCalendarDate(date))];
    if (state.startPicker) {
      state.startPicker.set("minDate", today);
      state.startPicker.set("maxDate", limit);
      state.startPicker.set("disable", disabled);
      state.startPicker.redraw();
    }
    if (state.endPicker) {
      const endMin = pickup.value && pickup.value >= today ? pickup.value : today;
      state.endPicker.set("minDate", endMin);
      state.endPicker.set("maxDate", limit);
      state.endPicker.set("disable", disabled);
      state.endPicker.redraw();
    }
  }

  async function initialize() {
    if (typeof window.flatpickr !== "function") {
      note("Không tải được thư viện Flatpickr. Hãy kiểm tra mạng và tải lại trang.", "error");
      return;
    }

    try {
      state.busy = await getBusyDays();
      const { today, limit } = dateWindow();
      const disabled = [date => state.busy.has(formatCalendarDate(date))];
      const options = {
        locale: window.flatpickr.l10ns?.vn || "default",
        dateFormat: "Y-m-d",
        minDate: today,
        maxDate: limit,
        disable: disabled,
        disableMobile: true,
        allowInput: false,
        onDayCreate: decorateDay
      };

      state.endPicker = window.flatpickr(dropoff, {
        ...options,
        onChange: () => validateSelection()
      });

      state.startPicker = window.flatpickr(pickup, {
        ...options,
        onChange: (_dates, startDate) => {
          state.endPicker.set("minDate", startDate || dateWindow().today);
          if (dropoff.value && dropoff.value < startDate) state.endPicker.clear();
          if (startDate && !dropoff.value) {
            note("Đã chọn ngày nhận xe. Hãy chọn ngày trả xe.");
            state.endPicker.open();
          } else {
            validateSelection();
          }
        }
      });

      setReady(true);
      note("Lịch đã cập nhật từ D1. Ngày gạch đỏ là ngày bận/khóa; hãy chọn khoảng còn trống.");
    } catch (error) {
      console.error("RENTAL_CALENDAR_INIT_ERROR", error);
      setReady(false);
      note("Không tải được lịch xe. Tạm khóa form để tránh báo nhầm lịch trống. Hãy liên hệ Zalo/điện thoại.", "error");
    }
  }

  // Capture handler: chặn sự kiện submit trước handler soạn tin Zalo có sẵn.
  // Khi đã xác minh D1, phát lại submit một lần để handler V5 chạy bình thường.
  form.addEventListener("submit", async event => {
    if (state.replay) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (state.checking || !validateSelection()) return;

    state.checking = true;
    submitButton.disabled = true;
    note("Đang kiểm tra lại D1 trước khi soạn yêu cầu thuê xe…");
    try {
      state.busy = await getBusyDays();
      updatePickerRestrictions();
      if (!validateSelection()) return;

      state.replay = true;
      try {
        form.requestSubmit();
      } finally {
        state.replay = false;
      }
    } catch (error) {
      console.error("RENTAL_AVAILABILITY_ERROR", error);
      setReady(false);
      note("Kiểm tra D1 thất bại. Chưa thể xác nhận khoảng ngày thuê. Vui lòng liên hệ Zalo để được hỗ trợ.", "error");
    } finally {
      state.checking = false;
      submitButton.disabled = !state.ready;
    }
  }, true);

  setReady(false);
  note("Đang kết nối lịch xe Cloudflare D1…");
  initialize();
})();
