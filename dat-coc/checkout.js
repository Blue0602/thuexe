(() => {
  'use strict';
  const API = 'https://thuevf3click-api.hgpure2003.workers.dev';
  const $ = id => document.getElementById(id);
  const money = v => Number(v).toLocaleString('vi-VN') + 'đ';
  const alertBox = $('alert');
  const quoteBox = $('quote');
  const params = new URLSearchParams(location.search);
  const autoMode = params.get('auto') === '1';
  const selectedVehicle = params.get('vehicle') || 'vf3';
  let autoPayload = null;
  let configReady = false;
  let autoSubmitting = false;
  const selectedPackage = params.get('package') || '';
  const priceMap = new Map();
  let config = null;
  let busy = false;
  let hold = null;
  let widgetId = null;
  let token = '';
  let timerId = null;
  let pollId = null;
  const storageKey = 'vfc_checkout_pending_live';
  const autoKey = 'vfc_checkout_autostart_v3';
  let estimateSerial = 0;

  function setAlert(message, error = false, ok = false) {
    alertBox.textContent = message;
    alertBox.dataset.error = String(error);
    alertBox.dataset.ok = String(ok);
  }
  function validDateTime(str) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str || ''); }
  function localTimestamp(s) { return Date.parse(s + ':00+07:00'); }
  function sqlExpiryToMs(s) { return Date.parse(String(s).replace(' ', 'T') + 'Z'); }
  function getSelectedRate() { return priceMap.get($('vehicle').value + ':' + $('rentalPackage').value); }
  function validateTime() {
    const from = $('start').value, to = $('end').value;
    if (!validDateTime(from) || !validDateTime(to)) return null;
    const start = localTimestamp(from), end = localTimestamp(to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= Date.now() ||
        end - start < 3600000 || end - start > 31 * 86400000 ||
        new Date(start + 7*3600000).toISOString().slice(0,16) !== from ||
        new Date(end + 7*3600000).toISOString().slice(0,16) !== to) return null;
    return { start, end, days: Math.ceil((end-start)/86400000) };
  }
  function estimate() {
    const rate = getSelectedRate();
    const duration = validateTime();
    if (!rate || !duration) {
      quoteBox.textContent = 'Chọn xe, gói thuê và thời gian hợp lệ. Đơn tối thiểu 1 giờ, tối đa 31 ngày. Mọi khoảng thuê được đối chiếu với lịch khóa D1.';
      return;
    }
    quoteBox.textContent='Đang tính giá từng ngày (cuối tuần/lễ Tết) từ Cloudflare D1...';
    const serial=++estimateSerial;
    const u=new URL(API+'/api/checkout/quote');
    u.searchParams.set('vehicle',$('vehicle').value);
    u.searchParams.set('package',$('rentalPackage').value);
    u.searchParams.set('start',$('start').value);
    u.searchParams.set('end',$('end').value);
    fetch(u,{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.json();
    }).then(info=>{
      if(serial!==estimateSerial)return;
      if(!info.success)throw new Error(info.message||'Không đọc được giá');
      const details=(info.price_days||[]).map(x=>
        x.date+': '+money(x.amount_vnd)+(x.is_holiday?' (Lễ/Tết +50%)':x.is_weekend?' (Cuối tuần)':''));
      quoteBox.textContent='CHI TIẾT GIÁ TỪNG NGÀY\n'+details.join('\n')+'\n'+
        'Tổng tiền thuê: '+money(info.total_vnd)+'\n'+
        'CỌC 30%: '+money(info.deposit_vnd);
    }).catch(e=>{
      if(serial===estimateSerial) quoteBox.textContent='Chưa tải được giá. Không tự tính tiền; xin thử lại. '+e.message;
    });
  }
  function fillPackages(preferred) {
    const id = $('vehicle').value;
    const select = $('rentalPackage');
    const options = config.vehicles.filter(r => r.vehicle_id === id && r.selectable);
    select.replaceChildren();
    if (!options.length) {
      select.add(new Option('Xe chưa mở thanh toán trực tuyến', ''));
    } else {
      for (const r of options) select.add(new Option(r.package_name + ' — ' + money(r.daily_price_vnd) + '/ngày', r.package_code));
      if (options.some(r=>r.package_code===preferred)) select.value = preferred;
    }
    $('submit').disabled = !config.payment_ready || options.length === 0 || Boolean(hold);
    estimate();
  }
  function setDateValues() {
    const d = new Date(Date.now() + 3 * 86400000);
    const fmt = n => String(n).padStart(2, '0');
    const tomorrow = `${d.getFullYear()}-${fmt(d.getMonth()+1)}-${fmt(d.getDate())}`;
    const fromParam = params.get('start');
    const toParam = params.get('end');
    const from = /^\d{4}-\d{2}-\d{2}$/.test(fromParam || '') ? fromParam : tomorrow;
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(toParam || '') ? toParam : tomorrow;
    $('start').value = from + 'T08:00';
    const asNum = Date.parse(from+'T00:00:00Z'), bsNum = Date.parse(endDate+'T00:00:00Z');
    $('end').value = (bsNum > asNum ? endDate : new Date(asNum + 86400000).toISOString().slice(0,10)) + 'T08:00';
  }
  async function renderTurnstile(siteKey) {
    let count = 0;
    while (!window.turnstile && count++ < 70) await new Promise(resolve => setTimeout(resolve, 150));
    if (!window.turnstile) throw new Error('Không tải được Cloudflare Turnstile. Hãy kiểm tra kết nối/tiện ích chặn.');
    widgetId = window.turnstile.render('#turnstile-box', {
      sitekey: siteKey,
      action: 'rent_hold',
      callback: t => { token = t; launchAutoIfReady(); },
      'expired-callback': () => { token = ''; },
      'error-callback': () => { token = ''; setAlert('Turnstile chưa hoạt động. Hãy kiểm tra hostname trên Cloudflare.', true); }
    });
  }
  function stopPolling() {
    if (pollId) clearInterval(pollId);
    pollId = null;
  }
  function renderTimer() {
    if (!hold) return;
    const remain = Math.max(0, Math.ceil((hold.expiry - Date.now()) / 1000));
    $('countdown').textContent = String(Math.floor(remain / 60)).padStart(2, '0') + ':' + String(remain % 60).padStart(2, '0');
    if (remain === 0 && $('order-state').dataset.state !== 'expired') {
      $('order-state').dataset.state = 'expired';
      $('order-state').firstChild.textContent = 'Hết thời gian giữ chỗ. ';
      $('qr').hidden = true;
      $('qr-open').hidden = true;
      $('qr-save').hidden = true;
      $('mobile-guide').hidden = true;
      $('pay-message').textContent = 'Hết 15 phút. Không chuyển khoản theo mã QR này. Hãy kiểm tra lại trạng thái đơn.';
      checkStatus();
    }
  }
  function copyValue(value, label) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        $('pay-message').textContent = 'Đã sao chép ' + label + '. Mở ứng dụng ngân hàng và dán vào đúng trường.';
      }).catch(() => { window.prompt('Sao chép ' + label + ':', value); });
    } else window.prompt('Sao chép ' + label + ':', value);
  }
  function displayHold() {
    $('payment-empty').hidden = true;
    $('payment-active').hidden = false;
    $('order-state').dataset.state = '';
    $('order-state').firstChild.textContent = 'Đang giữ xe '; 
    $('qr').onerror = () => {
      $('qr').hidden = true;
      $('qr-fallback').hidden = false;
      $('qr-fallback').textContent = 'Không tải được hình QR từ máy chủ ảnh. Bạn vẫn có thể chuyển khoản thủ công bằng thông tin chính xác bên dưới. Không tự ý thay đổi số tiền hoặc mã đơn.';
    };
    $('qr-fallback').hidden = true;
    $('qr').src = hold.qr_url;
    $('qr').hidden = false;
    $('qr-open').href = hold.qr_url;
    const download = new URL(hold.qr_url);
    download.searchParams.set('download', 'true');
    $('qr-save').href = download.toString();
    $('qr-save').hidden = false;
    $('mobile-guide').hidden = false;
    $('qr-open').hidden = false;
    $('deposit').textContent = money(hold.deposit_vnd);
    $('bank').textContent = hold.bank_code;
    $('holder').textContent = hold.bank_holder;
    $('account').textContent = hold.bank_account;
    $('payment-code').textContent = hold.transfer_memo || hold.payment_code;
    $('booking-panel').hidden = true;
    renderTimer();
    if (!timerId) timerId = setInterval(renderTimer, 1000);
    if (!pollId) pollId = setInterval(checkStatus, 5000);
    $('payment-panel').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function completeState(state, message) {
    stopPolling();
    if (timerId) clearInterval(timerId);
    timerId = null;
    $('order-state').dataset.state = state;
    $('order-state').firstChild.textContent = state === 'confirmed' ? 'Đã xác nhận đặt xe · ' : 'Cần kiểm tra đơn · ';
    $('countdown').textContent = state === 'confirmed' ? '✓' : '00:00';
    $('qr').hidden = true;
    $('qr-open').hidden = true;
    $('qr-save').hidden = true;
    $('mobile-guide').hidden = true;
    $('pay-message').textContent = message;
    setAlert(message, state !== 'confirmed', state === 'confirmed');
    if (state === 'confirmed' && hold) {
      $('receipt').hidden = false;
      const fields = [
        'Mã đơn: ' + hold.booking_id,
        'Xe: ' + (hold.vehicle_id || ''),
        'Thời gian nhận: ' + (hold.start_local || 'Xem trên phiếu đặt xe'),
        'Thời gian trả: ' + (hold.end_local || 'Xem trên phiếu đặt xe'),
        'Đã đặt cọc: ' + money(hold.deposit_vnd)
      ];
      $('receipt-info').textContent = fields.join('\n');
      try { sessionStorage.setItem(storageKey, JSON.stringify(hold)); } catch {}
    } else sessionStorage.removeItem(storageKey);
  }
  async function checkStatus() {
    if (!hold || busy) return;
    try {
      const res = await fetch(API + '/api/bookings/status?id=' + encodeURIComponent(hold.booking_id), {
        method:'GET', headers:{'X-Booking-Token':hold.status_token}, cache:'no-store'
      });
      const data = await res.json();
      if (!res.ok || data.success !== true) throw new Error(data.message || 'Lỗi API trạng thái');
      if (data.status === 'confirmed' && data.payment_status === 'paid') {
        completeState('confirmed','Thanh toán cọc thành công! Xe đã được xác nhận. Giữ mã đơn để đối chiếu khi nhận xe.');
      } else if (data.payment_status === 'review') {
        completeState('review','Ngân hàng đã có giao dịch cần đối soát. Không chuyển khoản lần nữa; hãy liên hệ Zalo để nhân viên xử lý.');
      } else if (data.status !== 'held') {
        completeState('expired','Đơn giữ chỗ đã hết hạn hoặc bị hủy. Không chuyển tiền theo QR này. Nếu ngân hàng đã trừ tiền, liên hệ Zalo để đối soát.');
      }
    } catch (error) {
      $('pay-message').textContent = 'Chưa kiểm tra được thanh toán: ' + error.message + '. Không chuyển khoản lần hai; hệ thống sẽ thử lại.';
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || hold) return;
    if (!$('vehicle').value || !$('rentalPackage').value || !validateTime() || !getSelectedRate()) {
      return setAlert('Vui lòng chọn xe, gói thuê và ngày giờ hợp lệ.', true);
    }
    const name = $('customer').value.trim();
    const phone = $('phone').value.replace(/[\s.-]/g,'');
    if (name.length < 2 || !/^(0\d{9}|\+84\d{9})$/.test(phone) || !$('agree').checked) {
      return setAlert('Vui lòng nhập tên, số điện thoại đúng và xác nhận điều khoản.', true);
    }
    if (!token) return setAlert('Bạn cần hoàn thành xác minh Turnstile.', true);
    busy = true;
    $('submit').disabled = true;
    setAlert('Đang kiểm tra lịch và tạo giữ chỗ trong D1...');
    try {
      const res = await fetch(API+'/api/bookings/hold',{
        method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store',
        body:JSON.stringify({
          vehicle_id:$('vehicle').value,
          package_code:$('rentalPackage').value,
          customer_name:name, customer_phone:phone,
          start_local:$('start').value, end_local:$('end').value,
          turnstile_token:token
        })
      });
      const data = await res.json();
      if (!res.ok || data.success !== true) {
        if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
        token = '';
        throw new Error((data.code ? data.code+' — ' : '') + (data.message || 'Không giữ được xe'));
      }
      hold = {...data, expiry: sqlExpiryToMs(data.hold_expires_at_utc),
        customer_name: name, customer_phone: phone,
        start_local: $('start').value, end_local: $('end').value};
      // A completed hold no longer needs the earlier hand-off data.
      sessionStorage.removeItem(autoKey);
      sessionStorage.setItem(storageKey,JSON.stringify(hold));
      displayHold();
      setAlert('Đã giữ lịch trong 15 phút. Quét QR và chuyển đúng số tiền cọc 30%.',false,true);
    } catch(error) {
      if (autoMode) {
        $('payment-empty').querySelector('b').textContent = 'Chưa giữ xe – chưa có QR để chuyển cọc';
        $('payment-empty').querySelector('p').textContent = 'Chi tiết: ' + error.message + '. Quay lại lịch để chọn ngày khác hoặc liên hệ Zalo. Không chuyển khoản khi chưa có mã đơn.';
      }
      setAlert('Chưa tạo được đơn: '+error.message+'. Nếu xe đã khóa lịch, chọn thời gian khác.',true);
      $('submit').disabled = false;
    } finally { busy = false; }
  }
  function populateAuto(payload) {
    if (!payload || !config) return;
    if (!$('vehicle').querySelector(`option[value="${payload.vehicle_id}"]`)) {
      return setAlert('Dòng xe chưa khả dụng. Liên hệ Zalo để chốt lịch.', true);
    }
    $('vehicle').value = payload.vehicle_id;
    fillPackages(payload.package_code);
    if ($('rentalPackage').value !== payload.package_code || !getSelectedRate()) {
      return setAlert('Gói thuê chưa được bật đặt cọc. Liên hệ Zalo để được tư vấn.', true);
    }
    $('customer').value = payload.customer_name;
    $('phone').value = payload.customer_phone;
    $('start').value = payload.start + 'T08:00';
    $('end').value = payload.end + 'T08:00';
    $('agree').checked = true;
    estimate();
  }
  function launchAutoIfReady() {
    if (!autoMode || !autoPayload || !configReady || !token || autoSubmitting || hold) return;
    if (!getSelectedRate() || !validateTime() || !config.payment_ready) return;
    autoSubmitting = true;
    submit({preventDefault(){}}).finally(() => { autoSubmitting = false; });
  }
  if (autoMode) {
    document.body.classList.add('vfc-auto-mode');
    const entry = $('booking-panel');
    const wait = $('payment-empty');
    entry.hidden = true;
    const turnstile = $('turnstile-box');
    wait.querySelector('b').textContent = 'Đang xác minh và giữ xe...';
    wait.querySelector('p').textContent = 'Đang hoàn tất xác minh Cloudflare. QR chỉ xuất hiện khi Worker đã giữ xe thành công. Nếu cần xác minh thủ công, hãy chạm vào ô kiểm tra ngay bên dưới.';
    wait.appendChild(turnstile);
    const intro = document.querySelector('.intro');
    if (intro) intro.hidden = true;
  }
  window.addEventListener('message',event => {
    if (event.source !== window.parent || event.origin !== location.origin || event.data?.type !== 'vfc_checkout_auto') return;
    const data = event.data.payload;
    if (!data || typeof data !== 'object') return;
    autoPayload = data;
    if (configReady) populateAuto(autoPayload);
    launchAutoIfReady();
  });
  async function init() {
    if (autoMode) {
      try {
        const handoff = JSON.parse(sessionStorage.getItem(autoKey) || 'null');
        if (handoff?.payload && Date.now() - handoff.created_at < 15 * 60 * 1000) {
          autoPayload = handoff.payload;
        }
      } catch {}
      if (!autoPayload) {
        setAlert('Phiên chuyển từ nút Chốt xe đã hết hạn. Vui lòng quay lại lịch và chốt lại.', true);
        $('payment-empty').querySelector('b').textContent = 'Chưa nhận được thông tin thuê xe';
        $('payment-empty').querySelector('p').textContent = 'Không có đơn đặt cọc hoặc mã QR nào được tạo. Hãy quay lại trang xe.';
        return;
      }
    }
    setDateValues();
    try {
      const res = await fetch(API+'/api/checkout/config',{cache:'no-store'});
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Không thể tải cấu hình');
      config = data;
      const supported = new Map();
      for (const row of data.vehicles || []) {
        if (row.is_active === 1) supported.set(row.vehicle_id, row.vehicle_name);
        if (row.selectable) priceMap.set(row.vehicle_id+':'+row.package_code,row);
      }
      $('vehicle').replaceChildren();
      for (const [id,name] of supported) $('vehicle').add(new Option(name,id));
      if (supported.has(selectedVehicle)) $('vehicle').value = selectedVehicle;
      fillPackages(selectedPackage);
      configReady = true;
      if (autoPayload) populateAuto(autoPayload);
      if (!data.payment_ready) {
        setAlert('Worker hiện báo payment_ready=false. Chưa tạo đơn, chưa có QR. Hãy kiểm tra biến SEPAY_PAYMENT_ENABLED và bộ Secrets trên Worker đang Deploy.',true);
        if (autoMode) {
          $('payment-empty').querySelector('b').textContent = 'Chưa thể tạo QR thanh toán';
          $('payment-empty').querySelector('p').textContent = 'Máy chủ hiện chưa cho phép nhận cọc. Không chuyển tiền khi chưa có mã đơn. Vui lòng liên hệ người quản lý.';
        }
      } else if (!supported.size) {
        setAlert('Chưa có dòng xe nào được bật thanh toán trên D1. Vui lòng liên hệ Zalo.',true);
      } else {
        if (!getSelectedRate()) setAlert('Dòng xe này chưa có giá thanh toán chính thức. Vui lòng liên hệ Zalo hoặc chọn xe khác.',true);
        else setAlert('Hệ thống sẵn sàng. Cọc 30%, giữ xe trong 15 phút sau khi tạo đơn.',false,true);
        await renderTurnstile(data.turnstile_sitekey);
        launchAutoIfReady();
      }
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        try {
          const candidate = JSON.parse(saved);
          if (candidate?.booking_id && candidate?.status_token && candidate?.qr_url && candidate.expiry > Date.now() - 7*86400000) {
            hold = candidate; displayHold(); await checkStatus();
          } else sessionStorage.removeItem(storageKey);
        } catch { sessionStorage.removeItem(storageKey); }
      }
    } catch(error) {
      setAlert('Không tải được hệ thống thanh toán: '+error.message+'. Vui lòng liên hệ Zalo.',true);
    }
  }
  $('vehicle').addEventListener('change',()=>fillPackages(''));
  for (const id of ['start','end','rentalPackage']) $(id).addEventListener('change',estimate);
  $('booking').addEventListener('submit',submit);
  $('refresh').addEventListener('click',checkStatus);
  $('copy-code').addEventListener('click', () => copyValue($('payment-code').textContent, 'nội dung chuyển khoản'));
  $('copy-account').addEventListener('click', () => copyValue($('account').textContent, 'số tài khoản'));
  $('copy-amount').addEventListener('click', () => copyValue(String(hold?.deposit_vnd || ''), 'số tiền cọc'));
  init();
})();
