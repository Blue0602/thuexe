/*
 * Thuê VF3 Click — Smart Calendar (D1), v3.1 — chú thích trạng thái
 * Hien thi o trang chu + VF3/VF8/K5, khong can iframe
 * JavaScript V5 cũ. Chỉ đọc lịch, KHÔNG giữ chỗ và KHÔNG thu cọc.
 * File: /assets/js/smart-calendar.js
 */
(() => {
  'use strict';

  const API = 'https://thuevf3click-api.hgpure2003.workers.dev';
  const DAY = 86_400_000;
  const NAMES = {
    vf3: 'VinFast VF3 VIP',
    vf8: 'VinFast VF8 Plus',
    'kia-k5': 'KIA K5',
    'limo-green': 'VinFast Limo Green'
  };
  const BOOKING_NAMES = {
    vf3: 'VF3 VIP',
    vf8: 'VinFast VF8',
    'kia-k5': 'KIA K5'
  };
  const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const fmtVN = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const ymdVN = ms => {
    const p = Object.fromEntries(fmtVN.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  const toUTCday = d => Date.parse(`${d}T00:00:00Z`);
  const addDays = (d, n) => new Date(toUTCday(d) + n * DAY).toISOString().slice(0, 10);
  const today = ymdVN(Date.now());
  const lastDay = addDays(today, 89);
  const maxMonth = lastDay.slice(0, 7);
  const firstMonth = today.slice(0, 7);
  const cache = new Map();

  function parseUTC(v) {
    if (typeof v !== 'string') return NaN;
    const s = v.trim().replace(' ', 'T');
    return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(s) ? s : `${s}Z`);
  }

  function busyType(type) {
    if (type === 'blocked' || type === 'block') return 'blocked';
    if (type === 'confirmed') return 'booked';
    if (type === 'held') return 'held';
    return 'booked'; // fail closed for an unknown occupied type
  }

  function priority(type) {
    return { blocked: 3, booked: 2, held: 1 }[type] || 0;
  }

  async function fetchOccupied(car, force = false) {
    const stored = cache.get(car);
    if (!force && stored && Date.now() - stored.at < 45_000) return stored.days;

    // Hai cửa sổ dưới 90 ngày. Lấy thêm 1 ngày ở 2 đầu
    // để không mất khoảng giao ngày do API dùng mốc UTC.
    const windows = [
      [addDays(today, -1), addDays(today, 46)],
      [addDays(today, 45), addDays(today, 91)]
    ];
    const requests = windows.map(async ([from, to]) => {
      const u = new URL(`${API}/api/occupied`);
      u.searchParams.set('vehicle', car);
      u.searchParams.set('from', from);
      u.searchParams.set('to', to);
      const response = await fetch(u, {
        headers: { Accept: 'application/json' }, cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Không đọc được API: HTTP ${response.status}`);
      const data = await response.json();
      if (data.success !== true || !Array.isArray(data.intervals) || data.vehicle_active === false) {
        throw new Error('Dữ liệu lịch không hợp lệ hoặc xe đang tạm ngưng');
      }
      return data.intervals;
    });

    const result = await Promise.all(requests);
    const days = new Map();
    for (const item of result.flat()) {
      const from = parseUTC(item.start_utc);
      const to = parseUTC(item.end_utc);
      if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
        throw new Error('Khoảng thời gian do API trả về không hợp lệ');
      }
      const kind = busyType(item.type);
      for (let t = toUTCday(ymdVN(from)); t <= toUTCday(ymdVN(to - 1)); t += DAY) {
        const d = new Date(t).toISOString().slice(0, 10);
        if (d < today || d > lastDay) continue;
        if (priority(kind) > priority(days.get(d))) days.set(d, kind);
      }
    }
    cache.set(car, { at: Date.now(), days });
    return days;
  }

  function conflicts(days, start, end) {
    if (!start || !end || start > end || start < today || end > lastDay) return true;
    for (let t = toUTCday(start); t <= toUTCday(end); t += DAY) {
      if (days.has(new Date(t).toISOString().slice(0, 10))) return true;
    }
    return false;
  }

  function mountCSS() {
    const style = document.createElement('style');
    style.textContent = `
      .smc{background:#fff;color:#17273c;border-radius:18px;overflow:hidden;font-family:inherit;width:100%;min-width:0}
      .smc *{box-sizing:border-box}
      .smc button,.smc select{font:inherit}
      .smc__head{padding:18px 18px 13px;border-bottom:1px solid #e6edf5;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
      .smc__head small{display:block;font-size:10px;color:#6480a3;letter-spacing:.07em;font-weight:800}
      .smc__head strong{display:block;font-size:17px;color:#14283f;margin-top:4px}
      .smc__source{border-radius:30px;background:#e6f7ef;color:#187d58;padding:6px 10px;font-size:10px;font-weight:800;white-space:nowrap}
      .smc__tools{padding:14px 18px;display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;border-bottom:1px solid #e6edf5}
      .smc__select{min-width:150px;max-width:100%;border:1px solid #d4e0ee;border-radius:11px;background:#fff;color:#20344c;padding:9px;font-size:12px}
      .smc__pager{display:flex;align-items:center;gap:8px}
      .smc__pager strong{min-width:105px;text-align:center;font-size:14px;color:#14283f}
      .smc__nav,.smc__refresh{border:1px solid #dce6f1;background:#f7faff;color:#1f527f;border-radius:10px;min-width:35px;min-height:35px;cursor:pointer;font-weight:800}
      .smc__nav:disabled{opacity:.3;cursor:default}
      .smc__week,.smc__days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;padding:0 12px}
      .smc__week{margin:12px 0 8px;color:#67809b;text-align:center;font-size:11px;font-weight:850}
      .smc__days{padding-bottom:12px}
      .smc__day{min-width:0;min-height:72px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;gap:6px;background:#effaf4;border:1px solid #dcedf0;border-radius:10px;padding:7px 6px;text-align:left;cursor:pointer;color:#1e7a58}
      .smc__day b{font-size:13px;color:#24364c}
      .smc__day span{font-size:9px;line-height:1.2;overflow-wrap:anywhere}
      .smc__day--empty{border:0;background:transparent;cursor:default}
      .smc__day--outside{background:#f7f9fb;color:#a6b0be;cursor:default}
      .smc__day--outside b{color:#9baabd}
      .smc__day--blocked{background:#edf0f6;color:#66758b;cursor:not-allowed}
      .smc__day--booked{background:#fff0ed;color:#bb4935;cursor:not-allowed}
      .smc__day--held{background:#fff6de;color:#9d6b12;cursor:not-allowed}
      .smc__day--selected{border:2px solid #086bea;background:#ddecff;color:#084cbb}
      .smc__day--inrange{background:#e2f0ff;border-color:#a3c7f5}
      .smc__day--today b{background:#086bea;color:#fff;border-radius:8px;padding:2px 5px}
      .smc__day:focus-visible{outline:3px solid #086bea;outline-offset:1px}
      .smc__status{padding:11px 17px;margin:0;background:#f1f7ff;color:#365e86;font-size:12px;line-height:1.65}
      .smc__status[data-error="true"]{background:#fff0ee;color:#b13f2f}
      .smc__actions{padding:14px 17px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
      .smc__cta{border:0;border-radius:11px;background:#086cea;color:#fff;padding:11px 15px;font-weight:800;cursor:pointer;font-size:12px}
      .smc__cta:disabled{background:#aabbd0;cursor:default}
      .smc__actions small{flex:1;color:#687f99;font-size:11px;line-height:1.5}
      .smc__legend{padding:13px 17px 12px;background:#f8fbff;border-bottom:1px solid #e7edf5;color:#243b55}
      .smc__legend-title{font-size:12px;font-weight:850;margin:0 0 9px;letter-spacing:.01em}
      .smc__legend-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .smc__legend-item{display:flex;align-items:flex-start;gap:9px;padding:9px;border:1px solid #e4ebf3;border-radius:10px;background:#fff;min-width:0}
      .smc__legend-item i{display:block;flex:none;width:13px;height:13px;border-radius:4px;margin-top:2px;border:1px solid #00000012}
      .smc__legend-item b{display:block;font-size:11px;line-height:1.35;color:#24364c}
      .smc__legend-item small{display:block;font-size:10px;line-height:1.5;color:#617890;margin-top:3px}
      .smc__legend-note{margin:10px 0 0;font-size:10px;line-height:1.6;color:#5c7086}
      [data-smart-calendar]{height:auto!important;min-height:0!important;overflow:visible!important;display:block!important;background:#fff;opacity:1!important;transform:none!important}
      .smc-detail-section{padding:70px 0;background:#f0f7ff}
      .smc-detail-container{width:min(1200px,calc(100% - 36px));margin:auto;display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:40px;align-items:center}
      .smc-detail-copy h2{font-size:clamp(29px,3vw,45px);letter-spacing:-.04em;line-height:1.16;margin:12px 0 18px;color:#162a40;font-weight:900}
      .smc-detail-copy p{line-height:1.9;color:#526b84;font-size:14px;max-width:470px}
      .smc-detail-eyebrow{font-size:11px;font-weight:900;letter-spacing:.1em;color:#146fe4}
      .smc-detail-box{border:1px solid #dce8f7;box-shadow:0 18px 45px #173e6717;border-radius:22px;overflow:hidden;min-width:0}
      @media(max-width:950px){.smc-detail-container{grid-template-columns:1fr;gap:22px}.smc-detail-section{padding:46px 0}}
      @media(max-width:600px){.smc__head,.smc__tools{padding:13px 11px}.smc__week,.smc__days{gap:3px;padding-left:6px;padding-right:6px}.smc__day{min-height:65px;padding:5px 3px;border-radius:7px}.smc__day b{font-size:12px}.smc__day span{font-size:8px}.smc__pager strong{font-size:12px;min-width:90px}.smc__legend{padding:11px 9px}.smc__legend-grid{gap:5px}.smc__legend-item{padding:7px;gap:6px}.smc__legend-item b{font-size:10px}.smc__legend-item small{font-size:9px}.smc__select{min-width:130px}}
    `;
    document.head.append(style);
  }

  function calendarHTML(mode, initialCar) {
    const choose = mode === 'home'
      ? `<label><span class="smc__sr">Chọn xe </span><select class="smc__select" data-action="car" aria-label="Chọn xe">${Object.entries(NAMES).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>`
      : '<span style="font-size:12px;color:#527398">Dữ liệu lịch trực tiếp</span>';
    return `<div class="smc" aria-label="Lịch xe từ cơ sở dữ liệu D1">
      <div class="smc__head"><div><small>LỊCH THUÊ XE TRỰC TIẾP</small><strong data-role="car-title">VinFast VF3 VIP</strong></div><span class="smc__source">● D1 · cập nhật trực tiếp</span></div>
      <div class="smc__tools">${choose}<div class="smc__pager">
        <button type="button" class="smc__nav" data-action="prev" aria-label="Tháng trước">‹</button><strong data-role="month"></strong><button type="button" class="smc__nav" data-action="next" aria-label="Tháng sau">›</button><button type="button" class="smc__refresh" data-action="refresh" title="Tải lại lịch" aria-label="Tải lại lịch">↻</button>
      </div></div>
      <div class="smc__legend" aria-label="Chú thích trạng thái lịch xe">
        <p class="smc__legend-title">CHÚ THÍCH TRẠNG THÁI LỊCH</p>
        <div class="smc__legend-grid">
          <div class="smc__legend-item"><i style="background:#e6f7ed"></i><div><b>Chưa có lịch</b><small>Có thể gửi yêu cầu thuê</small></div></div>
          <div class="smc__legend-item"><i style="background:#edf0f6"></i><div><b>Khóa cố định (lịch xe tháng)</b><small>Xe không nhận thuê trong ngày khóa</small></div></div>
          <div class="smc__legend-item"><i style="background:#fff0ed"></i><div><b>Đã có đơn thuê</b><small>Khách đã xác nhận lịch thuê</small></div></div>
          <div class="smc__legend-item"><i style="background:#fff6de"></i><div><b>Đang giữ chỗ</b><small>Giữ tạm tối đa 15 phút</small></div></div>
        </div>
        <p class="smc__legend-note">Màu xám là khóa cố định (lịch xe tháng), không phải đơn khách thuê. Ngày xanh chỉ là chưa ghi nhận lịch bận, chưa giữ chỗ tự động.</p>
      </div>
      <div class="smc__week">${WEEKDAYS.map(s => `<span>${s}</span>`).join('')}</div>
      <div class="smc__days" data-role="days"></div>
      <p class="smc__status" data-role="status" role="status" aria-live="polite">Đang tải lịch xe...</p>
      <div class="smc__actions"><button type="button" class="smc__cta" data-action="apply" disabled>Dùng ngày đã chọn để đặt xe →</button><small>Chọn ngày nhận, sau đó chọn ngày trả. Chưa giữ chỗ hay thu cọc.</small></div>
    </div>`;
  }

  function monthMove(month, delta) {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
  }

  function mount(root, mode, initialCar) {
    root.innerHTML = calendarHTML(mode, initialCar);
    const app = root.querySelector('.smc');
    const daysEl = app.querySelector('[data-role="days"]');
    const status = app.querySelector('[data-role="status"]');
    const monthEl = app.querySelector('[data-role="month"]');
    const titleEl = app.querySelector('[data-role="car-title"]');
    const apply = app.querySelector('[data-action="apply"]');
    const prev = app.querySelector('[data-action="prev"]');
    const next = app.querySelector('[data-action="next"]');
    const picker = app.querySelector('[data-action="car"]');
    let vehicle = NAMES[initialCar] ? initialCar : 'vf3';
    let month = firstMonth;
    let start = null;
    let end = null;
    let days = null;
    let message = '';
    let error = false;
    let token = 0;

    function note(msg, isError = false) {
      message = msg;
      error = isError;
      status.textContent = msg;
      status.dataset.error = String(isError);
    }

    function paint() {
      monthEl.textContent = `Tháng ${Number(month.slice(5))}/${month.slice(0,4)}`;
      titleEl.textContent = NAMES[vehicle];
      prev.disabled = month <= firstMonth;
      next.disabled = month >= maxMonth;
      apply.disabled = !days || !start || !end;
      const [year, m] = month.split('-').map(Number);
      const blanks = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
      const limit = new Date(Date.UTC(year, m, 0)).getUTCDate();
      daysEl.replaceChildren();
      for (let i = 0; i < blanks; i++) {
        const blank = document.createElement('div');
        blank.className = 'smc__day smc__day--empty';
        blank.setAttribute('aria-hidden', 'true');
        daysEl.append(blank);
      }
      for (let d = 1; d <= limit; d++) {
        const day = `${month}-${String(d).padStart(2, '0')}`;
        const type = day < today || day > lastDay ? 'outside'
          : days ? (days.get(day) || 'available') : 'outside';
        const labels = { outside: day < today ? 'Đã qua' : 'Ngoài 90 ngày', available: 'Chưa có lịch', blocked: 'Khóa cố định', booked: 'Đã có đơn', held: 'Đang giữ' };
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.dataset.day = day;
        cell.className = `smc__day smc__day--${type}`;
        cell.disabled = type !== 'available';
        cell.setAttribute('aria-label', `${day}: ${type === 'blocked' ? 'Khóa cố định (lịch xe tháng)' : labels[type]}`);
        cell.innerHTML = `<b>${d}</b><span>${labels[type]}</span>`;
        if (day === today) cell.classList.add('smc__day--today');
        if (start && (day === start || day === end)) cell.classList.add('smc__day--selected');
        if (start && end && day > start && day < end) cell.classList.add('smc__day--inrange');
        daysEl.append(cell);
      }
    }

    async function load(force = false) {
      const activeToken = ++token;
      days = null;
      start = end = null;
      note('Đang đối chiếu lịch thực tế từ D1...');
      paint();
      try {
        const data = await fetchOccupied(vehicle, force);
        if (activeToken !== token) return;
        days = data;
        note('Đã tải lịch. Chọn ngày nhận và ngày trả; ngày đã có đơn hoặc khóa cố định không thể chọn.');
      } catch (e) {
        if (activeToken !== token) return;
        console.error('SMART_CALENDAR_ERROR', e);
        note('Không tải được dữ liệu D1. Để tránh nhận sai lịch, vui lòng thử lại hoặc liên hệ Zalo.', true);
      }
      paint();
    }

    function selectDay(day) {
      if (!days || days.has(day) || day < today || day > lastDay) return;
      if (!start || end || day < start) {
        start = day;
        end = null;
        note('Đã chọn ngày nhận ' + day + '. Hãy bấm tiếp ngày trả xe.');
      } else if (conflicts(days, start, day)) {
        note('Khoảng bạn chọn đi qua ngày bận hoặc ngày khóa. Hãy chọn ngày trả khác.', true);
      } else {
        end = day;
        const total = Math.max(1, Math.round((toUTCday(end) - toUTCday(start)) / DAY));
        note(`Đã chọn ${start} → ${end} (${total} ngày dự kiến). Bấm nút bên dưới để chuyển vào form đặt xe.`);
      }
      paint();
    }

    function setFormDate(input, date) {
      if (!input) return;
      if (input._flatpickr) {
        input._flatpickr.setDate(date, true, 'Y-m-d');
      } else {
        input.value = date;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    async function applySelection() {
      if (!start || !end || !days) return;
      const savedStart = start;
      const savedEnd = end;
      const car = vehicle;
      apply.disabled = true;
      note('Đang kiểm tra lại lịch mới nhất...');
      try {
        const newest = await fetchOccupied(car, true);
        if (conflicts(newest, savedStart, savedEnd)) {
          days = newest;
          start = end = null;
          note('Lịch đã thay đổi hoặc khoảng thuê có ngày bận. Vui lòng chọn lại.', true);
          paint();
          return;
        }
        days = newest;
        if (mode === 'detail') {
          const idMap = {
            vf3: ['pickup', 'dropoff'],
            vf8: ['startDate', 'endDate'],
            'kia-k5': ['pickup', 'dropoff']
          };
          const inputIds = idMap[car];
          const form = document.querySelector('#bookingForm[data-rental-car]');
          if (!inputIds || !form) throw new Error('Không tìm thấy form tương ứng của xe');
          const pickup = document.getElementById(inputIds[0]);
          const dropoff = document.getElementById(inputIds[1]);
          if (!pickup || !dropoff) throw new Error('Không tìm thấy trường ngày nhận/trả');
          setFormDate(pickup, savedStart);
          setFormDate(dropoff, savedEnd);
          document.getElementById('dat-xe')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          note('Đã chuyển ngày vào form ' + NAMES[car] + '. Điền thông tin để soạn yêu cầu Zalo.');
        } else {
          const dialog = document.getElementById('booking-dialog');
          const form = document.getElementById('booking-form');
          if (!dialog || !form || typeof dialog.showModal !== 'function') throw new Error('Không tìm thấy form đặt xe trang chủ');
          form.hidden = false;
          const result = document.getElementById('enquiry-result');
          if (result) result.hidden = true;
          const wanted = BOOKING_NAMES[car] || NAMES[car];
          const carSelect = form.elements.car;
          if (!Array.from(carSelect.options).some(o => o.value === wanted)) {
            carSelect.add(new Option(wanted, wanted));
          }
          carSelect.value = wanted;
          setFormDate(form.elements.start, savedStart);
          setFormDate(form.elements.end, savedEnd);
          if (!dialog.open) dialog.showModal();
          note('Đã chuyển ngày sang form yêu cầu. Chưa tự động giữ chỗ.');
        }
      } catch (e) {
        console.error('SMART_CALENDAR_APPLY_ERROR', e);
        note('Không kiểm tra lại được lịch. Không chuyển yêu cầu; hãy thử lại.', true);
      } finally {
        paint();
      }
    }

    app.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || !app.contains(btn)) return;
      if (btn.dataset.day) selectDay(btn.dataset.day);
      if (btn.dataset.action === 'prev') { month = monthMove(month, -1); paint(); }
      if (btn.dataset.action === 'next') { month = monthMove(month, 1); paint(); }
      if (btn.dataset.action === 'refresh') load(true);
      if (btn.dataset.action === 'apply') applySelection();
    });
    picker?.addEventListener('change', () => {
      if (!Object.hasOwn(NAMES, picker.value)) return;
      vehicle = picker.value;
      load();
    });
    paint();
    load();
  }

  function protectHomeForm() {
    const form = document.getElementById('booking-form');
    if (!form) return;
    const ids = { 'VF3 VIP': 'vf3', 'VinFast VF8': 'vf8', 'KIA K5': 'kia-k5', 'VinFast Limo Green': 'limo-green' };
    let replay = false;
    form.addEventListener('submit', async e => {
      if (replay) return;
      const car = ids[form.elements.car.value];
      if (!car) return; // Xe hoa/sự kiện: yêu cầu tư vấn, không có lịch D1.
      e.preventDefault();
      e.stopImmediatePropagation();
      const start = form.elements.start.value;
      const end = form.elements.end.value;
      try {
        const days = await fetchOccupied(car, true);
        if (conflicts(days, start, end)) {
          window.alert('Khoảng ngày chọn có xe bận/khóa hoặc nằm ngoài phạm vi 90 ngày. Vui lòng chọn lại trong lịch.');
          return;
        }
        replay = true;
        try { form.requestSubmit(); } finally { replay = false; }
      } catch (error) {
        console.error('SMART_CALENDAR_FORM_CHECK_ERROR', error);
        window.alert('Không xác minh được lịch D1. Vui lòng thử lại hoặc liên hệ trực tiếp qua Zalo.');
      }
    }, true);
  }

  function startApp() {
    const slots = Array.from(document.querySelectorAll('[data-smart-calendar]'));
    if (!slots.length) return;
    mountCSS();
    for (const root of slots) {
      const mode = root.dataset.smartCalendar === 'home' ? 'home' : 'detail';
      const vehicle = root.dataset.vehicle || 'vf3';
      try {
        mount(root, mode, vehicle);
      } catch (error) {
        console.error('SMART_CALENDAR_INIT_ERROR', error);
        root.innerHTML = '<div style="padding:24px;background:#fff;color:#a93624;border-radius:15px">Lịch chưa khởi tạo được. Vui lòng tải lại trang hoặc liên hệ Zalo để kiểm tra.</div>';
      }
    }
    if (slots.some(root => root.dataset.smartCalendar === 'home')) protectHomeForm();
  }

  // Sau các script V5 hiện hữu đã gắn sự kiện Google cũ,
  // ta mới thay DOM; tránh lỗi null trong các script cũ.
  if (document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', startApp, { once: true });
  } else {
    startApp();
  }
})();
