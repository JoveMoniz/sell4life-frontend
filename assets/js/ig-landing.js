// =====================================================
// /ig/ — a stable bio-link landing page (Instagram, TikTok, etc.) that
// always shows the current newest listings, so the social bio link never
// needs editing again — point it here once instead of at a specific
// product that goes stale.
// =====================================================

(async function () {
  const API = window.API_BASE;
  const grid = document.getElementById('ig-landing-grid');
  if (!grid) return;

  // Reviews config — same pattern as shop.js, fetched once and passed
  // into every card so star ratings render consistently with the rest
  // of the site.
  let reviewsConfig = { reviewsEnabled: false, reviewsMinCount: 3 };
  try {
    const rvRes = await fetch(`${API}/reviews/config`);
    if (rvRes.ok) reviewsConfig = await rvRes.json();
  } catch { /* non-critical, cards still render without star ratings */ }

  try {
    // No search/category params — the backend's default sort is already
    // { featured: -1, createdAt: -1 }, exactly "newest first, featured
    // pinned to the top", which is what this page is for.
    const res = await fetch(`${API}/products?limit=12`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const products = data.products || [];

    if (window.S4L_CURRENCY_READY) await window.S4L_CURRENCY_READY;

    if (!products.length) {
      grid.innerHTML = '<p>No products listed yet — check back soon.</p>';
    } else {
      grid.innerHTML = products
        .map((p) => window.s4lProductCardHTML(p, { reviewsConfig, showBasketButton: true }))
        .join('');
    }
  } catch (err) {
    console.error('IG landing page load failed:', err);
    grid.innerHTML = '<p>Could not load products right now — please try again shortly.</p>';
  }
})();
