/* Thuê VF3 Click — AI assistant V4 Ultimate. Front-end only; no API key belongs in browser code. */
(() => {
  "use strict";
  if (document.getElementById("vf3-ai-widget")) return;

  const SETTINGS = window.VF3_CHAT_CONFIG || {};
  const API = SETTINGS.endpoint || "https://thuevf3click-ai.hgpure2003.workers.dev/api/ai/website";
  const CHANNEL = SETTINGS.channel || "website";
  const DRAFT_KEY = "vf3click_ai_draft_v4";
  const HISTORY_LIMIT = 16;
  const VALID_MOODS = new Set(["idle", "welcome", "plead", "thinking", "happy", "sad"]);

  const root = document.createElement("aside");
  root.id = "vf3-ai-widget";
  root.setAttribute("aria-label", "Trợ lý thuê xe VF3 Click");
  root.dataset.open = "false";

  if (!document.querySelector('link[href*="/assets/ai-chat/chat-widget.css"]')) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/assets/ai-chat/chat-widget.css?v=4";
    document.head.appendChild(css);
  }

  root.innerHTML = [
    '<div class="vf3-ai-teaser" id="vf3-ai-teaser">',
    '<button class="vf3-ai-teaser-close" type="button" aria-label="Ẩn lời chào">×</button>',
    '<strong>🐹 Bé Click có mặt!</strong>',
    '<p>Hôm nay anh/chị muốn soi lịch hay thuê xe nào ạ? Chạm vào bé nhé!</p></div>',
    '<section class="vf3-ai-panel" id="vf3-ai-panel" role="dialog" aria-label="Trò chuyện với Bé Click — Trợ lý AI VF3 Click" aria-hidden="true">',
    '<div class="vf3-ai-head"><span class="vf3-ai-head-logo">',
    '<img src="/trang-chu/images/logo-vf3.webp" alt="" width="45" height="45"></span>',
    '<span class="vf3-ai-head-copy"><strong>Bé Click · VF3 Assistant ✨</strong>',
    '<small>Trợ lý tư vấn xe tự động 24/7</small></span>',
    '<button class="vf3-ai-close" type="button" aria-label="Đóng trò chuyện">×</button></div>',
    '<div class="vf3-ai-feed" id="vf3-ai-feed" role="log" aria-live="polite" aria-relevant="additions text"></div>',
    '<div class="vf3-ai-actions" aria-label="Câu hỏi gợi ý">',
    '<button class="vf3-ai-chip" data-prompt="Em muốn thuê VF3 VIP" type="button">🚙 VF3 VIP</button>',
    '<button class="vf3-ai-chip" data-prompt="Em muốn thuê VF8 Plus" type="button">🚗 VF8 Plus</button>',
    '<button class="vf3-ai-chip" data-prompt="Giá thuê Kia K5 như thế nào?" type="button">✨ KIA K5</button>',
    '<button class="vf3-ai-chip" data-prompt="Tháng này VF3 còn ngày nào trống?" type="button">📅 Ngày trống</button>',
    '<button class="vf3-ai-chip" data-prompt="Cách đặt xe và đặt cọc?" type="button">💳 Cách đặt xe</button></div>',
    '<div class="vf3-ai-foot-links">',
    '<a href="/#lich-xe" class="vf3-ai-calendar-link">🗓 Xem lịch xe</a>',
    '<a href="https://zalo.me/0837892579" target="_blank" rel="noopener noreferrer">💬 Gặp tư vấn viên</a></div>',
    '<form class="vf3-ai-form" id="vf3-ai-form" novalidate>',
    '<input class="vf3-ai-input" id="vf3-ai-input" type="text" autocomplete="off" enterkeyhint="send" maxlength="350" aria-label="Nhập câu hỏi về thuê xe" placeholder="Nhắn cho Bé Click..." required>',
    '<button class="vf3-ai-send" type="submit" aria-label="Gửi tin nhắn">➤</button></form>',
    '<div class="vf3-ai-disclaimer">Lịch trống và đặt cọc chỉ được xác nhận bởi hệ thống đặt xe.</div>',
    '</section>',
    '<button class="vf3-ai-launcher" id="vf3-ai-launcher" type="button" aria-label="Mở trợ lý AI tư vấn thuê xe" aria-expanded="false" aria-controls="vf3-ai-panel">',
    '<img class="vf3-ai-car" src="/trang-chu/images/logo-vf3.webp" width="92" height="92" alt="">',
    '<span class="vf3-ai-face" aria-hidden="true">',
    '<span class="vf3-ai-eye vf3-ai-eye--left"></span>',
    '<span class="vf3-ai-eye vf3-ai-eye--right"></span>',
    '<span class="vf3-ai-smile"></span></span>',
    '<span class="vf3-ai-sparkle" aria-hidden="true">✦</span>',
    '<span class="vf3-ai-launcher-label">HỎI EM NÈ!</span></button>'
  ].join("");
  document.body.appendChild(root);

  const panel = root.querySelector("#vf3-ai-panel");
  const feed = root.querySelector("#vf3-ai-feed");
  const input = root.querySelector("#vf3-ai-input");
  const submit = root.querySelector(".vf3-ai-send");
  const launcher = root.querySelector("#vf3-ai-launcher");
  const teaser = root.querySelector("#vf3-ai-teaser");

  let busy = false;
  let lastSendAt = 0;
  let miniMascot = null;
  let launcherMascot = null;
  const chatHistory = [];

  const mascotStage = document.createElement("div");
  mascotStage.className = "vf3-ai-mascot-stage";
  const mascotButtonStage = document.createElement("div");
  mascotButtonStage.className = "vf3-ai-mascot-avatar";

  const preload = new Image();
  preload.onload = () => {
    if (!window.VF3Mascot) return;
    if (!mascotStage.parentElement) feed.prepend(mascotStage);
    launcher.prepend(mascotButtonStage);
    miniMascot = VF3Mascot.mount(mascotStage, { mood: "welcome" });
    launcherMascot = VF3Mascot.mount(mascotButtonStage, { mood: "idle" });
    launcher.classList.add("vf3-ai-mascot-ready");
  };
  preload.onerror = () => {};
  preload.src = "/assets/ai-chat/mascot/hamster-head.webp";

  function mascotMood(mood, speakFor) {
    const safeMood = VALID_MOODS.has(mood) ? mood : "welcome";
    if (miniMascot) {
      miniMascot.setMood(safeMood);
      if (speakFor) miniMascot.previewTalk(speakFor);
    }
    if (launcherMascot) {
      launcherMascot.setMood(safeMood === "thinking" ? "thinking" : "idle");
    }
  }

  function newId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + "-" + window.crypto.randomUUID();
    }
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  }

  function sessionId() {
    try {
      let id = sessionStorage.getItem("vf3click_ai_web_session");
      if (!id) {
        id = newId("vf3-web");
        sessionStorage.setItem("vf3click_ai_web_session", id);
      }
      return id;
    } catch {
      return newId("vf3-web");
    }
  }
  const conversationId = sessionId();

  // Restore unsent draft when reloading or reopening chat
  try {
    const savedDraft = sessionStorage.getItem(DRAFT_KEY);
    if (savedDraft) input.value = savedDraft.slice(0, 350);
  } catch {}
  input.addEventListener("input", () => {
    try { sessionStorage.setItem(DRAFT_KEY, input.value.slice(0, 350)); } catch {}
  });

  function isNearBottom() {
    return feed.scrollHeight - feed.scrollTop - feed.clientHeight < 90;
  }

  function scrollFeed(force) {
    if (force || isNearBottom()) {
      window.requestAnimationFrame(() => {
        feed.scrollTop = feed.scrollHeight;
      });
    }
  }

  // Safe DOM text + trusted URL linkifier (zero innerHTML / XSS risk)
  function renderSafeMessage(container, text) {
    container.textContent = "";
    const str = String(text || "");
    const urlRx = /(https:\/\/thuevf3\.click(?:\/[^\s),!?;]*)?)/gi;
    let last = 0;
    let match;
    while ((match = urlRx.exec(str)) !== null) {
      if (match.index > last) {
        container.appendChild(document.createTextNode(str.slice(last, match.index)));
      }
      const a = document.createElement("a");
      a.className = "vf3-ai-inline-link";
      a.href = match[1];
      a.textContent = match[1].replace(/^https:\/\//, "").replace(/\/$/, "");
      a.addEventListener("click", (e) => {
        if (window.location.pathname === "/" || window.location.pathname === "/index.html") {
          const cal = document.getElementById("lich-xe");
          if (cal) {
            e.preventDefault();
            toggle(false);
            cal.scrollIntoView({ behavior: "smooth" });
          }
        }
      });
      container.appendChild(a);
      last = match.index + match[0].length;
    }
    if (last < str.length) {
      container.appendChild(document.createTextNode(str.slice(last)));
    }
  }

  function addMessage(message, from, serverMood) {
    const shouldScroll = from === "user" || isNearBottom();
    const el = document.createElement("div");
    el.className = "vf3-ai-message vf3-ai-message--" + from;
    if (serverMood && VALID_MOODS.has(serverMood)) {
      el.dataset.serverMood = serverMood;
    }
    renderSafeMessage(el, message);
    feed.appendChild(el);
    scrollFeed(shouldScroll);
    return el;
  }

  function pushHistory(role, text) {
    if (!text) return;
    chatHistory.push({ role, text: String(text).slice(0, 350) });
    if (chatHistory.length > HISTORY_LIMIT) chatHistory.splice(0, chatHistory.length - HISTORY_LIMIT);
  }

  const greeting = "Chào anh/chị! 🐹💙 Bé Click của thuevf3.click có mặt rồi đây. Em trực 24/7 để hỗ trợ mình xem lịch xe, báo giá và giải đáp thắc mắc ạ!";
  addMessage(greeting, "bot", "welcome");

  // Mobile virtual keyboard viewport adaptation
  function syncVisualViewport() {
    const mobile = window.innerWidth <= 720;
    if (!mobile || root.dataset.open !== "true" || !window.visualViewport) {
      root.style.removeProperty("--vf3-vv-height");
      root.style.removeProperty("--vf3-vv-bottom");
      root.classList.remove("vf3-ai-kbd-open");
      return;
    }
    const vv = window.visualViewport;
    const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    const kbdOpen = keyboardHeight > 90;
    root.classList.toggle("vf3-ai-kbd-open", kbdOpen);
    root.style.setProperty("--vf3-vv-height", Math.max(280, Math.floor(vv.height - 18)) + "px");
    root.style.setProperty("--vf3-vv-bottom", Math.max(8, Math.floor(keyboardHeight + 8)) + "px");
    if (kbdOpen) scrollFeed(true);
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncVisualViewport);
    window.visualViewport.addEventListener("scroll", syncVisualViewport);
  }
  window.addEventListener("resize", syncVisualViewport);

  function toggle(open) {
    root.dataset.open = String(open);
    panel.setAttribute("aria-hidden", String(!open));
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-label", open ? "Đóng trợ lý AI" : "Mở trợ lý AI tư vấn thuê xe");
    syncVisualViewport();
    if (open) {
      teaser.hidden = true;
      if (!busy) mascotMood("welcome");
      scrollFeed(true);
      if (window.innerWidth > 720) input.focus({ preventScroll: true });
    } else {
      launcher.focus({ preventScroll: true });
    }
  }

  launcher.addEventListener("click", () => toggle(root.dataset.open !== "true"));
  root.querySelector(".vf3-ai-close").addEventListener("click", () => toggle(false));
  root.querySelector(".vf3-ai-teaser-close").addEventListener("click", () => { teaser.hidden = true; });
  teaser.addEventListener("click", (e) => { if (!e.target.closest("button")) toggle(true); });
  root.querySelector(".vf3-ai-calendar-link").addEventListener("click", () => {
    if (window.innerWidth <= 720) toggle(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.dataset.open === "true") toggle(false);
  });

  try {
    if (sessionStorage.getItem("vf3click_ai_greeted")) teaser.hidden = true;
    else sessionStorage.setItem("vf3click_ai_greeted", "1");
  } catch {}
  setTimeout(() => { teaser.hidden = true; }, 12000);

  async function sendMessage(raw) {
    const now = Date.now();
    const message = String(raw || "").trim().slice(0, 350);
    if (!message || busy || now - lastSendAt < 350) return;
    lastSendAt = now;
    busy = true;

    mascotMood("thinking");
    input.value = "";
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
    input.disabled = true;
    submit.disabled = true;

    addMessage(message, "user");
    const loading = addMessage("Bé đang kiểm tra thông tin cho mình…", "bot", "thinking");
    loading.classList.add("vf3-ai-typing");

    const historySnapshot = chatHistory.slice(-12);
    const messageId = newId("msg");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 22000);

    try {
      const response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          channel: CHANNEL,
          conversation_id: conversationId,
          message_id: messageId,
          message: message,
          history: historySnapshot,
          client_version: "4.0",
          business_allowed: true,
          dry_run: false
        }),
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      const reply = typeof data.reply === "string" ? data.reply.trim() : "";

      if (data.success === true && data.action !== "IGNORE" && reply) {
        const finalText = reply.slice(0, 1800);
        const authoritativeMood = VALID_MOODS.has(data.mood)
          ? data.mood
          : (data.action === "ASK_CLARIFY" ? "plead" : "happy");
        loading.dataset.serverMood = authoritativeMood;
        renderSafeMessage(loading, finalText);
        pushHistory("user", message);
        pushHistory("assistant", finalText);
        mascotMood(authoritativeMood, Math.min(3500, Math.max(900, finalText.length * 32)));
      } else {
        const msg = "Bé chưa trả lời tự động được lúc này 🥹. Mình xem lịch xe trực tiếp hoặc bấm Gặp tư vấn viên (Zalo) giúp bé nhé! 💙";
        loading.dataset.serverMood = "sad";
        renderSafeMessage(loading, msg);
        mascotMood("sad");
      }
    } catch (error) {
      const isTimeout = error && error.name === "AbortError";
      const msg = isTimeout
        ? "Hệ thống phản hồi hơi chậm một chút 🥹. Mình thử nhắn lại hoặc xem lịch xe trực tiếp giúp bé nhé!"
        : "Kết nối mạng đang gián đoạn nhẹ 🥹. Mình xem lịch xe trực tiếp hoặc nhắn Zalo giúp bé nhé! 💙";
      loading.dataset.serverMood = "sad";
      renderSafeMessage(loading, msg);
      mascotMood("sad");
      console.warn("VF3_CHAT_REQUEST_ERROR", error instanceof Error ? error.message : "unknown");
    } finally {
      clearTimeout(timeout);
      loading.classList.remove("vf3-ai-typing");
      scrollFeed(false);
      busy = false;
      input.disabled = false;
      submit.disabled = false;
      if (root.dataset.open === "true" && window.innerWidth > 720) {
        input.focus({ preventScroll: true });
      }
    }
  }

  root.querySelector("#vf3-ai-form").addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });
  root.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt));
  });
})();