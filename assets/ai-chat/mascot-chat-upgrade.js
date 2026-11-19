/* VF3 Click — live mascot dock for chat V4 Ultimate (reads authoritative backend mood).
   Place after chat-widget.js. Safe if widget / image layers load later. */
(() => {
  'use strict';
  if (window.__VF3_MASCOT_CHAT_UPGRADE__) return;
  window.__VF3_MASCOT_CHAT_UPGRADE__ = true;

  const STYLE_URL = '/assets/ai-chat/mascot-chat-upgrade.css?v=4';
  const AVATAR_PATH = '/assets/ai-chat/mascot/hamster-head.webp';
  const VALID_MOODS = new Set(['idle', 'welcome', 'plead', 'thinking', 'happy', 'sad']);

  if (!document.querySelector('link[href*="/assets/ai-chat/mascot-chat-upgrade.css"]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = STYLE_URL;
    document.head.appendChild(css);
  }

  const statusByMood = {
    welcome: ['👋', 'Bé Click sẵn sàng!', 'Hỏi bé lịch xe VF3, VF8, KIA K5 hoặc tán gẫu nha!'],
    plead: ['🥹', 'Bé hỏi thêm xíu nha', 'Cho bé thêm chút thông tin để soi lịch thật chuẩn ạ.'],
    thinking: ['🤔', 'Bé đang soi lịch…', 'Chờ bé vài giây kiểm tra dữ liệu hệ thống nha.'],
    happy: ['🥳', 'Có tín hiệu ngon lành!', 'Bé vừa trả lời ngay bên dưới, mình xem nhé!'],
    sad: ['🥺', 'Tiếc quá đi…', 'Mình thử đổi ngày hoặc dòng xe khác với bé nha.'],
    idle: ['😊', 'Bé vẫn trực ở đây nè', 'Cần hỏi thêm gì cứ nhắn bé bất cứ lúc nào!']
  };

  function inferMoodFallback(text) {
    const content = String(text || '').toLocaleLowerCase('vi-VN');
    if (/chưa ghi nhận lịch bận|tín hiệu ngon lành|đúng bài|tin vui|còn kha khá ngày đẹp|kèo .* đẹp/.test(content)) return 'happy';
    if (/tiếc quá|hết xe|hết lịch|bị khóa lịch|khóa cả ngày|kín lịch|gián đoạn|chưa trả lời tự động|bất tiện/.test(content)) return 'sad';
    if (/ngày nào|giờ nào|mấy giờ|cho bé xin|mình dự kiến|chọn lại|đã qua/.test(content) && /\?/.test(content)) return 'plead';
    return 'welcome';
  }

  function badgeName(mood) {
    if (mood === 'sad') return '🥺 Bé Click';
    if (mood === 'plead') return '🥹 Bé Click';
    if (mood === 'happy') return '🥳 Bé Click';
    return '🐹 Bé Click';
  }

  function install() {
    const widget = document.getElementById('vf3-ai-widget');
    if (!widget || widget.dataset.mascotChatUpgrade === '1') return false;
    const panel = widget.querySelector('#vf3-ai-panel');
    const feed = widget.querySelector('#vf3-ai-feed');
    const stage = widget.querySelector('.vf3-ai-mascot-stage');
    if (!panel || !feed || !stage || !window.VF3Mascot) return false;

    widget.dataset.mascotChatUpgrade = '1';
    const dock = document.createElement('div');
    dock.className = 'vf3-ai-mascot-dock';
    dock.setAttribute('aria-label', 'Biểu cảm trực tiếp của Bé Click');
    dock.innerHTML = [
      '<div class="vf3-ai-mascot-copy">',
      '<span class="vf3-ai-mascot-eyebrow">TRỢ LÝ BÉ CLICK</span>',
      '<strong class="vf3-ai-mascot-status" aria-live="polite">👋 Bé Click sẵn sàng!</strong>',
      '<small class="vf3-ai-mascot-hint">Hỏi bé lịch xe VF3, VF8, KIA K5 hoặc tán gẫu nha!</small>',
      '</div>',
      '<span class="vf3-ai-mascot-live" aria-hidden="true"></span>'
    ].join('');
    panel.insertBefore(dock, feed);
    dock.prepend(stage);

    const mascot = window.VF3Mascot.mount(stage);
    const stateTitle = dock.querySelector('.vf3-ai-mascot-status');
    const hint = dock.querySelector('.vf3-ai-mascot-hint');
    const liveDot = dock.querySelector('.vf3-ai-mascot-live');
    let lastProcessed = null;
    let idleTimer = 0;
    let updatePending = false;
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function displayMood() {
      const mood = stage.dataset.mood || 'idle';
      const [emoji, label, details] = statusByMood[mood] || statusByMood.idle;
      const speaking = stage.dataset.speaking === '1';
      stateTitle.textContent = emoji + ' ' + (speaking ? 'Bé đang trả lời…' : label);
      hint.textContent = speaking ? 'Chuyển động minh họa theo nội dung phản hồi.' : details;
      dock.dataset.mood = mood;
      liveDot.dataset.speaking = speaking ? '1' : '0';
    }

    function decorate() {
      const messages = feed.querySelectorAll('.vf3-ai-message--bot:not([data-mascot-decorated])');
      for (const bubble of messages) {
        bubble.dataset.mascotDecorated = '1';
        const row = document.createElement('div');
        row.className = 'vf3-ai-bot-row';
        const avatar = document.createElement('span');
        avatar.className = 'vf3-ai-bot-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        const img = document.createElement('img');
        img.src = AVATAR_PATH;
        img.alt = '';
        img.loading = 'lazy';
        avatar.appendChild(img);
        const body = document.createElement('div');
        body.className = 'vf3-ai-bot-body';
        const name = document.createElement('span');
        name.className = 'vf3-ai-bot-name';
        name.textContent = '🐹 Bé Click';
        const parent = bubble.parentElement;
        if (!parent) continue;
        parent.insertBefore(row, bubble);
        body.append(name, bubble);
        row.append(avatar, body);
      }
    }

    function updateConversationState() {
      updatePending = false;
      decorate();
      const pending = feed.querySelector('.vf3-ai-message--bot.vf3-ai-typing');
      if (pending) {
        window.clearTimeout(idleTimer);
        if (stage.dataset.mood !== 'thinking') mascot.setMood('thinking');
        displayMood();
        return;
      }
      const botMessages = feed.querySelectorAll('.vf3-ai-message--bot');
      const lastBot = botMessages[botMessages.length - 1];
      if (!lastBot || lastBot === lastProcessed || !lastBot.textContent.trim()) {
        displayMood();
        return;
      }
      if (botMessages.length === 1) {
        lastProcessed = lastBot;
        displayMood();
        return;
      }
      lastProcessed = lastBot;

      // Priority 1: Authoritative backend mood passed from chat-widget.js
      const serverMood = lastBot.dataset.serverMood;
      const mood = VALID_MOODS.has(serverMood) ? serverMood : inferMoodFallback(lastBot.textContent.trim());

      if (stage.dataset.mood !== mood) mascot.setMood(mood);
      const row = lastBot.closest('.vf3-ai-bot-row');
      if (row) {
        row.dataset.mood = mood;
        const name = row.querySelector('.vf3-ai-bot-name');
        if (name) name.textContent = badgeName(mood);
      }
      displayMood();

      window.clearTimeout(idleTimer);
      if (!prefersReduced) {
        idleTimer = window.setTimeout(() => {
          if (!feed.querySelector('.vf3-ai-typing') && stage.dataset.speaking !== '1') {
            mascot.setMood('idle');
            displayMood();
          }
        }, 7000);
      }
    }

    function scheduleStateUpdate() {
      if (updatePending) return;
      updatePending = true;
      window.requestAnimationFrame(updateConversationState);
    }

    const messagesObserver = new MutationObserver(scheduleStateUpdate);
    messagesObserver.observe(feed, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-server-mood'] });
    const mascotObserver = new MutationObserver(displayMood);
    mascotObserver.observe(stage, { attributes: true, attributeFilter: ['data-mood', 'data-speaking'] });
    decorate();
    displayMood();
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', install, { once: true });
  }
})();