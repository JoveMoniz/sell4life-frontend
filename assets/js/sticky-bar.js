// ============================================================
// STICKY BOTTOM BAR — sell4life
// Separators = standalone <div class="s4l-sep"> elements
// Pills use inner <span> so their visual box is centred
// inside the same 68px slot as the other buttons
// ============================================================
(function () {

  const SEP_COLOR = 'rgba(11,107,106,0.6)';

  const css = document.createElement('style');
  css.textContent = `
    .s4l-sticky-bar {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: 8500;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 58px;
      background: transparent;
      transform: translateY(110%);
      pointer-events: none;
      padding-bottom: 4px;
    }
    /* Frosted pill — only the button group gets a background */
    .s4l-bar-inner {
      display: flex;
      align-items: center;
      height: 46px;
      padding: 0 6px;
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.88);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(11, 107, 106, 0.18);
      box-shadow: 0 2px 16px rgba(0, 0, 0, 0.13);
    }
    /* ── Separator divs ─────────────────────────────── */
    .s4l-sep {
      width: 1.5px;
      height: 22px;
      background: ${SEP_COLOR};
      flex-shrink: 0;
      align-self: center;
    }
    .s4l-sep-v,
    .s4l-sep-b { display: none; }
    .s4l-sep-v.s4l-show,
    .s4l-sep-b.s4l-show { display: block; }
    /* ── Shared button base ─────────────────────────── */
    .s4l-sticky-btn,
    .s4l-pill {
      width: 58px; height: 46px;
      display: flex; align-items: center; justify-content: center;
      background: none; border: none;
      cursor: pointer; padding: 0; color: #0b6b6a;
      touch-action: manipulation; flex-shrink: 0;
    }
    .s4l-sticky-btn {
      opacity: 0.72; transition: opacity 0.15s;
    }
    .s4l-sticky-btn:hover    { opacity: 1; }
    .s4l-sticky-btn:disabled { opacity: 0.28; cursor: default; }
    /* Pills hidden until notification arrives */
    .s4l-pill { display: none; }
    .s4l-pill.s4l-show { display: flex; }
    /* ── Arrow ──────────────────────────────────────── */
    .s4l-arrow-up {
      font-size: 22px; font-weight: 900; line-height: 1; color: #0b6b6a;
      opacity: 0.72;
    }
    /* ── Account avatar (logged-in initial, replaces the plain icon) ── */
    .s4l-account-avatar {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: #f18c28;
      color: #1c1206;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; line-height: 1;
      border: 1.5px solid rgba(255,255,255,0.5);
    }
    /* ── Basket circle ──────────────────────────────── */
    .s4l-basket-circle {
      width: 34px; height: 34px; border-radius: 50%;
      border: 1px solid rgba(11,107,106,0.7);
      display: flex; align-items: center; justify-content: center;
      position: relative; transition: border-color 0.2s;
    }
    .s4l-basket-circle svg      { opacity: 0.75; transition: opacity 0.2s; }
    .s4l-basket-n {
      position: absolute; inset: 0; display: none;
      align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800; color: #0b6b6a;
      line-height: 1; font-family: inherit;
    }
    .s4l-basket-circle.s4l-has                           { border-color: #0b6b6a; }
    /* Fill only the basket body path (last path = body), leave handle as stroke */
    .s4l-basket-circle.s4l-has svg path:last-child       { fill: #0b6b6a; stroke: #0b6b6a; }
    .s4l-basket-circle.s4l-has svg                       { opacity: 1; }
    .s4l-basket-circle.s4l-has .s4l-basket-n             { display: flex; color: #fff; font-size: 10px; font-weight: 900; transform: translateY(3px); }
    /* ── Pill inner boxes (visual only) ─────────────── */
    /* vendor: square, teal */
    .s4l-pill-vendor .s4l-pill-inner {
      width: 34px; height: 34px;
      border-radius: 5px;
      border: 1px solid rgba(11,107,106,0.7);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; color: #0b6b6a; line-height: 1;
    }
    /* buyer: rectangle, orange */
    .s4l-pill-buyer .s4l-pill-inner {
      min-width: 34px; padding: 0 10px; height: 34px;
      border-radius: 6px;
      border: 1px solid rgba(224,123,26,0.7);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 800; color: #e07b1a; line-height: 1;
    }
    /* messages: rectangle, blue — distinct from orders on either side */
    .s4l-pill-vendor-msg .s4l-pill-inner,
    .s4l-pill-buyer-msg .s4l-pill-inner {
      min-width: 34px; padding: 0 9px; height: 34px;
      border-radius: 6px;
      border: 1px solid rgba(37,99,235,0.7);
      display: flex; align-items: center; justify-content: center;
      gap: 4px;
      font-size: 13px; font-weight: 800; color: #2563eb; line-height: 1;
    }
    .s4l-pill-vendor-msg svg,
    .s4l-pill-buyer-msg svg { flex-shrink: 0; }
    /* ── Account dropdown (replicates header's account-dropdown, opens upward) ── */
    .s4l-account-wrap { position: relative; }
    .s4l-account-btn { position: relative; }
    /* .buyer-notif-badge's default offset (-2px/-2px) hugs the header's
       small ~27px avatar button, but this button is a much bigger 58px
       tap target with a small centered icon — that offset left the dot
       floating in empty space near the outer edge instead of on the icon.
       Pull it in to sit against the icon itself. */
    .s4l-account-btn .buyer-notif-badge {
      top: 9px;
      right: 15px;
    }
    @media (max-width: 768px) {
      .s4l-account-btn .buyer-notif-badge {
        top: 8px;
        right: 12px;
      }
    }
    #s4l-account-dropdown {
      position: absolute;
      bottom: 100%;
      top: auto;
      left: 50%;
      right: auto;
      margin-bottom: 10px;
      box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.25);
      transform: translateX(-50%) translateY(8px);
    }
    #s4l-account-dropdown.open {
      transform: translateX(-50%) translateY(0);
    }
    /* ── Mobile ──────────────────────────────────────── */
    @media (max-width: 768px) {
      .s4l-sticky-btn,
      .s4l-pill          { width: 52px; }
      .s4l-sep           { height: 24px; width: 1.5px; }
      .s4l-arrow-up      { font-size: 24px; -webkit-text-stroke: 0.6px #0b6b6a; transform: scaleY(1.4); display: inline-block; }
      .s4l-sticky-btn svg { stroke-width: 2.6; }
      .s4l-basket-circle { width: 36px; height: 36px; border-width: 2px; border-color: rgba(11,107,106,0.85); }
      .s4l-account-avatar { width: 36px; height: 36px; font-size: 14px; font-weight: 900; }
      .s4l-basket-circle svg { opacity: 1; stroke-width: 2.2; }
      .s4l-basket-n      { font-size: 14px; font-weight: 900; }
      .s4l-pill-vendor .s4l-pill-inner { width: 36px; height: 36px; border-width: 2px; font-size: 14px; font-weight: 900; }
      .s4l-pill-buyer  .s4l-pill-inner { min-width: 36px; height: 36px; border-width: 2px; font-size: 14px; font-weight: 900; }
      .s4l-pill-vendor-msg .s4l-pill-inner,
      .s4l-pill-buyer-msg  .s4l-pill-inner { min-width: 36px; height: 36px; border-width: 2px; font-size: 14px; font-weight: 900; }
    }
  `;
  document.head.appendChild(css);

  function boot() {

    const bar = document.createElement('div');
    bar.className = 's4l-sticky-bar';
    bar.innerHTML = `
      <div class="s4l-bar-inner">
        <button class="s4l-pill s4l-pill-vendor" aria-label="Vendor orders">
          <span class="s4l-pill-inner"></span>
        </button>
        <button class="s4l-pill s4l-pill-vendor-msg" aria-label="Vendor messages">
          <span class="s4l-pill-inner">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2z"/></svg>
            <span class="s4l-pill-num"></span>
          </span>
        </button>
        <div class="s4l-sep s4l-sep-v"></div>

        <button class="s4l-sticky-btn s4l-top-btn" aria-label="Back to top">
          <span class="s4l-arrow-up">&#8593;</span>
        </button>
        <div class="s4l-sep"></div>

        <div class="account-menu s4l-account-wrap">
          <button class="s4l-sticky-btn s4l-account-btn" aria-label="Account menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </button>
          <div class="account-dropdown" id="s4l-account-dropdown">
            <a href="/account/signin.html" class="auth dd-login">Sign in</a>
            <a href="/account/register.html" class="auth dd-register">Register</a>
            <a href="/account/orders.html" class="auth dd-orders">My Orders <span class="dd-order-badge"></span></a>
            <a href="/account/messages.html" class="auth dd-messages">My Messages <span class="dd-msg-badge"></span></a>
            <a href="/account/settings.html" class="auth dd-settings">Account Settings</a>
            <button type="button" class="dd-logout">Logout</button>
          </div>
        </div>
        <div class="s4l-sep"></div>

        <button class="s4l-sticky-btn s4l-cart-btn" aria-label="View basket" disabled>
          <div class="s4l-basket-circle">
            <svg width="18" height="20" viewBox="0 0 24 28" fill="none"
              stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 13C7 5 17 5 17 13"/>
              <path d="M1 12H23V23Q23 27 19 27H5Q1 27 1 23V12Z"/>
            </svg>
            <span class="s4l-basket-n"></span>
          </div>
        </button>
      </div>
    `;
    document.body.appendChild(bar);

    // In case layout.js's notification check already resolved before this
    // bar existed — covers whichever of the two loads first.
    window.applyNotifDot && window.applyNotifDot();

    // ── Scroll-linked reveal ──────────────────────────────────
    function initVisibility() {
      // Mobile: bar is always visible — it's the only way to reach account/basket nav
      if (window.innerWidth <= 767) {
        bar.style.transform = 'none';
        bar.style.pointerEvents = 'auto';
        return;
      }
      // Tablet/Desktop: reveal only once the header has scrolled off screen
      const candidates = ['.basket-wrapper:not(.mobile-basket)', '.basket-wrapper', '.s4l-header-desktop', 'header'];
      let headerEl = null;
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) { headerEl = el; break; }
      }
      const triggerAt  = headerEl ? Math.max(10, headerEl.getBoundingClientRect().bottom + window.scrollY) : 10;
      const revealOver = 15;
      let footerVisible = false, footerObserved = false;
      function tryObserveFooter() {
        if (footerObserved) return;
        const btn = document.querySelector('.back-to-top');
        if (!btn) return;
        footerObserved = true;
        new IntersectionObserver(([e]) => { footerVisible = e.isIntersecting; update(); }, { threshold: 0 }).observe(btn);
      }
      function update() {
        tryObserveFooter();
        if (footerVisible) { bar.style.transform = 'translateY(110%)'; bar.style.pointerEvents = 'none'; return; }
        const p = Math.min(1, Math.max(0, (window.scrollY - triggerAt) / revealOver));
        bar.style.transform    = `translateY(${(1 - p) * 110}%)`;
        bar.style.pointerEvents = p > 0.95 ? 'auto' : 'none';
      }
      window.addEventListener('scroll', update, { passive: true });
      update();
    }

    // ── Basket ────────────────────────────────────────────────
    function updateCount() {
      let cart = [];
      try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch {}
      const n = cart.reduce((s, i) => s + (i.quantity || 1), 0);
      bar.querySelector('.s4l-basket-circle').classList.toggle('s4l-has', n > 0);
      bar.querySelector('.s4l-basket-n').textContent = n > 0 ? (n > 99 ? '99+' : n) : '';
      bar.querySelector('.s4l-cart-btn').disabled = n === 0;
    }

    // ── Notifications ─────────────────────────────────────────
    async function loadNotifications() {
      const token    = localStorage.getItem('s4l_token');
      const isVendor = localStorage.getItem('s4l_isVendor') === 'true';
      if (!token) return;

      if (isVendor) {
        try {
          const [or, mr] = await Promise.allSettled([
            fetch(`${window.API_BASE}/vendor/orders/pending-count`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
            fetch(`${window.API_BASE}/messages/unread-count?view=vendor`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }),
          ]);
          const orderCount   = (or.status === 'fulfilled' && or.value.ok) ? (await or.value.json()).count  || 0 : 0;
          const messageCount = (mr.status === 'fulfilled' && mr.value.ok) ? (await mr.value.json()).unread || 0 : 0;
          if (orderCount > 0) {
            bar.querySelector('.s4l-pill-vendor').classList.add('s4l-show');
            bar.querySelector('.s4l-sep-v').classList.add('s4l-show');
            bar.querySelector('.s4l-pill-vendor .s4l-pill-inner').textContent = orderCount > 99 ? '99+' : orderCount;
          }
          if (messageCount > 0) {
            bar.querySelector('.s4l-pill-vendor-msg').classList.add('s4l-show');
            bar.querySelector('.s4l-sep-v').classList.add('s4l-show');
            bar.querySelector('.s4l-pill-vendor-msg .s4l-pill-num').textContent = messageCount > 99 ? '99+' : messageCount;
          }
        } catch {}
      }

      // Buyer order/message counts are no longer shown as separate pills
      // here — they duplicated the account avatar's badge and its per-link
      // dropdown badges (My Orders / My Messages), which is now the single
      // place notifications live. See layout.js's applyBuyerBadge().
    }

    // ── Init ──────────────────────────────────────────────────
    let _initDone = false;
    function tryInit() { if (_initDone) return; _initDone = true; initVisibility(); }
    document.addEventListener('headerLoaded', tryInit);
    setTimeout(tryInit, 600);
    document.addEventListener('cartUpdated', updateCount);
    updateCount();
    loadNotifications();

    // ── Actions ───────────────────────────────────────────────
    bar.querySelector('.s4l-top-btn').addEventListener('click',    () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Account dropdown — replicates the header's account-dropdown (same links,
    // same login/logged-out visibility rules), opening upward since this bar
    // is fixed to the bottom of the viewport. Outside-click close is handled
    // by layout.js's existing global handler (it already closes any
    // `.account-dropdown` when a click lands outside `.account-menu`).
    (function setupStickyAccount() {
      const accBtn = bar.querySelector('.s4l-account-btn');
      const menu   = bar.querySelector('#s4l-account-dropdown');

      accBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = menu.classList.contains('open');
        document.querySelectorAll('.account-dropdown').forEach((m) => m.classList.remove('open'));
        if (!isOpen) menu.classList.add('open');
      });

      const token    = localStorage.getItem('s4l_token');
      const login    = menu.querySelector('.dd-login');
      const register = menu.querySelector('.dd-register');
      const orders   = menu.querySelector('.dd-orders');
      const messages = menu.querySelector('.dd-messages');
      const settings = menu.querySelector('.dd-settings');
      const logoutBtn = menu.querySelector('.dd-logout');

      if (token) {
        login.style.display = 'none';
        register.style.display = 'none';
        orders.style.display = 'block';
        messages.style.display = 'block';
        settings.style.display = 'block';
        logoutBtn.style.display = 'block';
        logoutBtn.addEventListener('click', () => { menu.classList.remove('open'); logout(); });

        // Swap the generic person icon for the user's initial — same
        // identity cue as the header's account avatar. Especially useful
        // here since the sticky bar (always visible on mobile) is often
        // the only account entry point on screen at all.
        try {
          const user = JSON.parse(localStorage.getItem('s4l_user') || 'null');
          const displayName = user?.name ? user.name.split(' ')[0] : user?.username;
          const initial = (displayName || '').charAt(0).toUpperCase();
          if (initial) {
            accBtn.innerHTML = `<span class="s4l-account-avatar">${initial}</span>`;
            accBtn.setAttribute('title', displayName);
            accBtn.setAttribute('aria-label', `Account: ${displayName}`);
          }
        } catch {}
      } else {
        orders.style.display = 'none';
        messages.style.display = 'none';
        settings.style.display = 'none';
        logoutBtn.style.display = 'none';
        login.style.display = 'block';
        register.style.display = 'block';
      }
    })();
    // Cart button: click/tap → popup with "Go to Basket" + "Clear Basket"
    (function() {
      const cartBtn = bar.querySelector('.s4l-cart-btn');

      function cartCount() {
        let cart = [];
        try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch {}
        return cart.reduce((s, i) => s + (i.quantity || 1), 0);
      }

      function showCartPopup() {
        if (cartCount() === 0) return;
        document.getElementById('s4l-cart-popup')?.remove();

        const pop = document.createElement('div');
        pop.id = 's4l-cart-popup';
        pop.style.cssText = [
          'position:fixed', 'bottom:72px', 'left:50%', 'transform:translateX(-50%)',
          'background:#fff', 'border:1px solid #e5e7eb', 'border-radius:14px',
          'padding:12px', 'box-shadow:0 4px 24px rgba(0,0,0,0.16)',
          'display:flex', 'flex-direction:column', 'gap:8px',
          'z-index:99999', 'min-width:210px',
        ].join(';');
        pop.innerHTML = `
          <button id="s4l-pop-go"    style="width:100%;padding:11px 16px;background:#0b6b6a;color:#fff;border:none;border-radius:9px;font-size:0.9rem;font-weight:700;cursor:pointer;text-align:left"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M3 4h2l1 12h12l2-8H7"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg> Go to Basket</button>
          <button id="s4l-pop-clear" style="width:100%;padding:11px 16px;background:#fff;color:#dc2626;border:1.5px solid #fca5a5;border-radius:9px;font-size:0.9rem;font-weight:700;cursor:pointer;text-align:left"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M6 6l12 12M18 6L6 18"/></svg> Clear Basket</button>
        `;
        document.body.appendChild(pop);

        document.getElementById('s4l-pop-go').addEventListener('click', () => {
          pop.remove();
          window.location.href = '/cart/cart.html';
        });
        document.getElementById('s4l-pop-clear').addEventListener('click', () => {
          localStorage.removeItem('cart');
          document.dispatchEvent(new Event('cartUpdated'));
          pop.remove();
        });

        setTimeout(() => {
          document.addEventListener('click', function outsideClick(e) {
            if (!pop.contains(e.target) && e.target !== cartBtn) {
              pop.remove();
              document.removeEventListener('click', outsideClick);
            }
          });
        }, 10);
      }

      // Touch (mobile) — guard against empty basket bypassing disabled state
      cartBtn.addEventListener('touchend', (e) => {
        if (cartCount() === 0) return;
        e.preventDefault();
        showCartPopup();
      });

      // Click (desktop + mobile fallback)
      cartBtn.addEventListener('click', () => showCartPopup());

      cartBtn.title = 'View basket';
    })();
    bar.querySelector('.s4l-pill-vendor').addEventListener('click',     () => { window.location.href = '/account/vendor/orders.html'; });
    bar.querySelector('.s4l-pill-vendor-msg').addEventListener('click', () => { window.location.href = '/account/vendor/messages.html'; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
