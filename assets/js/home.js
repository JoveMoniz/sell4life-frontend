// ── Live stats (product count + seller count) ──────────────
async function loadStats() {
  try {
    const [pRes, sRes] = await Promise.allSettled([
      fetch(`${window.API_BASE}/products`),
      fetch(`${window.API_BASE}/stores`),
    ]);

    if (pRes.status === 'fulfilled' && pRes.value.ok) {
      const d = await pRes.value.json();
      const count = Array.isArray(d.products) ? d.products.length : 0;
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

    container.innerHTML = visible.map(cat => `
      <a href="/shop/?category=${cat.id}" class="home-cat-item">
        <div class="home-cat-icon">
          <img src="${cat.image}" alt="${cat.name}" loading="lazy"
            onerror="this.onerror=null;this.src='/assets/images/products/sell4life-placeholder.png'" />
        </div>
        <span class="home-cat-label">${cat.name}</span>
      </a>`
    ).join('');
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// ── Promo slider ───────────────────────────────────────────
async function initPromoSlider() {
  const track  = document.getElementById('promo-track');
  const dotsEl = document.getElementById('promo-dots');
  const prev   = document.getElementById('promo-prev');
  const next   = document.getElementById('promo-next');
  if (!track) return;

  let banners = [];
  try {
    const res = await fetch('/data/banners.json');
    banners = await res.json();
  } catch { return; }

  if (!banners.length) return;

  // Render slides
  track.innerHTML = banners.map((b, i) => `
    <div class="promo-slide${i === 0 ? ' active' : ''}" data-index="${i}">
      <div class="promo-slide-bg" style="${
        b.image
          ? `background-image:url('${b.image}');`
          : `background-color:${b.bg || '#0b6b6a'};`
      }"></div>
      <div class="promo-slide-overlay"></div>
      <div class="promo-slide-content">
        <h2>${b.headline}</h2>
        <p>${b.subtext}</p>
        <a href="${b.href}" class="promo-slide-cta">${b.cta}</a>
      </div>
    </div>
  `).join('');

  // Render dots
  if (dotsEl) {
    dotsEl.innerHTML = banners.map((_, i) => `
      <button type="button" class="promo-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Slide ${i + 1}"></button>
    `).join('');
  }

  const slides = track.querySelectorAll('.promo-slide');
  const dots   = dotsEl ? dotsEl.querySelectorAll('.promo-dot') : [];
  let current  = 0;
  let timer;

  function goTo(n) {
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');
    current = (n + banners.length) % banners.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
  }

  function startAuto() {
    timer = setInterval(() => goTo(current + 1), 5000);
  }

  function stopAuto() {
    clearInterval(timer);
  }

  if (prev) prev.addEventListener('click', () => { stopAuto(); goTo(current - 1); startAuto(); });
  if (next) next.addEventListener('click', () => { stopAuto(); goTo(current + 1); startAuto(); });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      stopAuto();
      goTo(parseInt(dot.dataset.index, 10));
      startAuto();
    });
  });

  // Touch swipe
  let touchX = 0;
  track.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { stopAuto(); goTo(dx < 0 ? current + 1 : current - 1); startAuto(); }
  }, { passive: true });

  // Pause on hover
  track.addEventListener('mouseenter', stopAuto);
  track.addEventListener('mouseleave', startAuto);

  if (banners.length > 1) startAuto();
}

// ── Featured products ──────────────────────────────────────
let _rvCfg = { reviewsEnabled: false, reviewsMinCount: 3 };
fetch(`${window.API_BASE}/reviews/config`).then(r => r.ok ? r.json() : null).then(d => { if (d) _rvCfg = d; }).catch(() => {});

async function loadFeaturedProducts() {
  const container = document.querySelector('.featured-products-grid');
  if (!container) return;

  let products = [];

  try {
    const res = await fetch(`${window.API_BASE}/products`);
    const data = await res.json();
    products = Array.isArray(data.products) ? data.products : [];
  } catch (e) {}

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

// ── Init ───────────────────────────────────────────────────
function initHomePage() {
  loadStats();
  loadCategories();
  loadFeaturedProducts();
  initPromoSlider();
}

initHomePage();
document.addEventListener('layoutReady', initHomePage);
