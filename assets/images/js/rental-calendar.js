
(() => {
  "use strict";

  const form = document.querySelector(
    "#bookingForm[data-rental-car]"
  );

  if (!form) return;

  const car = form.dataset.rentalCar;

  const fieldsByCar = {
    vf3: ["pickup", "dropoff"],
    vf8: ["startDate", "endDate"],
    "kia-k5": ["pickup", "dropoff"]
  };

  const ids = fieldsByCar[car];

  if (!ids) return;

  const pickup = document.getElementById(ids[0]);
  const dropoff = document.getElementById(ids[1]);

  const feedback = document.getElementById(
    "rentalCalendarFeedback"
  );

  const submitButton = form.querySelector(
    'button[type="submit"]'
  );

  if (
    !pickup ||
    !dropoff ||
    !feedback ||
    !submitButton
  ) return;

  // API danh sach lich ban cua xe.
  // Khong dat API key hoac secret trong frontend.
  const API =
    "https://thuevf3click-api.hgpure2003.workers.dev";

  const DAY = 86400000;

  // Su dung gio Viet Nam, ke ca khi khach
  // mo website tu mot quoc gia khac.
  const vnParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  function vnDay(ms) {
    const parts = Object.fromEntries(
      vnParts
        .formatToParts(new Date(ms))
        .map(p => [p.type, p.value])
    );

    return (
      parts.year + "-" +
      parts.month + "-" +
      parts.day
    );
  }

  function toDayNumber(ymd) {
    const [year, month, day] = ymd
      .split("-")
      .map(Number);

    return Date.UTC(year, month - 1, day);
  }

  function addDays(ymd, amount) {
    return new Date(
      toDayNumber(ymd) + amount * DAY
    ).toISOString().slice(0, 10);
  }

  function selectedDay(date) {
    const y = date.getFullYear();

    const m = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const d = String(
      date.getDate()
    ).padStart(2, "0");

    return `${y}-${m}-${d}`;
  }

  // Chuyen timestamp UTC tu D1 sang millisecond.
  function parseUTC(value) {
    if (typeof value !== "string") return NaN;

    let normalized = value
      .trim()
      .replace(" ", "T");

    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(normalized)) {
      normalized += "Z";
    }

    return Date.parse(normalized);
  }

  function setFeedback(message, kind = "info") {
    feedback.textContent = message;
    feedback.dataset.state = kind;
  }

  const today = vnDay(Date.now());
  const latest = addDays(today, 89);

  let busyDays = new Set();

  let startPicker = null;
  let endPicker = null;

  let ready = false;
  let replayingSubmit = false;

  submitButton.disabled = true;

  setFeedback(
    "Đang tải lịch xe thực tế từ hệ thống…"
  );

  // =========================================
  // 1. LAY DU LIEU LICH TU API
  // =========================================

  async function fetchAvailability() {
    /*
      API hien tai su dung tham so from/to
      theo ngay UTC, trong khi khach xem
      ngay Viet Nam UTC+7.

      Chia lam hai khoang truy van de bao phu
      day du 90 ngay va tranh bo sot
      cac gio tai ranh gioi UTC.
    */

    const windows = [
      [
        addDays(today, -1),
        addDays(today, 45)
      ],
      [
        addDays(today, 44),
        addDays(today, 91)
      ]
    ];

    const responses = await Promise.all(
      windows.map(async ([from, to]) => {
        const url = new URL(
          "/api/occupied",
          API
        );

        url.searchParams.set("vehicle", car);
        url.searchParams.set("from", from);
        url.searchParams.set("to", to);

        const response = await fetch(
          url.toString(),
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json"
            }
          }
        );

        if (!response.ok) {
          throw new Error(
            `API HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (
          !data.success ||
          !Array.isArray(data.intervals)
        ) {
          throw new Error(
            "API không trả về danh sách intervals hợp lệ"
          );
        }

        return data.intervals;
      })
    );

    // =========================================
    // 2. CHUYEN UTC THANH NGAY BAN O VIET NAM
    // =========================================

    const nextBusy = new Set();

    for (const item of responses.flat()) {
      const start = parseUTC(item.start_utc);
      const end = parseUTC(item.end_utc);

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
      ) {
        throw new Error(
          "API chứa khoảng thời gian không hợp lệ"
        );
      }

      /*
        Khoang thoi gian [start, end).

        Neu lich ket thuc dung 00:00 gio VN,
        khong tinh nham sang ngay tiep theo.
      */

      const firstDay = vnDay(start);
      const lastDay = vnDay(end - 1);

      for (
        let t = toDayNumber(firstDay);
        t <= toDayNumber(lastDay);
        t += DAY
      ) {
        const day = new Date(t)
          .toISOString()
          .slice(0, 10);

        if (
          day >= today &&
          day <= latest
        ) {
          nextBusy.add(day);
        }
      }
    }

    return nextBusy;
  }

  // =========================================
  // 3. KIEM TRA KHOANG THUE
  // =========================================

  function checkSelection(showMessage = true) {
    const start = pickup.value;
    const end = dropoff.value;

    if (!ready) {
      if (showMessage) {
        setFeedback(
          "Chưa tải được lịch xe; vui lòng kiểm tra lại kết nối.",
          "error"
        );
      }

      return false;
    }

    if (!start || !end) {
      if (showMessage) {
        setFeedback(
          "Hãy chọn đủ ngày nhận và ngày trả xe."
        );
      }

      return false;
    }

    const a = toDayNumber(start);
    const b = toDayNumber(end);

    if (
      a > b ||
      start < today ||
      end > latest
    ) {
      if (showMessage) {
        setFeedback(
          "Ngày thuê không hợp lệ hoặc ngoài phạm vi 90 ngày.",
          "error"
        );
      }

      return false;
    }

    // Kiem tra TAT CA ngay nam trong chuyen thue.
    // Khong chi kiem tra ngay nhan va ngay tra.
    for (
      let t = a;
      t <= b;
      t += DAY
    ) {
      const day = new Date(t)
        .toISOString()
        .slice(0, 10);

      if (busyDays.has(day)) {
        if (showMessage) {
          setFeedback(
            `Khoảng bạn chọn có ngày ${day} đã bận hoặc bị khóa. ` +
            "Vui lòng chọn khoảng khác.",
            "error"
          );
        }

        return false;
      }
    }

    // Cung ngay = 1 ngay thue du kien.
    // Ngay khac nhau = so ngay chenhlech.
    const days = Math.max(
      1,
      Math.round((b - a) / DAY)
    );

    if (showMessage) {
      setFeedback(
        `${days} ngày thuê dự kiến · ` +
        "Lịch chưa có ghi nhận bận, " +
        "vui lòng gửi yêu cầu để nhân viên xác nhận.",
        "success"
      );
    }

    return true;
  }

  // =========================================
  // 4. TO MAU NGAY BAN
  // =========================================

  function dayDecorate(
    _dates,
    _dateStr,
    _instance,
    dayElem
  ) {
    const day = selectedDay(
      dayElem.dateObj
    );

    if (busyDays.has(day)) {
      dayElem.classList.add(
        "rental-busy-day"
      );

      dayElem.title =
        "Xe đã bận hoặc đang khóa lịch";
    }
  }

  function syncDisabled() {
    if (startPicker) {
      startPicker.set(
        "disable",
        [
          d => busyDays.has(selectedDay(d))
        ]
      );
    }

    if (endPicker) {
      endPicker.set(
        "disable",
        [
          d => busyDays.has(selectedDay(d))
        ]
      );
    }
  }

  // =========================================
  // 5. KIEM TRA LAI KHI KHACH SUBMIT
  // =========================================

  /*
    Form cu da co chuc nang soan tin nhan.

    Neu ngay thue khong hop le thi chan form cu.
    Neu hop le thi cho handler cu chay tiep.

    Truoc khi soan tin se tai lai lich D1,
    tranh dung du lieu da cu.
  */

  form.addEventListener(
    "submit",
    async event => {
      if (replayingSubmit) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (!checkSelection()) return;

      submitButton.disabled = true;

      setFeedback(
        "Đang kiểm tra lại lịch mới nhất trước khi soạn yêu cầu…"
      );

      try {
        busyDays = await fetchAvailability();

        syncDisabled();

        if (!checkSelection()) return;

        // Goi lai su kien Submit de form V5 cu
        // tiep tuc soan tin Zalo nhu truoc.
        replayingSubmit = true;

        try {
          form.requestSubmit();
        } finally {
          replayingSubmit = false;
        }

      } catch (error) {
        console.error(
          "RENTAL_AVAILABILITY_ERROR",
          error
        );

        setFeedback(
          "Không kết nối được lịch. " +
          "Chưa thể xác nhận ngày thuê; " +
          "hãy gọi hoặc nhắn Zalo để được hỗ trợ.",
          "error"
        );

      } finally {
        submitButton.disabled = false;
      }
    },
    true
  );

  // =========================================
  // 6. KHOI TAO FLATPICKR
  // =========================================

  async function init() {
    if (
      typeof window.flatpickr !== "function"
    ) {
      setFeedback(
        "Thư viện lịch không tải được. " +
        "Hãy kiểm tra mạng hoặc tải lại trang.",
        "error"
      );

      return;
    }

    try {
      busyDays = await fetchAvailability();

      const common = {
        locale:
          window.flatpickr.l10ns.vn ||
          "default",

        dateFormat: "Y-m-d",

        disableMobile: true,
        allowInput: false,

        minDate: today,
        maxDate: latest,

        disable: [
          d => busyDays.has(
            selectedDay(d)
          )
        ],

        onDayCreate: dayDecorate
      };

      // Khoi tao lich ngay tra xe.
      endPicker = window.flatpickr(
        dropoff,
        {
          ...common,

          onChange: () => {
            checkSelection();
          }
        }
      );

      // Khoi tao lich ngay nhan xe.
      startPicker = window.flatpickr(
        pickup,
        {
          ...common,

          onChange: (
            _dates,
            dateStr
          ) => {
            const newMin =
              dateStr || today;

            endPicker.set(
              "minDate",
              newMin
            );

            if (
              dropoff.value &&
              dropoff.value < newMin
            ) {
              endPicker.clear();
            }

            checkSelection();

            // Chon ngay nhan xong,
            // tu mo lich ngay tra.
            if (
              dateStr &&
              !dropoff.value
            ) {
              endPicker.open();
            }
          }
        }
      );

      ready = true;
      submitButton.disabled = false;

      setFeedback(
        "Lịch đã tải. Ngày màu đỏ nhạt " +
        "là đã bận hoặc bị khóa; " +
        "bạn có thể chọn ngày khác."
      );

    } catch (error) {
      console.error(
        "RENTAL_CALENDAR_INIT_ERROR",
        error
      );

      setFeedback(
        "Không tải được lịch xe từ D1. " +
        "Tạm khóa chọn ngày để tránh nhận sai lịch; " +
        "hãy liên hệ tư vấn trực tiếp.",
        "error"
      );
    }
  }

  init();

})();
