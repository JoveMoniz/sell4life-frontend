(() => {
  const BASE = window.API_BASE;

  const slug = new URLSearchParams(window.location.search).get('slug');

  if (!slug) {
    showError('No store specified.');
    return;
  }

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

    grid.innerHTML = products.map(p => {
      const img = p.images?.[0]
        ? `<img src="${p.images[0]}" alt="${p.name}" loading="lazy" />`
        : '<span class="no-img">📦</span>';
      const href = p.slug ? `/product/product.html?slug=${p.slug}` : `/product/product.html?id=${p._id}`;
      const shipping = Number(p.shippingCost || 0) === 0
        ? '<span class="store-product-shipping">Free shipping</span>'
        : `<span class="store-product-shipping">+ £${Number(p.shippingCost).toFixed(2)} shipping</span>`;
      return `
        <a class="store-product-card" href="${href}">
          <div class="store-product-img">${img}</div>
          <div class="store-product-body">
            <div class="store-product-name">${p.name}</div>
            <div class="store-product-price">£${Number(p.price).toFixed(2)}</div>
            ${shipping}
          </div>
        </a>`;
    }).join('');
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
      document.getElementById('store-hero').style.display = 'block';
      renderProducts(products || []);
    } catch (err) {
      console.error('Store load error:', err);
      showError('Unable to load store. Please try again later.');
    }
  }

  load();
})();
