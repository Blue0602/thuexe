/* Keep mobile chat input and send button above the virtual keyboard. */
(() => {
 'use strict';
 const widget=document.getElementById('vf3-ai-widget');
 if(!widget || widget.dataset.mobileFix==='1')return;
 widget.dataset.mobileFix='1';
 const css=document.createElement('link');
 css.rel='stylesheet';css.href='/assets/ai-chat/chat-mobile-fix.css?v=1';document.head.appendChild(css);
 const input=widget.querySelector('#vf3-ai-input');
 const form=widget.querySelector('#vf3-ai-form');
 const feed=widget.querySelector('#vf3-ai-feed');
 const mobile=window.matchMedia('(max-width:720px)');
 const vv=window.visualViewport;
 let maxHeight=vv?.height||window.innerHeight, scheduled=false;
 function sync(){
  scheduled=false;
  const opened=widget.dataset.open==='true';
  document.body.classList.toggle('vf3-ai-mobile-open',opened&&mobile.matches);
  if(!mobile.matches){
   widget.dataset.keyboard='false';
   widget.style.removeProperty('--vf3-visual-height');
   widget.style.removeProperty('--vf3-visual-top');
   return;
  }
  const height=Math.max(120,vv?.height||window.innerHeight);
  const top=Math.max(0,vv?.offsetTop||0);
  if(document.activeElement!==input && height>maxHeight)maxHeight=height;
  widget.style.setProperty('--vf3-visual-height',Math.round(height)+'px');
  widget.style.setProperty('--vf3-visual-top',Math.round(top)+'px');
  widget.dataset.keyboard=String(document.activeElement===input && height<maxHeight-110);
 }
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(sync)}
 input?.addEventListener('focus',()=>{
  schedule();setTimeout(()=>{sync();feed.scrollTop=feed.scrollHeight},250)
 });
 input?.addEventListener('blur',()=>{schedule();setTimeout(sync,200)});
 form?.addEventListener('submit',()=>{
  if(mobile.matches)input.blur();
  schedule();
 },true);
 const observer=new MutationObserver(schedule);
 observer.observe(widget,{attributes:true,attributeFilter:['data-open']});
 vv?.addEventListener('resize',schedule);
 vv?.addEventListener('scroll',schedule);
 window.addEventListener('resize',schedule);
 window.addEventListener('orientationchange',()=>{maxHeight=0;setTimeout(sync,350)});
 window.addEventListener('pageshow',schedule);
 sync();
})();