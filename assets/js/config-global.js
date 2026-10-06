// ======================================================
// SELL4LIFE GLOBAL CONFIG
// Shared configuration for frontend scripts
// ======================================================

(function () {
  // --------------------------------------------------
  // Detect environment
  // --------------------------------------------------

  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  // --------------------------------------------------
  // API base URL
  // --------------------------------------------------

  window.API_BASE = isLocal
    ? 'http://localhost:5000/api'
    : 'https://sell4life-backend-prod.onrender.com/api';

  // --------------------------------------------------
  // Stripe publishable key
  // --------------------------------------------------

  window.STRIPE_PUBLISHABLE_KEY =
    'pk_live_51T5d4uPSg7d2gQiCtuvr2HioMqXscCfkD5Yr38rKahOrgnUyowqAJm2qNXkPcRZ5JUCJkDldpfdMxgRcZDeCIBmd005NXY0Nyv';

  // --------------------------------------------------
  // HTML-escaping helper — defined here (not a separately loaded file)
  // so it's guaranteed available, with no load-order risk, to every
  // other script on every page before interpolating vendor/buyer-typed
  // text (product names, messages, reviews, addresses, etc.) into
  // innerHTML. config-global.js is always the first, blocking script tag
  // on every page.
  // --------------------------------------------------
  window.escHtml = function (str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // --------------------------------------------------
  // Single source of truth for a product's link — was previously
  // duplicated (inconsistently) in product-card.js and home.js, and
  // several other pages skipped the slug entirely and linked by raw id
  // even when a slug existed. /product/<slug> is a clean path (an
  // .htaccess rewrite serves product.html for it, URL bar unchanged) —
  // falls back to the old ?id= query-string form only when a product
  // genuinely has no slug yet.
  // --------------------------------------------------
  window.s4lProductUrl = function (p) {
    const slug = p && p.slug;
    const id = p && (p._id || p.id);
    return slug ? `/product/${encodeURIComponent(slug)}` : `/product/product.html?id=${id}`;
  };

  // --------------------------------------------------
  // Inject layout.js with cache-busting on every load
  // (CSS is NOT re-versioned here — doing so after the
  //  page renders causes a flash of unstyled content)
  // --------------------------------------------------
  const _v = Date.now();

  // Note: the site-usage recorder (client-info.js) is a static <script>
  // tag on every page now, not injected from here — some browser privacy
  // tools silently block scripts that get added to the page dynamically
  // after load, even when the filename/endpoint has nothing tracker-like
  // about it. A static tag is indistinguishable from any other first-party
  // script and isn't affected.

  const isAdminPage = location.pathname.includes('/account/admin/');
  const isVendorPage = location.pathname.includes('/account/vendor/');
  if (!isAdminPage && !isVendorPage) {
    // Hide body until layout.js injects the header — prevents unstyled flash
    document.body.classList.add('s4l-loading');

    const _layout = document.createElement('script');
    _layout.src = '/assets/js/layout.js?v=' + _v;
    _layout.defer = true;
    document.head.appendChild(_layout);
  }

  // --------------------------------------------------
  // Styled confirm()/alert() replacement — every vendor and admin page,
  // one injection point instead of editing each page's own markup/scripts.
  // --------------------------------------------------
  if (isAdminPage || isVendorPage) {
    const _dialogCss = document.createElement('link');
    _dialogCss.rel = 'stylesheet';
    _dialogCss.href = '/assets/css/s4l-dialog.css?v=' + _v;
    document.head.appendChild(_dialogCss);

    const _dialogJs = document.createElement('script');
    _dialogJs.src = '/assets/js/s4l-dialog.js?v=' + _v;
    _dialogJs.defer = true;
    document.head.appendChild(_dialogJs);
  }

  // --------------------------------------------------
  // Sitewide safety net: a focused <select> makes some browsers'
  // Ctrl/Cmd+A fall back to selecting the ENTIRE page's visible text
  // (not just the dropdown), which looks "stuck" until a refresh.
  // Blur any <select> right after it's used, and as a backstop, blur
  // it if Ctrl/Cmd+A is pressed while it's still focused.
  // --------------------------------------------------
  document.addEventListener('change', (e) => {
    if (e.target instanceof HTMLSelectElement) e.target.blur();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a') return;
    if (document.activeElement instanceof HTMLSelectElement) {
      // Cancel the native default here — just blurring isn't enough, since
      // the browser's default "select all" action still runs after this
      // handler returns and ends up selecting the whole page's text anyway.
      e.preventDefault();
      document.activeElement.blur();
    }
  }, true);
})();
