/* VF3 Click Mascot Motion Rig v2.0 — standalone, no API / payments. */
(function () {
  'use strict';
  const MOODS = Object.freeze(['idle','welcome','plead','thinking','happy','sad']);
  const INSTANCES = new WeakMap();
  const random = (min,max) => min + Math.random() * (max-min);
  const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
  const motionOff = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const smile = '<path class="vf3-brow" d="M255 130 Q271 124 289 132 M336 131 Q355 123 370 130"/>';
  // All art uses the SAME 600x600 coordinate system; don't use viewport coordinates for face features.
  const faceSVG = `
    <svg class="vf3-face" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g class="vf3-face-welcome">${smile}</g>
      <g class="vf3-face-plead">
        <path class="vf3-brow" d="M252 138 Q272 126 291 133 M334 133 Q355 125 374 138"/>
        <ellipse class="vf3-cheek" cx="248" cy="188" rx="13" ry="7"/>
        <ellipse class="vf3-cheek" cx="380" cy="185" rx="12" ry="7"/>
      </g>
      <g class="vf3-face-think">
        <path class="vf3-brow" d="M254 132 Q273 124 289 132 M333 125 Q354 111 373 125"/>
        <path class="vf3-think-lid" d="M256 145 Q271 140 285 144"/>
      </g>
      <g class="vf3-face-happy">
        <path class="vf3-happy-eye" d="M254 159 Q271 141 290 159"/>
        <path class="vf3-happy-eye" d="M333 158 Q353 139 373 157"/>
        <path class="vf3-brow" d="M256 134 Q270 127 288 135 M336 134 Q354 126 371 134"/>
        <ellipse class="vf3-cheek vf3-happy-cheek" cx="245" cy="185" rx="15" ry="9"/>
        <ellipse class="vf3-cheek vf3-happy-cheek" cx="379" cy="183" rx="14" ry="9"/>
      </g>
      <g class="vf3-face-sad">
        <path class="vf3-sad-brow" d="M252 135 Q270 133 290 122 M336 122 Q354 133 374 135" />
        <path class="vf3-sad-eye" d="M254 156 Q272 168 289 155"/>
        <path class="vf3-sad-eye" d="M333 155 Q352 168 373 155"/>
        <path class="vf3-sad-frown" d="M295 211 Q307 198 320 211"/>
        <path class="vf3-tear" d="M250 169 C248 176 242 181 242 187 C242 195 257 195 258 187 C258 181 253 174 250 169 Z"/>
        <path class="vf3-tear vf3-tear-second" d="M377 168 C374 176 371 182 371 186 C371 194 384 194 385 187 C385 181 380 174 377 168 Z"/>
        <path class="vf3-tear-glint" d="M247 184 L248 181 M376 183 L376 181"/>
      </g>
      <g class="vf3-face-blink">
        <path class="vf3-blink-line" d="M254 157 Q272 164 289 157 M334 156 Q353 163 373 156"/>
      </g>
      <g class="vf3-face-talk">
        <ellipse class="vf3-viseme vf3-viseme-o" cx="307" cy="208" rx="8" ry="12" />
        <ellipse class="vf3-viseme vf3-viseme-a" cx="307" cy="209" rx="12" ry="9" />
        <path class="vf3-viseme vf3-viseme-e" d="M295 208 Q307 220 319 208 Z"/>
        <ellipse class="vf3-mouth-tongue" cx="307" cy="216" rx="6" ry="2.4"/>
        <path class="vf3-viseme-rest" d="M298 209 Q307 214 316 209"/>
      </g>
    </svg>`;

  function mount(host, options = {}) {
    if (!host || typeof host.appendChild !== 'function') throw new TypeError('VF3Mascot.mount requires an element');
    if (INSTANCES.has(host)) return INSTANCES.get(host);
    let base = String(options.assetBase || '/assets/ai-chat/mascot/');
    if (!base.endsWith('/')) base += '/';
    // Asset path should be code-controlled and never derived from customer messages.
    host.classList.add('vf3-mascot');
    host.setAttribute('role','img');
    host.setAttribute('aria-label','Trợ lý hamster lái xe VF3 đang biểu cảm');
    host.dataset.mood = MOODS.includes(options.mood) ? options.mood : 'idle';
    host.dataset.blink = '0';
    host.dataset.gaze = 'center';
    host.dataset.speaking = '0';
    host.dataset.viseme = 'rest';
    host.dataset.ear = 'rest';
    host.innerHTML = `
      <div class="vf3-ground-shadow" aria-hidden="true"></div>
      <div class="vf3-car-motion">
        <img class="vf3-art vf3-car" src="${base}car-base.webp" alt="" draggable="false">
        <span class="vf3-led vf3-led-left"></span><span class="vf3-led vf3-led-right"></span>
        <img class="vf3-art vf3-hand" src="${base}hand-wave.webp" alt="" draggable="false">
        <div class="vf3-head-motion">
          <div class="vf3-breath">
            <img class="vf3-art vf3-ear vf3-ear-left" src="${base}ear-left.webp" alt="" draggable="false">
            <img class="vf3-art vf3-ear vf3-ear-right" src="${base}ear-right.webp" alt="" draggable="false">
            <img class="vf3-art vf3-head-core" src="${base}head-core.webp" alt="" draggable="false">
            <img class="vf3-art vf3-eye-skin" src="${base}blink-skin.webp" alt="" draggable="false">
            <img class="vf3-art vf3-eye-sprite vf3-eye-left" src="${base}eye-left.webp" alt="" draggable="false">
            <img class="vf3-art vf3-eye-sprite vf3-eye-right" src="${base}eye-right.webp" alt="" draggable="false">
            <img class="vf3-art vf3-mouth-skin" src="${base}mouth-restored.webp" alt="" draggable="false">
            ${faceSVG}
          </div>
        </div>
      </div>
      <div class="vf3-sparks" aria-hidden="true">
        <i>✦</i><i>♥</i><i>✧</i><i>✦</i><i>♥</i><i>✧</i>
      </div>
      <div class="vf3-thought" aria-hidden="true"><i></i><i></i><i></i></div>
      <span class="vf3-sigh" aria-hidden="true">haiz…</span>`;
    let alive = true;
    let blinkTimer=0, blinkRelease=0, microTimer=0, microRelease=0, speechTimer=0, talkStep=0, entranceTimer=0, reactionTimer=0;
    let soundEnabled = !!options.soundEnabled;
    let audioCtx = null;
    const timers = new Set();
    const later=(fn,ms)=>{
      const id=setTimeout(()=>{timers.delete(id); if(alive) fn();},ms);
      timers.add(id); return id;
    };
    function cancel(id){if(id){clearTimeout(id);timers.delete(id);}return 0;}
    function blink(){
      if(!alive || host.dataset.mood==='sad' || host.dataset.mood==='happy')return api;
      host.dataset.blink='1';
      blinkRelease=cancel(blinkRelease);
      blinkRelease=later(()=>{host.dataset.blink='0';blinkRelease=0;},135);
      return api;
    }
    function blinkCycle(){
      blinkTimer=cancel(blinkTimer);
      blinkTimer=later(()=>{
        blink();
        if(host.dataset.mood==='plead')later(()=>blink(),340);
        blinkCycle();
      },random(3050,4050));
    }
    function microCycle(){
      microTimer=cancel(microTimer);
      microTimer=later(()=>{
        const mood=host.dataset.mood;
        if(mood==='idle'||mood==='welcome'||mood==='plead'){
          const look=['left','right','up-left','center'];
          host.dataset.gaze=look[Math.floor(Math.random()*look.length)];
          host.dataset.ear=Math.random()>.48?'left':'right';
          microRelease=cancel(microRelease);
          microRelease=later(()=>{host.dataset.gaze='center';host.dataset.ear='rest';microRelease=0;},750);
        }else if(mood==='thinking'){
          host.dataset.gaze='up-right';host.dataset.ear='right';
          microRelease=cancel(microRelease);
          microRelease=later(()=>{host.dataset.ear='rest';microRelease=0;},610);
        }else if(mood==='sad'){
          // Small shoulder tremor, once in a while, not an endless bob.
          host.classList.remove('vf3-sob'); void host.offsetWidth;host.classList.add('vf3-sob');
          later(()=>host.classList.remove('vf3-sob'),720);
        }
        microCycle();
      },random(3700,6500));
    }
    function playSigh(){
      if(!soundEnabled || motionOff() || !alive) return;
      try {
        const Ctx=window.AudioContext||window.webkitAudioContext;
        if(!Ctx) return;
        audioCtx=audioCtx || new Ctx();
        if(audioCtx.state==='suspended') audioCtx.resume().catch(()=>{});
        const sampleRate=audioCtx.sampleRate;
        const length=Math.round(sampleRate*.7);
        const buffer=audioCtx.createBuffer(1,length,sampleRate);
        const a=buffer.getChannelData(0);
        for(let i=0;i<length;i++)a[i]=(Math.random()*2-1)*(.6+.4*Math.sin(2*Math.PI*i/length));
        const noise=audioCtx.createBufferSource();noise.buffer=buffer;
        const filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=700;
        const gain=audioCtx.createGain();const now=audioCtx.currentTime;
        gain.gain.setValueAtTime(.0001,now);
        gain.gain.exponentialRampToValueAtTime(.035,now+.14);
        gain.gain.exponentialRampToValueAtTime(.0001,now+.7);
        noise.connect(filter).connect(gain).connect(audioCtx.destination);
        noise.start(now);noise.stop(now+.7);
      } catch(_) { /* Sound is optional and browser-dependent. */ }
    }
    function setMood(mood){
      if(!alive||!MOODS.includes(mood))return api;
      entranceTimer=cancel(entranceTimer);
      reactionTimer=cancel(reactionTimer);
      microRelease=cancel(microRelease);
      host.classList.remove('vf3-enter','vf3-sob');
      host.dataset.ear='rest';host.dataset.gaze=mood==='thinking'?'up-right':'center';
      host.dataset.blink='0';
      host.dataset.mood=mood;
      if(!motionOff()){
        void host.offsetWidth;
        host.classList.add('vf3-enter');
        entranceTimer=later(()=>{host.classList.remove('vf3-enter');entranceTimer=0;},mood==='happy'?1600:1250);
      }
      // Only click / user input can cause audio. Never autoplay on mount.
      if(mood==='sad')playSigh();
      return api;
    }
    function endSpeaking(){
      speechTimer=cancel(speechTimer);talkStep=cancel(talkStep);
      host.dataset.speaking='0';host.dataset.viseme='rest';
    }
    const syllables=['a','e','rest','o','a','rest','e','o','rest','a'];
    function talkLoop(index=0){
      if(!alive||host.dataset.speaking!=='1')return;
      host.dataset.viseme=syllables[index%syllables.length];
      talkStep=later(()=>talkLoop(index+1),random(100,190));
    }
    function setSpeaking(value){
      if(!alive)return api;
      endSpeaking();
      if(value){host.dataset.speaking='1';talkLoop(0);}
      else{blink();}
      return api;
    }
    function previewTalk(milliseconds=2400){
      api.setSpeaking(true);
      speechTimer=later(()=>api.setSpeaking(false),clamp(Number(milliseconds)||2400,200,12000));
      return api;
    }
    function react(mood,duration=0){
      setMood(mood);
      if(duration>0){reactionTimer=later(()=>{reactionTimer=0;setMood('idle');},duration);}
      return api;
    }
    function setSoundEnabled(value){soundEnabled=!!value;return api;}
    function destroy(){
      if(!alive)return;
      alive=false;
      for(const t of timers)clearTimeout(t);timers.clear();
      host.innerHTML='';host.classList.remove('vf3-mascot','vf3-enter','vf3-sob');
      INSTANCES.delete(host);
      if(audioCtx && typeof audioCtx.close==='function')audioCtx.close().catch(()=>{});
    }
    const api={setMood,setSpeaking,previewTalk,react,blink,setSoundEnabled,destroy};
    INSTANCES.set(host,api);
    blinkCycle();microCycle();
    return api;
  }
  window.VF3Mascot={mount,moods:MOODS.slice(),version:'2.0.0'};
})();
