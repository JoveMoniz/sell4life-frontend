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
  // Inject layout.js with cache-busting on every load
  // (CSS is NOT re-versioned here — doing so after the
  //  page renders causes a flash of unstyled content)
  // --------------------------------------------------
  const _v = Date.now();

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
})();
