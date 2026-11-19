/* VF3 Click — live mascot dock for chat (add-on, no API / DB changes).
   Place after chat-widget.js. Safe if widget / image layers load later. */
(() => {
  'use strict';
  if (window.__VF3_MASCOT_CHAT_UPGRADE__) return;
  window.__VF3_MASCOT_CHAT_UPGRADE__ = true;

  // V4: Enrich only the existing website chatbot request with last 8 turns.
  // This is conversational context, NOT authority for pricing / D1 bookings.
  if (!window.__VF3_V4_CHAT_HISTORY__) {
    window.__VF3_V4_CHAT_HISTORY__ = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (resource, options) => {
      try {
        const url = typeof resource === 'string' ? resource : resource?.url || '';
        const target = new URL(url, window.location.href);
        if (target.pathname === '/api/ai/website'
          && target.hostname === 'thuevf3click-ai.hgpure2003.workers.dev'
          && String(options?.method || 'GET').toUpperCase() === 'POST'
          && typeof options?.body === 'string') {
          const data = JSON.parse(options.body);
          if (data?.channel === 'website' && typeof data.message === 'string') {
            const feed = document.querySelector('#vf3-ai-feed');
            const turns = Array.from(feed?.querySelectorAll('.vf3-ai-message') || [])
              .filter(el => !el.classList.contains('vf3-ai-typing'))
              .map(el => ({
                role: el.classList.contains('vf3-ai-message--user') ? 'user' : 'assistant',
                text: String(el.textContent || '').slice(0, 260)
              }))
              .filter(x => x.text.trim().length > 0);
            if (turns.length && turns[turns.length - 1].role === 'user'
              && turns[turns.length - 1].text.trim() === data.message.trim()) turns.pop();
            data.history = turns.slice(-16);
            return originalFetch(resource, {...options, body: JSON.stringify(data)});
          }
        }
      } catch (_) { /* Original request remains intact. */ }
      return originalFetch(resource, options);
    };
  }

  const STYLE_URL = '/assets/ai-chat/mascot-chat-upgrade.css?v=2';
  const path = '/assets/ai-chat/mascot/hamster-head.webp';
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = STYLE_URL;
  document.head.appendChild(css);

  const statusByMood = {
    welcome: ['👋', 'Sẵn sàng tư vấn', 'Mình cứ hỏi em về VF3, VF8 hoặc KIA K5 nhé!'],
    plead: ['🥹', 'Đang hỏi mình một chút', 'Em cần thêm một chi tiết để tư vấn chính xác ạ.'],
    thinking: ['🤔', 'Đang tìm thông tin…', 'Em đang kiểm tra câu hỏi của mình.'],
    happy: ['🥳', 'Đã có thông tin rồi!', 'Em vừa trả lời, mình xem tin nhắn ngay bên dưới nhé.'],
    sad: ['🥺', 'Tiếc quá…', 'Mình có thể chọn phương án hoặc lịch thuê khác ạ.'],
    idle: ['😊', 'Em vẫn ở đây nhé', 'Mình cần hỏi thêm gì, cứ nhắn em ạ.']
  };

  function inferMood(text) {
    const content = String(text || '').toLocaleLowerCase('vi-VN');
    // Only specific unavailability phrases, not generic "không" / "chưa".
    if (/tiếc quá|hết xe|hết lịch|hết chỗ|lịch (?:đã )?kín|không còn (?:xe |lịch |ngày )?trống|không có xe trống|đã có khách thuê|không còn xe|không khả dụng|đã được thuê|đã được đặt/.test(content)) return 'sad';
    if (/ngày nào|giờ nào|mấy giờ|cho em (?:xin|biết)|mình dự kiến|anh\/chị (?:muốn|dự kiến)|mình có thể cho em/.test(content) && /\?/.test(content)) return 'plead';
    if (/tuyệt quá|rất vui|thành công|còn lịch trống|đã tìm thấy|cảm ơn mình/.test(content)) return 'happy';
    return 'welcome';
  }

  function install() {
    const widget = document.getElementById('vf3-ai-widget');
    if (!widget || widget.dataset.mascotChatUpgrade === '1') return false;
    const panel = widget.querySelector('#vf3-ai-panel');
    const feed = widget.querySelector('#vf3-ai-feed');
    const stage = widget.querySelector('.vf3-ai-mascot-stage');
    if (!panel || !feed || !stage || !window.VF3Mascot) return false;

    widget.dataset.mascotChatUpgrade = '1';
    // KEEP the mascot outside the scrolling feed, but inside the chat window.
    const dock = document.createElement('div');
    dock.className = 'vf3-ai-mascot-dock';
    dock.setAttribute('aria-label', 'Biểu cảm trực tiếp của trợ lý VF3 Click');
    dock.innerHTML = [
      '<div class="vf3-ai-mascot-copy">',
      '<span class="vf3-ai-mascot-eyebrow">TRỢ LÝ HAMSTER VF3</span>',
      '<strong class="vf3-ai-mascot-status" aria-live="polite">👋 Sẵn sàng tư vấn</strong>',
      '<small class="vf3-ai-mascot-hint">Mình cứ hỏi em về VF3, VF8 hoặc KIA K5 nhé!</small>',
      '</div>',
      '<span class="vf3-ai-mascot-live" aria-hidden="true"></span>'
    ].join('');
    panel.insertBefore(dock, feed);
    dock.prepend(stage); // move the EXISTING animated mascot, don't create a second one

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
      stateTitle.textContent = emoji + ' ' + (speaking ? 'Đang diễn đạt câu trả lời…' : label);
      hint.textContent = speaking ? 'Miệng chuyển động minh họa theo nội dung chat; chưa phát giọng nói.' : details;
      dock.dataset.mood = mood;
      liveDot.dataset.speaking = speaking ? '1' : '0';
    }

    // Bot message row, keeping original bubble element so loading updates still work.
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
        img.src = path;
        img.alt = '';
        img.loading = 'lazy';
        avatar.appendChild(img);
        const body = document.createElement('div');
        body.className = 'vf3-ai-bot-body';
        const name = document.createElement('span');
        name.className = 'vf3-ai-bot-name';
        name.textContent = '🐹 Bé Click · Trợ lý tư vấn';
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
        // The original chat-widget already does setMood('thinking').
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
      // The first greeting is not an AI API reply; don't trigger an extra reaction.
      if (botMessages.length === 1) {
        lastProcessed = lastBot;
        displayMood();
        return;
      }
      lastProcessed = lastBot;
      const text = lastBot.textContent.trim();
      // Emotion from the D1-backed Worker is authoritative; text inference is fallback.
      let mood = ["welcome","plead","thinking","happy","sad","idle"].includes(lastBot.dataset.mood)
        ? lastBot.dataset.mood : inferMood(text);
      if (/kết nối tư vấn ai đang gián đoạn|chưa thể trả lời tự động/.test(text.toLocaleLowerCase('vi-VN'))) mood = 'sad';
      mascot.setMood(mood);
      const row = lastBot.closest('.vf3-ai-bot-row');
      if (row) {
        row.dataset.mood = mood;
        const name = row.querySelector('.vf3-ai-bot-name');
        if (name) name.textContent = mood === 'sad' ? '🥺 Bé Click' : mood === 'plead' ? '🥹 Bé Click' : mood === 'happy' ? '🥳 Bé Click' : '🐹 Bé Click';
      }
      displayMood();
      // Return to blinking, calm idle after showing the reaction; don't interrupt next user turn.
      window.clearTimeout(idleTimer);
      if (!prefersReduced) idleTimer = window.setTimeout(() => {
        if (!feed.querySelector('.vf3-ai-typing') && stage.dataset.speaking !== '1') {
          mascot.setMood('idle');
          displayMood();
        }
      }, 6500);
    }

    function scheduleStateUpdate() {
      if (updatePending) return;
      updatePending = true;
      window.requestAnimationFrame(updateConversationState);
    }
    const messagesObserver = new MutationObserver(scheduleStateUpdate);
    messagesObserver.observe(feed, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-mood']});
    const mascotObserver = new MutationObserver(displayMood);
    mascotObserver.observe(stage, { attributes: true, attributeFilter: ['data-mood', 'data-speaking'] });
    decorate();
    displayMood();
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.documentElement, {childList: true, subtree: true});
    window.addEventListener('load', install, {once:true});
  }
})();
