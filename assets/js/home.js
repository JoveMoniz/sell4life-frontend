// ── Live stats (product count + seller count) ──────────────
async function loadStats() {
  try {
    const [pRes, sRes] = await Promise.allSettled([
      fetch(`${window.API_BASE}/products`),
      fetch(`${window.API_BASE}/stores`),
    ]);

    if (pRes.status === 'fulfilled' && pRes.value.ok) {
      const d = await pRes.value.json();
      const count = d.pagination?.total ?? (Array.isArray(d.products) ? d.products.length : 0);
      const el = document.getElementById('stat-products');
      if (el && count > 0) el.textContent = count + '+';
    }

    if (sRes.status === 'fulfilled' && sRes.value.ok) {
      const d = await sRes.value.json();
      const count = (d.stores || []).length;
      const el = document.getElementById('stat-sellers');
      if (el && count > 0) el.textContent = count + '+';
    }
  } catch (e) { /* leave defaults */ }
}

// ── Category icons ─────────────────────────────────────────
// Maps category.json IDs to the value stored in the DB (where they differ)
const _catDbKey = { 'home-garden': 'home', 'health-beauty': 'health' };
const _toCatDb  = id => _catDbKey[id] || id;

// Category badges are a colour + custom line-icon combo, not a photo — real
// product photos varied wildly in framing/background and looked inconsistent
// side by side, and platform emoji render inconsistently (and look cartoonish)
// across OSes. Hand-drawn SVGs in one consistent stroke style read as a
// single polished set regardless of what's actually for sale in each
// category yet.
const _catIcon = {
  book: '<path d="M12 6.5c-1.5-1-4-1.5-6-1.2v12c2 0 4.5.5 6 1.7 1.5-1.2 4-1.7 6-1.7v-12c-2-.3-4.5.2-6 1.2z"/><path d="M12 6.5v12"/>',
  shirt: '<path d="M8 4l4 2 4-2 4 3-3 3-1-1v9H8v-9l-1 1-3-3 4-3z"/>',
  laptop: '<rect x="4" y="5" width="16" height="10" rx="1"/><path d="M2 19h20"/>',
  controller: '<path d="M6.5 9h11a3.5 3.5 0 013.4 4.3l-.5 2A3 3 0 0117 17.7l-2-2.2H9l-2 2.2a3 3 0 01-3.4-2.4l-.5-2A3.5 3.5 0 016.5 9z"/><path d="M7 9.2V12M5.5 10.5H8.5"/><circle cx="16.2" cy="10.8" r=".5" fill="#fff"/><circle cx="18.2" cy="12.6" r=".5" fill="#fff"/>',
  house: '<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  heart: '<path d="M12 20s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z"/><path d="M12 9v4M10 11h4"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.2l3.4 2.5-1.3 4H9.9l-1.3-4L12 7.2z"/><path d="M12 7.2V4.3M15.4 9.7l2.7-1.6M13.5 13.7l1.6 3.1M10.5 13.7l-1.6 3.1M8.6 9.7L5.9 8.1"/>',
  car: '<path d="M4 16l1.5-5A2 2 0 017.4 9.5h9.2a2 2 0 011.9 1.5L20 16"/><rect x="3" y="16" width="18" height="3.5" rx="1"/><circle cx="7.5" cy="19.7" r="1.2" fill="#fff"/><circle cx="16.5" cy="19.7" r="1.2" fill="#fff"/>',
  cutlery: '<path d="M7 3v6a1.5 1.5 0 003 0V3M8.5 9v12M7 3v3M10 3v3"/><path d="M16.5 3c-1.4 0-2.5 1.6-2.5 4.2v2.6c0 1 .5 1.8 1.4 2.1L15.2 21"/>',
  bottle: '<rect x="9" y="8" width="6" height="12" rx="2"/><path d="M10 8V5.5a1.5 1.5 0 011.5-1.5h1A1.5 1.5 0 0114 5.5V8"/><path d="M9 12.5h6M9 15.5h6"/>',
  paw: '<ellipse cx="8" cy="9" rx="1.5" ry="2"/><ellipse cx="12.5" cy="6.8" rx="1.5" ry="2"/><ellipse cx="17" cy="9" rx="1.5" ry="2"/><ellipse cx="12.5" cy="15.5" rx="4.2" ry="3.4"/>',
  palette: '<path d="M12 3a9 8 0 100 16c1.5 0 1.8-1.5.9-2.3-.8-.7-.3-2.2 1-2.2h2A4 4 0 0020 10c0-4-3.6-7-8-7z"/><circle cx="8" cy="10" r=".9" fill="#fff"/><circle cx="11" cy="7.3" r=".9" fill="#fff"/><circle cx="15.2" cy="8.5" r=".9" fill="#fff"/>',
  pen: '<path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z"/><path d="M13 7l3.5 3.5"/>',
  urn: '<path d="M9 3h6M10 3v3.2c0 .5-.2 1-.6 1.4C7.6 9.3 7 11 7 13c0 4 2.2 7 5 7s5-3 5-7c0-2-.6-3.7-2.4-5.4a2 2 0 01-.6-1.4V3"/>',
  suitcase: '<rect x="3.5" y="8" width="17" height="12" rx="2"/><path d="M9 8V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V8"/><path d="M3.5 13h17"/>',
  code: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 21h6M12 16v5"/><path d="M9.5 8.7L7.5 10.2l2 1.5M14.5 8.7l2 1.5-2 1.5"/>',
};

