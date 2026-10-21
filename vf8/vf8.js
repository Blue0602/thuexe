'use strict';
const $ = (selector) => document.querySelector(selector);
const nav = $('#nav'), menuToggle = $('#menuToggle'), carsToggle = $('#carsToggle'), navSub = $('#navSub');
function closeMenu(){nav.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');carsToggle.setAttribute('aria-expanded','false');navSub.classList.remove('show');}
menuToggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));});
carsToggle.addEventListener('click',()=>{const open=navSub.classList.toggle('show');carsToggle.setAttribute('aria-expanded',String(open));});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('click',e=>{if(!e.target.closest('.nav') && !e.target.closest('.menu-toggle')) closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape') closeMenu();});
const rail=$('#videoRail');
$('#videoPrev').addEventListener('click',()=>rail.scrollBy({left:-Math.round(rail.clientWidth*.76),behavior:'smooth'}));
$('#videoNext').addEventListener('click',()=>rail.scrollBy({left:Math.round(rail.clientWidth*.76),behavior:'smooth'}));
const dialog=$('#videoModal'),player=$('#modalVideo');
function stopVideo(){player.pause();player.removeAttribute('src');player.load();}
rail.querySelectorAll('[data-video]').forEach(card=>card.addEventListener('click',()=>{
  const video=card.dataset.video;
  if(!/^[a-z0-9-]+\.mp4$/.test(video)) return;
  $('#modalTitle').textContent=card.dataset.title || 'Video VinFast VF8';
  player.src='./media/'+video;
  dialog.showModal();
  player.play().catch(()=>{});
}));
$('#modalClose').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',stopVideo);
dialog.addEventListener('click',e=>{if(e.target===dialog) dialog.close();});
const startDate=$('#startDate'),endDate=$('#endDate');
const today=new Date();const localDate=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
startDate.min=localDate;endDate.min=localDate;
startDate.addEventListener('change',()=>{endDate.min=startDate.value||localDate;if(endDate.value && endDate.value<startDate.value)endDate.value=startDate.value;});
$('#bookingForm').addEventListener('submit',e=>{
 e.preventDefault();
 if(!e.currentTarget.reportValidity())return;
 if(endDate.value<startDate.value){endDate.setCustomValidity('Ngày trả phải bằng hoặc sau ngày nhận');endDate.reportValidity();return;}
 endDate.setCustomValidity('');
 const msg=['Chào Thuận/Ngọc, mình muốn hỏi thuê VinFast VF8 Plus màu xám.','',`Tên: ${$('#customerName').value.trim()}`,`SĐT: ${$('#customerPhone').value.trim()}`,`Ngày nhận: ${startDate.value}`,`Ngày trả: ${endDate.value}`,`Hình thức: ${$('#rentalType').value}`,`Nơi nhận: ${$('#pickup').value.trim()}`,`Ghi chú: ${$('#notes').value.trim()||'Không'}`,'', 'Nhờ kiểm tra lịch trống, điều kiện thuê và xác nhận giá giúp mình.'].join('\n');
 $('#messagePreview').value=msg;$('#bookingResult').hidden=false;$('#copyStatus').textContent='';$('#bookingResult').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
});
endDate.addEventListener('change',()=>endDate.setCustomValidity(''));
$('#copyMessage').addEventListener('click',async()=>{
 const txt=$('#messagePreview').value;
 try{if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(txt);} else {$('#messagePreview').select();if(!document.execCommand('copy'))throw new Error('copy');}$('#copyStatus').textContent='Đã sao chép. Mở Zalo và dán nội dung vào khung chat.';}
 catch(e){$('#messagePreview').focus();$('#messagePreview').select();$('#copyStatus').textContent='Hãy chọn Sao chép trên điện thoại hoặc nhấn Ctrl+C, sau đó dán vào Zalo.';}
});
