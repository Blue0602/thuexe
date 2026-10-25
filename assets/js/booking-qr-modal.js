/* VF3 Click - dung nut CHOT XE cua form hien tai, KHONG tao nut dat coc moi. */
(() => {
  'use strict';
  const VEHICLES = { 'VF3 VIP':'vf3', 'VF8':'vf8', 'VinFast VF8':'vf8', 'KIA K5':'kia-k5', 'VinFast Limo Green':'limo-green' };
  const $ = (el,sel) => el.querySelector(sel);
  const dateValue = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '';
  function getFields(form) {
    if (form.id === 'booking-form') {
      const car = form.elements.car?.value;
      return {
        vehicle_id: VEHICLES[car] || '',
        package_code: VEHICLES[car] === 'kia-k5' ? '400km' : 'standard',
        start: dateValue(form.elements.start?.value),
        end: dateValue(form.elements.end?.value),
        customer_name: String(form.elements.customer?.value || '').trim(),
        customer_phone: String(form.elements.phone?.value || '').trim()
      };
    }
    const vehicle_id = form.dataset.rentalCar || '';
    const isVF8 = vehicle_id === 'vf8';
    const dates = form.querySelectorAll('.rental-date');
    return {
      vehicle_id,
      package_code: vehicle_id === 'kia-k5' && $(form,'#rentalPackage')?.value === 'unlimited' ? 'unlimited' :
                    vehicle_id === 'kia-k5' ? '400km' : 'standard',
      start: dateValue(dates[0]?.value),
      end: dateValue(dates[1]?.value),
      customer_name: String($(form,isVF8 ? '#customerName' : vehicle_id === 'vf3' ? '#customerName' : '#fullName')?.value || '').trim(),
      customer_phone: String($(form,isVF8 ? '#customerPhone' : '#phone')?.value || '').trim(),
      rental_type: isVF8 ? ($(form,'#rentalType')?.value || 'Tự lái') : 'Tự lái'
    };
  }
  function createModal() {
    const style = document.createElement('style');
    style.textContent = `
      .vfc-modal{position:fixed;inset:0;z-index:2147483600;display:none;background:#0a1a28bb;padding:12px;align-items:center;justify-content:center}
      .vfc-modal[aria-hidden="false"]{display:flex}
      .vfc-modal-panel{width:100%;max-width:860px;height:min(94dvh,920px);overflow:hidden;border-radius:16px;background:#fff;box-shadow:0 16px 65px #0006}
      .vfc-modal-bar{height:47px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#0e2d3e;color:white;font:700 13px system-ui,sans-serif}
      .vfc-modal-close{padding:7px 12px;border:0;border-radius:9px;background:#fff;color:#18384c;font:700 13px system-ui,sans-serif;cursor:pointer}
      .vfc-modal iframe{width:100%;height:calc(100% - 47px);display:block;border:0;background:#f2f8ff}
      @media(max-width:650px){.vfc-modal{padding:0}.vfc-modal-panel{max-height:none;height:100dvh;border-radius:0}}
    `;
    document.head.appendChild(style);
    const backdrop=document.createElement('div');
    backdrop.className='vfc-modal';
    backdrop.setAttribute('role','dialog');
    backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-label','Thanh toán cọc thuê xe');
    backdrop.setAttribute('aria-hidden','true');
    backdrop.innerHTML='<div class="vfc-modal-panel"><div class="vfc-modal-bar"><span>Thuê VF3 Click · Thanh toán cọc 30%</span><button class="vfc-modal-close" type="button" aria-label="Đóng">Đóng ×</button></div><iframe title="Mã QR thanh toán cọc" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
    document.body.appendChild(backdrop);
    const iframe=backdrop.querySelector('iframe');
    const closeButton=backdrop.querySelector('.vfc-modal-close');
    let pending=null;
    let lastFocus=null;
    let lastScroll='';
    function close(){
      backdrop.setAttribute('aria-hidden','true');
      document.documentElement.style.overflow=lastScroll;
      iframe.src='about:blank';
      pending=null;
      if(lastFocus?.isConnected)lastFocus.focus();
    }
    closeButton.addEventListener('click',close);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape' && backdrop.getAttribute('aria-hidden')==='false')close()});
    iframe.addEventListener('load',()=>{
      if(pending && iframe.contentWindow && iframe.contentWindow.location.href !== 'about:blank'){
        iframe.contentWindow.postMessage({type:'vfc_checkout_auto',payload:pending},location.origin);
      }
    });
    return payload=>{
      pending=payload;
      lastFocus=document.activeElement;
      lastScroll=document.documentElement.style.overflow;
      const url=new URL('/dat-coc/',location.origin);
      url.searchParams.set('auto','1');
      url.searchParams.set('vehicle',payload.vehicle_id);
      url.searchParams.set('package',payload.package_code);
      iframe.src=url.toString();
      backdrop.setAttribute('aria-hidden','false');
      document.documentElement.style.overflow='hidden';
      closeButton.focus();
    };
  }
  function main(){
    const open=createModal();
    const forms=[...document.querySelectorAll('#bookingForm[data-rental-car], #booking-form')];
    for(const form of forms){
      const submit=form.querySelector('button[type="submit"]');
      if(submit){
        const icon=submit.querySelector('svg,span');
        if(icon){submit.replaceChildren(document.createTextNode('Chốt xe · Đặt cọc 30% '),icon)}
        else submit.textContent='Chốt xe · Đặt cọc 30%';
      }
      const oldInfo=form.querySelector('.form-note,.dialog-help');
      if(oldInfo)oldInfo.textContent='Bấm Chốt xe để giữ lịch trong 15 phút và xem mã QR cọc 30%.';
      const car=form.dataset.rentalCar;
      if(car==='vf3'){
        const note=document.querySelector('.booking-note');
        if(note)note.textContent='Chốt xe để giữ lịch 15 phút và đặt cọc 30% qua mã QR ngân hàng.';
        const sub=form.querySelector('.form-title p');
        if(sub)sub.textContent='Thông tin sẽ được dùng để giữ lịch 15 phút khi bạn bấm Chốt xe.';
      }
      if(car==='vf8'){
        const note=document.querySelector('.minor-note');
        if(note)note.textContent='Đặt cọc 30% được thực hiện ngay trên website khi bạn bấm Chốt xe.';
      }
      if(car==='kia-k5'){
        const note=form.querySelector('.form-heading small');
        if(note)note.textContent='Điền thông tin, chốt xe, quét QR đặt cọc 30%';
      }
    }
    // Nhan submit tu document o capture phase: ngan script Zalo cu chay.
    document.addEventListener('submit',event=>{
      const form=event.target;
      if(!forms.includes(form))return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if(!form.reportValidity())return;
      const payload=getFields(form);
      if(!payload.vehicle_id){alert('Dịch vụ này chưa hỗ trợ cọc tự động. Vui lòng liên hệ qua Zalo.');return;}
      if(payload.rental_type==='Có tài xế'){
        alert('Giá thuê có tài xế cần nhân viên báo giá riêng trước khi đặt cọc. Vui lòng liên hệ Zalo.');return;
      }
      if(!payload.start || !payload.end || payload.end<=payload.start){
        alert('Ngày trả xe phải sau ngày nhận xe. Vui lòng chọn lại lịch.');return;
      }
      if(payload.customer_name.length<2 || !/^(0\d{9}|\+84\d{9})$/.test(payload.customer_phone.replace(/[\s.\-]/g,''))){
        alert('Vui lòng nhập họ tên và số điện thoại hợp lệ trước khi chốt xe.');return;
      }
      open(payload);
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',main,{once:true});
  else main();
})();
