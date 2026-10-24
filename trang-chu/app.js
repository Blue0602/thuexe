(() => {
  'use strict';
  const $ = (s, base = document) => base.querySelector(s);
  const $$ = (s, base = document) => Array.from(base.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(pointer: coarse)').matches;
  const toast = $('#toast');
  let toastTimer;
  function notice(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }
  // Logo ALWAYS returns instantly to top. Other section links remain smoothly scrollable.
  $('#brand-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
  });
  $$('.brand-footer').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }));
  // Responsive navigation with close on selection/Escape.
  const nav = $('#main-nav');
  const navToggle = $('#nav-toggle');
  function closeNav() {
    nav?.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }
  navToggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  $$('a', nav).forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNav();
  });

  // Progressive reveal; disable for reduced motion and users without observer support.
  const revealElements = $$('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealElements.forEach(el => el.classList.add('visible'));
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); }
      }
    }, { threshold: 0.09, rootMargin: '0px 0px 35px 0px' });
    revealElements.forEach(el => revealObserver.observe(el));
  }
  // Optional light depth, disabled on touch/mobile.
  const heroStage = $('#hero-stage');
  const carWrap = $('.hero-car-wrap');
  if (heroStage && carWrap && !reduceMotion && !isMobile) {
    let frame = 0;
    heroStage.addEventListener('pointermove', (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const rect = heroStage.getBoundingClientRect();
        const dx = ((event.clientX - rect.left) / rect.width - .5) * 14;
        const dy = ((event.clientY - rect.top) / rect.height - .5) * 9;
        carWrap.style.transform = `translate3d(${dx}px,${dy}px,0)`;
        frame = 0;
      });
    }, { passive: true });
    heroStage.addEventListener('pointerleave', () => { carWrap.style.transform = ''; });
  }
  // Product gallery. "contain" in CSS prevents cropping the actual car.
  const vipPhoto = $('#vip-photo');
  $$('.thumb').forEach(button => button.addEventListener('click', () => {
    if (!vipPhoto) return;
    $$('.thumb').forEach(b => b.classList.toggle('active', b === button));
    vipPhoto.style.opacity = '.65';
    const next = new Image();
    next.onload = () => { vipPhoto.src = button.dataset.src; vipPhoto.alt = button.dataset.alt || 'Ảnh xe VF3 thực tế'; vipPhoto.style.opacity = '1'; };
    next.onerror = () => { vipPhoto.style.opacity = '1'; notice('Ảnh này chưa tải được, vui lòng thử lại.'); };
    next.src = button.dataset.src;
  }));
  // Booking form is an honest message composer, NOT a server-side reservation or deposit engine.
  const booking = $('#booking-dialog');
  const bookingForm = $('#booking-form');
  const bookingResult = $('#enquiry-result');
  const enquiryText = $('#enquiry-text');
  function openBooking(car) {
    if (!booking || typeof booking.showModal !== 'function') return;
    bookingResult.hidden = true;
    bookingForm.hidden = false;
    if (car) {
      const select = bookingForm.elements.car;
      if (Array.from(select.options).some(option => option.value === car)) select.value = car;
    }
    booking.showModal();
  }
  $$('.js-book').forEach(button => button.addEventListener('click', () => openBooking(button.dataset.car)));
  $('#booking-close')?.addEventListener('click', () => booking.close());
  booking?.addEventListener('click', event => { if (event.target === booking) booking.close(); });
  // Local date limits prevent selecting a past day without hardcoding the date.
  const start = bookingForm?.elements.start;
  const end = bookingForm?.elements.end;
  function todayLocal() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }
  if (start && end) {
    start.min = end.min = todayLocal();
    start.addEventListener('change', () => {
      end.min = start.value || todayLocal();
      if (end.value && end.value < end.min) end.value = '';
    });
  }
  bookingForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(bookingForm);
    const values = Object.fromEntries(data.entries());
    if (values.end < values.start) { notice('Ngày trả xe không được trước ngày nhận xe.'); return; }
    const format = (value) => {
      const [year, month, day] = value.split('-');
      return `${day}/${month}/${year}`;
    };
    const msg = [
      'Chào anh Thuận, mình muốn được tư vấn thuê xe Thuê VF3 Click:',
      '- Dòng xe: ' + values.car,
      '- Ngày nhận dự kiến: ' + format(values.start),
      '- Ngày trả dự kiến: ' + format(values.end),
      '- Khu vực: ' + values.location,
      '- Tên liên hệ: ' + values.customer.trim(),
      '- Ghi chú: ' + (values.message?.trim() || 'Chưa có'),
      'Nhờ anh kiểm tra lịch trống, giá thuê và điều kiện cọc giúp mình. Cảm ơn anh!'
    ].join('\n');
    enquiryText.value = msg;
    bookingForm.hidden = true;
    bookingResult.hidden = false;
    bookingResult.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'nearest' });
  });
  $('#copy-enquiry')?.addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(enquiryText.value);
      else { enquiryText.select(); document.execCommand('copy'); }
      notice('Đã sao chép! Hãy mở Zalo và dán tin nhắn cho Thuận.');
    } catch {
      enquiryText.focus(); enquiryText.select();
      notice('Hãy sao chép phần nội dung đã được chọn rồi gửi qua Zalo.');
    }
  });
  // Video loads ONLY on click. Do not autoplay media on page open.
  const videoDialog = $('#video-dialog');
  const videoPlayer = $('#video-player');
  $$('.video-card').forEach(button => button.addEventListener('click', () => {
    if (!videoDialog || !videoPlayer) return;
    videoPlayer.src = button.dataset.video;
    videoDialog.showModal();
    videoPlayer.play().catch(() => { /* Browser might require another user tap. */ });
  }));
  function closeVideo() {
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    videoDialog.close();
  }
  $('.video-close')?.addEventListener('click', closeVideo);
  videoDialog?.addEventListener('click', event => { if (event.target === videoDialog) closeVideo(); });
  videoDialog?.addEventListener('close', () => { videoPlayer.pause(); videoPlayer.removeAttribute('src'); videoPlayer.load(); });
  // Header scroll state, non-essential enhancement.
  const sections = $$('main section[id]');
  if ('IntersectionObserver' in window) {
    const menuLinks = $$('.main-nav a');
    const navObs = new IntersectionObserver(entries => {
      const active = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!active) return;
      menuLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + active.target.id));
    }, { rootMargin: '-25% 0px -50% 0px', threshold: [0, .05, .2] });
    sections.forEach(s => navObs.observe(s));
  }
})();
