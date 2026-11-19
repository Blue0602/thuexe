/* Thuê VF3 Click — AI assistant. Front-end only; no API key belongs in browser code. */
(() => {
  "use strict";
  if (document.getElementById("vf3-ai-widget")) return;

  const SETTINGS = window.VF3_CHAT_CONFIG || {};
  const API = SETTINGS.endpoint || "https://thuevf3click-ai.hgpure2003.workers.dev/api/ai/website";
  const CHANNEL = SETTINGS.channel || "website";
  const root = document.createElement("aside");
  root.id = "vf3-ai-widget";
  root.setAttribute("aria-label", "Trợ lý thuê xe VF3 Click");
  root.dataset.open = "false";

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "/assets/ai-chat/chat-widget.css?v=1";
  document.head.appendChild(css);

  // Only trusted, constant HTML is constructed here; every AI response uses textContent.
  root.innerHTML = [
    '<div class="vf3-ai-teaser" id="vf3-ai-teaser">',
    '<button class="vf3-ai-teaser-close" type="button" aria-label="Ẩn lời chào">×</button>',
    '<strong>🚗 VF3 Click có mặt!</strong>',
    '<p>Hôm nay anh/chị muốn thuê xe gì ạ? Chạm vào em nhé!</p></div>',
    '<section class="vf3-ai-panel" id="vf3-ai-panel" role="dialog" aria-label="Trò chuyện với trợ lý AI VF3 Click" aria-hidden="true">',
    '<div class="vf3-ai-head"><span class="vf3-ai-head-logo">',
    '<img src="/trang-chu/images/logo-vf3.webp" alt="" width="45" height="45"></span>',
    '<span class="vf3-ai-head-copy"><strong>VF3 Click Assistant ✨</strong>',
    '<small>Trợ lý tư vấn xe tự động</small></span>',
    '<button class="vf3-ai-close" type="button" aria-label="Đóng trò chuyện">×</button></div>',
    '<div class="vf3-ai-feed" id="vf3-ai-feed" role="log" aria-live="polite" aria-relevant="additions text"></div>',
    '<div class="vf3-ai-actions" aria-label="Câu hỏi gợi ý">',
    '<button class="vf3-ai-chip" data-prompt="Em muốn thuê VF3 VIP" type="button">🚙 VF3 VIP</button>',
    '<button class="vf3-ai-chip" data-prompt="Em muốn thuê VF8 Plus" type="button">🚗 VF8 Plus</button>',
    '<button class="vf3-ai-chip" data-prompt="Giá thuê Kia K5 như thế nào?" type="button">✨ KIA K5</button>',
    '<button class="vf3-ai-chip" data-prompt="Cách đặt xe và đặt cọc?" type="button">📅 Cách đặt xe</button></div>',
    '<div class="vf3-ai-foot-links">',
    '<a href="/#lich-xe">🗓 Xem lịch xe</a>',
    '<a href="https://zalo.me/0837892579" target="_blank" rel="noopener noreferrer">💬 Gặp tư vấn viên</a></div>',
    '<form class="vf3-ai-form" id="vf3-ai-form">',
    '<input class="vf3-ai-input" id="vf3-ai-input" type="text" autocomplete="off" maxlength="350" aria-label="Nhập câu hỏi về thuê xe" placeholder="Nhắn cho VF3 Click..." required>',
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
  // Phase 1 expressive mascot. Wait for image layers so older logo remains as fallback.
  let miniMascot = null, launcherMascot = null;
  const mascotStage = document.createElement("div");
  mascotStage.className = "vf3-ai-mascot-stage";
  const mascotButtonStage = document.createElement("div");
  mascotButtonStage.className = "vf3-ai-mascot-avatar";
  const preload = new Image();
  preload.onload = () => {
    if (!window.VF3Mascot) return;
    feed.prepend(mascotStage);
    launcher.prepend(mascotButtonStage);
    miniMascot = VF3Mascot.mount(mascotStage, { mood: "welcome" });
    launcherMascot = VF3Mascot.mount(mascotButtonStage, { mood: "idle" });
    launcher.classList.add("vf3-ai-mascot-ready");
  };
  preload.onerror = () => { /* Image layers not uploaded yet; retain original logo. */ };
  preload.src = "/assets/ai-chat/mascot/hamster-head.webp";
  function mascotMood(mood, speakFor) {
    if (miniMascot) {
      miniMascot.setMood(mood);
      if (speakFor) miniMascot.previewTalk(speakFor);
    }
    if (launcherMascot) launcherMascot.setMood(mood === "thinking" ? "thinking" : "idle");
  }


  function sessionId() {
    try {
      let id = sessionStorage.getItem("vf3click_ai_web_session");
      if (!id) {
        id = "vf3-web-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));
        sessionStorage.setItem("vf3click_ai_web_session", id);
      }
      return id;
    } catch {
      return "vf3-web-" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    }
  }
  const conversationId = sessionId();

  function addMessage(message, from) {
    const el = document.createElement("div");
    el.className = "vf3-ai-message vf3-ai-message--" + from;
    el.textContent = message;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
    return el;
  }

  addMessage("Xin chào! 🚗💙 Em là trợ lý VF3 Click. Hôm nay anh/chị đang muốn thuê dòng xe nào ạ?", "bot");

  function toggle(open) {
    root.dataset.open = String(open);
    panel.setAttribute("aria-hidden", String(!open));
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-label", open ? "Đóng trợ lý AI" : "Mở trợ lý AI tư vấn thuê xe");
    if (open) {
      teaser.hidden = true;
      mascotMood("welcome");
      if (window.innerWidth > 720) input.focus({ preventScroll: true });
    } else {
      launcher.focus({ preventScroll: true });
    }
  }

  launcher.addEventListener("click", () => toggle(root.dataset.open !== "true"));
  root.querySelector(".vf3-ai-close").addEventListener("click", () => toggle(false));
  root.querySelector(".vf3-ai-teaser-close").addEventListener("click", () => { teaser.hidden = true; });
  teaser.addEventListener("click", e => { if (!e.target.closest("button")) toggle(true); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && root.dataset.open === "true") toggle(false);
  });

  // Welcome bubble only on the first page viewed in this browser tab.
  try {
    if (sessionStorage.getItem("vf3click_ai_greeted")) teaser.hidden = true;
    else sessionStorage.setItem("vf3click_ai_greeted", "1");
  } catch { /* Browser may disable storage. */ }
  setTimeout(() => { teaser.hidden = true; }, 12000);

  async function sendMessage(raw) {
    const message = raw.trim().slice(0, 350);
    if (!message || busy) return;
    busy = true;
    mascotMood("thinking");
    input.value = "";
    input.disabled = true;
    submit.disabled = true;
    addMessage(message, "user");
    const loading = addMessage("Em đang xem thông tin cho mình…", "bot");
    loading.classList.add("vf3-ai-typing");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          channel: CHANNEL,
          conversation_id: conversationId,
          message: message,
          business_allowed: true,
          dry_run: false
        }),
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      // Diagnostic only: no messages, tokens or customer data are logged.
      console.info("VF3_AI_RESULT", { action: data.action, reason_code: data.reason_code || "UNKNOWN" });
      const reply = typeof data.reply === "string" ? data.reply.trim() : "";
      if (data.success === true && data.action !== "IGNORE" && reply) {
        loading.textContent = reply.slice(0, 1800);
        // Prefer the Worker-provided emotion over generic action heuristics.
        const safeMoods = new Set(["welcome", "plead", "thinking", "happy", "sad", "idle"]);
        const replyMood = safeMoods.has(data.mood) ? data.mood : (
          /FULLY_BLOCKED|CONFLICT|CAR_BUSY|UNAVAILABLE|LIMIT|ERROR/.test(String(data.reason_code || "")) ? "sad" :
          data.action === "ASK_CLARIFY" ? "plead" : "happy"
        );
        loading.dataset.mood = replyMood;
        mascotMood(replyMood, Math.min(3500, Math.max(900, reply.length * 36)));
      } else {
        loading.textContent = "Em chưa thể trả lời tự động trên website lúc này. Anh/chị có thể xem lịch xe hoặc liên hệ Zalo để được hỗ trợ nhé! 💙";
        mascotMood("sad");
      }
    } catch (error) {
      loading.textContent = "Kết nối tư vấn AI đang gián đoạn. Mình xem lịch xe trực tiếp hoặc nhắn Zalo giúp em nhé! 💙";
      mascotMood("sad");
      console.warn("VF3_CHAT_REQUEST_ERROR", error instanceof Error ? error.message : "unknown");
    } finally {
      clearTimeout(timeout);
      loading.classList.remove("vf3-ai-typing");
      feed.scrollTop = feed.scrollHeight;
      busy = false;
      input.disabled = false;
      submit.disabled = false;
      if (root.dataset.open === "true" && window.innerWidth > 720) input.focus({ preventScroll: true });
    }
  }

  root.querySelector("#vf3-ai-form").addEventListener("submit", e => {
    e.preventDefault();
    sendMessage(input.value);
  });
  root.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt));
  });
})();