const _catBadge = {
  'books':          { icon: _catIcon.book,       color: '#f59e0b' },
  'fashion':        { icon: _catIcon.shirt,      color: '#ec4899' },
  'electronics':    { icon: _catIcon.laptop,     color: '#3b82f6' },
  'toys':           { icon: _catIcon.controller, color: '#8b5cf6' },
  'home-garden':    { icon: _catIcon.house,      color: '#10b981' },
  'health-beauty':  { icon: _catIcon.heart,      color: '#f43f5e' },
  'sports':         { icon: _catIcon.ball,       color: '#f97316' },
  'automotive':     { icon: _catIcon.car,        color: '#64748b' },
  'food':           { icon: _catIcon.cutlery,    color: '#ef4444' },
  'baby':           { icon: _catIcon.bottle,     color: '#0ea5e9' },
  'pets':           { icon: _catIcon.paw,        color: '#a16207' },
  'arts':           { icon: _catIcon.palette,    color: '#7c3aed' },
  'office':         { icon: _catIcon.pen,        color: '#0b6b6a' },
  'antiques':       { icon: _catIcon.urn,        color: '#92400e' },
  'travel':         { icon: _catIcon.suitcase,   color: '#06b6d4' },
  'software':       { icon: _catIcon.code,       color: '#4f46e5' },
};

async function loadCategories() {
  try {
    const [catRes, countRes] = await Promise.all([
      fetch('/data/category.json'),
      fetch(`${window.API_BASE}/products/category/counts`),
    ]);
    const categories = await catRes.json();
    const counts = countRes.ok ? await countRes.json() : null;

    const visible = counts
      ? categories.filter(cat => (counts[_toCatDb(cat.id)] || 0) > 0)
      : categories;

    const container = document.getElementById('s4l-categories');
    if (!container) return;

    container.innerHTML = visible.map(cat => {
      const badge = _catBadge[cat.id] || { icon: _catIcon.house, color: '#0b6b6a' };
      return `
      <a href="/shop/?category=${cat.id}" class="home-cat-item">
        <div class="home-cat-icon" style="background:${badge.color}">
          <svg class="home-cat-svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${badge.icon}</svg>
        </div>
        <span class="home-cat-label">${cat.name}</span>
      </a>`;
    }).join('');
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// ── Featured products ──────────────────────────────────────
let _rvCfg = { reviewsEnabled: false, reviewsMinCount: 3 };
fetch(`${window.API_BASE}/reviews/config`).then(r => r.ok ? r.json() : null).then(d => { if (d) _rvCfg = d; }).catch(() => {});

function heroFilmItemHTML(p) {
  const id = p._id || p.id;
  let img = '/assets/images/products/sell4life-placeholder.png';
  if (Array.isArray(p.images) && p.images[0]) {
    img = p.images[0].startsWith('http') ? p.images[0] : `/assets/images/products/${p.images[0]}`;
  }
  const href = p.slug
    ? `/product/product.html?slug=${encodeURIComponent(p.slug)}`
    : `/product/product.html?id=${id}`;
  const fmtPrice = window.s4lFormatPrice || ((n) => `£${Number(n || 0).toFixed(0)}`);
  return `
    <a href="${href}" class="hero-film-item">
      <img src="${img}" alt="${p.name}" loading="lazy"
        onerror="this.src='/assets/images/products/sell4life-placeholder.png'" />
      <span class="hero-film-price">${fmtPrice(p.price || 0)}</span>
    </a>`;
}

async function loadFeaturedProducts() {
  const container  = document.querySelector('.featured-products-grid');
  const filmstrip   = document.getElementById('hero-filmstrip');
  if (!container && !filmstrip) return;

  let products = [];

  try {
    const res = await fetch(`${window.API_BASE}/products`);
    const data = await res.json();
    products = Array.isArray(data.products) ? data.products : [];
  } catch (e) {}

  if (window.S4L_CURRENCY_READY) await window.S4L_CURRENCY_READY;

  if (filmstrip) {
    const filmItems = products.slice(0, 10);
    filmstrip.innerHTML = filmItems.map(heroFilmItemHTML).join('');
  }

  if (container) {
    const featured = products.slice(0, 8);
    if (!featured.length) {
      container.innerHTML = '<p style="text-align:center;color:#888;padding:40px 0">No products yet.</p>';
      return;
    }
    container.innerHTML = featured
      .map(p => window.s4lProductCardHTML(p, { reviewsConfig: _rvCfg, showBasketButton: true }))
      .join('');
    window.s4l_markOwnListings?.();
  }
}

// ── Init ───────────────────────────────────────────────────
function initHomePage() {
  loadStats();
  loadCategories();
  loadFeaturedProducts();
}

initHomePage();
document.addEventListener('layoutReady', initHomePage);
