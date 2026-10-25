/* VF3 Click: click the existing "Chot xe" submit button -> open checkout page.
 * No second booking button. Works on desktop and mobile; no iframe and no URL PII. */
(() => {
  'use strict';
  const KEY = 'vfc_checkout_autostart_v3';
  const VEHICLES = {
    'VF3 VIP': 'vf3', 'VF8': 'vf8', 'VinFast VF8': 'vf8',
    'KIA K5': 'kia-k5', 'VinFast Limo Green': 'limo-green'
  };
  const $ = (form, selector) => form.querySelector(selector);
  const normalizeDay = raw => {
    const s = String(raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const match = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  };
  function getFields(form) {
    if (form.id === 'booking-form') {
      const vehicle = VEHICLES[form.elements.car?.value] || '';
      return {
        vehicle_id: vehicle,
        package_code: vehicle === 'kia-k5' ? '400km' : 'standard',
        start: normalizeDay(form.elements.start?.value),
        end: normalizeDay(form.elements.end?.value),
        customer_name: String(form.elements.customer?.value || '').trim(),
        customer_phone: String(form.elements.phone?.value || '').trim(),
        rental_type: 'Tự lái'
      };
    }
    const vehicle = form.dataset.rentalCar || '';
    const dates = form.querySelectorAll('.rental-date');
    const name = vehicle === 'kia-k5' ? '#fullName' : '#customerName';
    const phone = vehicle === 'vf8' ? '#customerPhone' : '#phone';
    return {
      vehicle_id: vehicle,
      package_code: vehicle === 'kia-k5' && $(form, '#rentalPackage')?.value === 'unlimited' ? 'unlimited' : vehicle === 'kia-k5' ? '400km' : 'standard',
      start: normalizeDay(dates[0]?.value),
      end: normalizeDay(dates[1]?.value),
      customer_name: String($(form, name)?.value || '').trim(),
      customer_phone: String($(form, phone)?.value || '').trim(),
      rental_type: vehicle === 'vf8' ? ($(form, '#rentalType')?.value || 'Tự lái') : 'Tự lái'
    };
  }
  function main() {
    const forms = [...document.querySelectorAll('#bookingForm[data-rental-car], #booking-form')];
    for (const form of forms) {
      const button = form.querySelector('button[type="submit"]');
      if (button) button.textContent = 'Chốt xe · Đặt cọc 30%';
      const info = form.querySelector('.form-note,.dialog-help');
      if (info) info.textContent = 'Bấm Chốt xe để chuyển tới mã QR cọc 30%. Lịch được giữ tối đa 15 phút sau khi xác minh thành công.';
    }
    document.addEventListener('submit', event => {
      const form = event.target;
      if (!forms.includes(form)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!form.reportValidity()) return;
      const p = getFields(form);
      const phone = p.customer_phone.replace(/[\s.\-]/g, '');
      if (!p.vehicle_id) return alert('Dịch vụ này chưa có giá cọc tự động, vui lòng liên hệ Zalo.');
      if (p.rental_type === 'Có tài xế') return alert('Giá có tài xế phải được báo riêng. Vui lòng liên hệ Zalo.');
      if (!p.start || !p.end || p.end <= p.start) return alert('Vui lòng chọn ngày trả sau ngày nhận.');
      if (p.customer_name.length < 2 || !/^(0\d{9}|\+84\d{9})$/.test(phone)) return alert('Vui lòng điền họ tên và số điện thoại hợp lệ.');
      p.customer_phone = phone;
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ payload: p, created_at: Date.now() }));
      } catch {
        return alert('Trình duyệt đang chặn phiên đặt xe. Hãy bật lưu trữ website và thử lại.');
      }
      const target = new URL('/dat-coc/', location.origin);
      target.searchParams.set('auto', '1');
      // No customer name/phone in the URL.
      location.assign(target.toString());
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true });
  else main();
})();
