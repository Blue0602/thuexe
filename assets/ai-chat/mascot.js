/* VF3 Click phase 1: expressive mascot controller. No AI, secrets or payment logic. */
(function () {
  'use strict';
  var moods = ['idle', 'welcome', 'plead', 'thinking', 'happy', 'sad'];
  var instances = new WeakMap();
  function mount(host, config) {
    if (!host || typeof host.appendChild !== 'function') throw new TypeError('Mascot container required');
    if (instances.has(host)) return instances.get(host);
    var base = ((config && config.assetBase) || '/assets/ai-chat/mascot/').replace(/\/?$/, '/');
    host.classList.add('vf3-mascot');
    host.dataset.mood = moods.includes(config && config.mood) ? config.mood : 'idle';
    host.dataset.speaking = '0';
    host.dataset.blink = '0';
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', 'Hamster đeo tai nghe lái xe VinFast VF3, trợ lý tư vấn Thuê VF3 Click');
    host.innerHTML = '<div class="vf3-mascot-car-wrap">' +
      '<img class="vf3-mascot-layer" src="' + base + 'car-base.webp" alt="" draggable="false">' +
      '<div class="vf3-mascot-head">' +
        '<img class="vf3-mascot-layer" src="' + base + 'hamster-head.webp" alt="" draggable="false">' +
        '<img class="vf3-mascot-layer vf3-mascot-eyes" src="' + base + 'blink-skin.webp" alt="" draggable="false">' +
        '<svg class="vf3-mascot-layer" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<g class="vf3-mascot-lids" fill="none" stroke="#916137" stroke-width="5" stroke-linecap="round">' +
            '<path d="M447 267 Q466 277 488 267"/><path d="M578 264 Q606 275 631 262"/>' +
          '</g>' +
          '<g class="vf3-mascot-speech-mouth">' +
            '<ellipse cx="534" cy="351" rx="17" ry="14" fill="#4c101b"/>' +
            '<ellipse cx="534" cy="359" rx="11" ry="5" fill="#fa7888"/>' +
          '</g>' +
        '</svg>' +
      '</div>' +
    '</div><span class="vf3-mascot-sparkle vf3-mascot-sparkle--left" aria-hidden="true">✦</span>' +
    '<span class="vf3-mascot-sparkle vf3-mascot-sparkle--right" aria-hidden="true">✧</span>' +
    '<span class="vf3-mascot-thought" aria-hidden="true">•••</span>';
    var dead = false, blinkTimer, talkTimer, resetTimer;
    function blink() {
      if (dead) return;
      host.dataset.blink = '1';
      setTimeout(function () { if (!dead) host.dataset.blink = '0'; }, 180);
    }
    function scheduleBlink() {
      if (dead) return;
      var delay = host.dataset.mood === 'plead' ? 1750 + Math.random()*1100 : 2900 + Math.random()*3100;
      blinkTimer = setTimeout(function () {
        blink();
        if (host.dataset.mood === 'plead') setTimeout(blink, 420);
        scheduleBlink();
      }, delay);
    }
    scheduleBlink();
    var api = {
      setMood: function (mood) { if (!dead && moods.includes(mood)) host.dataset.mood = mood; return api; },
      setSpeaking: function (on) { if (!dead) host.dataset.speaking = on ? '1' : '0'; return api; },
      blink: function () { blink(); return api; },
      previewTalk: function (duration) {
        if (dead) return api;
        clearTimeout(talkTimer);
        api.setSpeaking(true);
        talkTimer = setTimeout(function () { api.setSpeaking(false); blink(); }, Math.min(Math.max(Number(duration)||2100,200),12000));
        return api;
      },
      react: function (mood, duration) {
        api.setMood(mood);
        clearTimeout(resetTimer);
        if (duration) resetTimer = setTimeout(function () { api.setMood('idle'); }, duration);
        return api;
      },
      destroy: function () {
        dead = true; clearTimeout(blinkTimer); clearTimeout(talkTimer); clearTimeout(resetTimer);
        host.innerHTML = ''; instances.delete(host);
      }
    };
    instances.set(host, api);
    return api;
  }
  window.VF3Mascot = {mount: mount, moods: moods.slice()};
})();