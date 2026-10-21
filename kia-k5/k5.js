'use strict';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const header=$('#header');
addEventListener('scroll',()=>header.classList.toggle('scrolled',scrollY>16),{passive:true});
const toggle=$('#navToggle'),nav=$('#nav');
toggle.addEventListener('click',()=>{const opened=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(opened));toggle.setAttribute('aria-label',opened?'Đóng menu':'Mở menu');});
$$('.nav a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));
const thumbs=$$('.thumb'),gallery=$('#galleryMain'),counter=$('#galleryCounter');
const getSource=btn=>`./media/${btn.dataset.img}`;
let selected=0;
function selectImage(i){selected=(i+thumbs.length)%thumbs.length;const btn=thumbs[selected];gallery.src=getSource(btn);gallery.alt=btn.dataset.alt;counter.textContent=`${String(selected+1).padStart(2,'0')} / ${String(thumbs.length).padStart(2,'0')}`;thumbs.forEach((b,n)=>b.classList.toggle('active',n===selected));}
thumbs.forEach((btn,i)=>btn.addEventListener('click',()=>selectImage(i)));
const photoDialog=$('#photoDialog'),photoZoom=$('#photoZoom');
function openPhoto(){photoZoom.src=getSource(thumbs[selected]);photoZoom.alt=thumbs[selected].dataset.alt;$('#zoomCount').textContent=`${selected+1} / ${thumbs.length}`;photoDialog.showModal();}
$('#galleryExpand').addEventListener('click',openPhoto);
gallery.addEventListener('click',openPhoto);gallery.style.cursor='zoom-in';
$('#prevPhoto').addEventListener('click',()=>{selectImage(selected-1);openSelected();});
$('#nextPhoto').addEventListener('click',()=>{selectImage(selected+1);openSelected();});
function openSelected(){photoZoom.src=getSource(thumbs[selected]);photoZoom.alt=thumbs[selected].dataset.alt;$('#zoomCount').textContent=`${selected+1} / ${thumbs.length}`;}
$('[data-close-photo]').addEventListener('click',()=>photoDialog.close());
photoDialog.addEventListener('click',e=>{if(e.target===photoDialog)photoDialog.close();});
const videoDialog=$('#videoDialog'),video=$('#k5Video');
$('#videoOpen').addEventListener('click',()=>{videoDialog.showModal();const result=video.play();if(result?.catch)result.catch(()=>{});});
$('[data-close-video]').addEventListener('click',()=>videoDialog.close());
videoDialog.addEventListener('click',e=>{if(e.target===videoDialog)videoDialog.close();});
videoDialog.addEventListener('close',()=>{video.pause();video.currentTime=0;});
const form=$('#bookingForm'),pkg=$('#rentalPackage'),pickup=$('#pickup'),dropoff=$('#dropoff');
const today=new Date();const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
pickup.min=localDate(today);dropoff.min=pickup.min;
pickup.addEventListener('change',()=>{dropoff.min=pickup.value||localDate(today);if(dropoff.value&&dropoff.value<pickup.value)dropoff.value=pickup.value;});
$$('.price-select').forEach(btn=>btn.addEventListener('click',()=>{pkg.value=btn.dataset.package;$('#dat-xe').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});pkg.focus({preventScroll:true});}));
let latestMessage='';
form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;if(dropoff.value<pickup.value){dropoff.setCustomValidity('Ngày trả cần bằng hoặc sau ngày nhận xe');dropoff.reportValidity();return;}dropoff.setCustomValidity('');const packageName=pkg.value==='standard'?'400 km/ngày – 1.200.000đ/ngày':'Không giới hạn km – 1.400.000đ/ngày';latestMessage=["Chào Thuận/Ngọc, tôi muốn hỏi lịch thuê KIA K5 Premium 2.0.",`Họ tên: ${$('#fullName').value.trim()}`,`SĐT: ${$('#phone').value.trim()}`,`Gói thuê: ${packageName}`,`Ngày nhận: ${pickup.value}`,`Ngày trả: ${dropoff.value}`,`Điểm nhận / ghi chú: ${$('#location').value.trim()||'Chưa xác định'}`,"Nhờ bạn kiểm tra lịch, báo giá cuối cùng và hướng dẫn thủ tục giúp tôi. Cảm ơn!"].join('\n');$('#bookingMessage').textContent=latestMessage;$('#bookingResult').hidden=false;$('#bookingResult').scrollIntoView({behavior:'smooth',block:'nearest'});});
dropoff.addEventListener('input',()=>dropoff.setCustomValidity(''));
$('#copyMessage').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(latestMessage);$('#copyStatus').textContent='Đã sao chép! Mở Zalo và dán tin nhắn để gửi.';}catch{const range=document.createRange();range.selectNodeContents($('#bookingMessage'));getSelection().removeAllRanges();getSelection().addRange(range);$('#copyStatus').textContent='Hãy nhấn Ctrl+C (hoặc Sao chép) để lấy nội dung đang được chọn.';}});
$('#backTop').addEventListener('click',e=>{e.preventDefault();scrollTo({top:0,behavior:'instant'});});
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const elements=$$('[data-reveal]');elements.forEach(el=>el.classList.add('before-reveal'));const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');io.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px 70px 0px'});elements.forEach(el=>io.observe(el));setTimeout(()=>elements.forEach(el=>el.classList.add('revealed')),5000);}
