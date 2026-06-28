(() => {
  const BASE = window.API_BASE;

  const slug = new URLSearchParams(window.location.search).get('slug');

  if (!slug) {
    showError('No store specified.');
    return;
  }

  let _rvCfg = { reviewsEnabled: false, reviewsMinCount: 3 };
  fetch(`${BASE}/reviews/config`).then(r => r.ok ? r.json() : null).then(d => { if (d) _rvCfg = d; }).catch(() => {});

  function showError(msg) {
    const el = document.getElementById('store-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
    const hero = document.getElementById('store-hero');
    if (hero) hero.style.display = 'none';
  }

  function avatarHTML(store) {
    const el = document.getElementById('store-logo');
    if (!el) return;
    if (store.storeLogo) {
      el.innerHTML = `<img src="${store.storeLogo}" alt="${store.storeName}" />`;
    } else {
      el.textContent = store.storeName.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }
  }

  function renderProducts(products) {
    const grid = document.getElementById('store-products-grid');
    const section = document.getElementById('store-products-section');
    const heading = document.getElementById('products-heading');
    if (!grid || !section) return;

    if (!products.length) {
      grid.innerHTML = '<div class="store-empty">No products listed yet.</div>';
      section.style.display = 'block';
      return;
    }

    heading.textContent = `Products (${products.length})`;
    section.style.display = 'block';

    grid.innerHTML = products
      .map(p => window.s4lProductCardHTML(p, { reviewsConfig: _rvCfg, showBasketButton: true }))
      .join('');
    window.s4l_markOwnListings?.();
  }

  async function load() {
    try {
      const res = await fetch(`${BASE}/stores/${encodeURIComponent(slug)}`);
      if (res.status === 404) { showError('Store not found.'); return; }
      if (!res.ok) throw new Error('Server error');

      const { store, products } = await res.json();

      document.title = `${store.storeName} | Sell4Life`;

      document.getElementById('store-name').textContent = store.storeName;
      document.getElementById('store-slug').textContent = `@${store.storeSlug}`;
      const descEl = document.getElementById('store-desc');
      descEl.textContent = store.storeDescription || '';
      descEl.style.display = store.storeDescription ? 'block' : 'none';

      const countEl = document.getElementById('store-product-count');
      countEl.textContent = `${store.productCount} product${store.productCount === 1 ? '' : 's'}`;

      const joinedEl = document.getElementById('store-joined');
      if (store.createdAt) {
        joinedEl.textContent = `Joined ${new Date(store.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
      }

      avatarHTML(store);
      const heroEl = document.querySelector('.store-profile-hero');
      if (heroEl && store.storeBanner) {
        heroEl.style.backgroundImage = `linear-gradient(rgba(11,107,106,0.55), rgba(11,107,106,0.55)), url('${store.storeBanner}')`;
        heroEl.style.backgroundSize = 'cover';
        heroEl.style.backgroundPosition = 'center';
      }
      document.getElementById('store-hero').style.display = 'block';
      renderProducts(products || []);
    } catch (err) {
      console.error('Store load error:', err);
      showError('Unable to load store. Please try again later.');
    }
  }

  load();
})();
