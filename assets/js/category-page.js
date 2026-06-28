// ======================================================
// CATEGORY PAGE (MODERN + DEFENSIVE VERSION)
// ======================================================

(async function () {
  console.log('category-page.js loaded');

  // ======================================================
  // CONFIG
  // ======================================================
  const API_URL = `${window.API_BASE}/products`;
  const CATEGORY_JSON_URL = '/data/category.json';

  // Reviews config (fetched once; used in card rendering)
  let _rvCfg = { reviewsEnabled: false, reviewsMinCount: 3 };
  fetch(`${window.API_BASE}/reviews/config`).then(r => r.ok ? r.json() : null).then(d => { if (d) _rvCfg = d; }).catch(() => {});

  // ======================================================
  // HELPERS
  // ======================================================

  const $ = (sel, root = document) => root.querySelector(sel);

  const normalize = (str = '') => str.toLowerCase().replace(/\s+/g, '-');

  // ======================================================
  // LOAD PRODUCTS (API + FALLBACK)
  // ======================================================
  async function loadProducts() {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();

      const products = data.products;

      if (Array.isArray(products) && products.length > 0) {
        console.log('Using API products');
        return products;
      }

      throw new Error('API empty');
    } catch (err) {
      console.warn('Fallback to products.json');

      const res = await fetch('/data/products.json', { cache: 'no-store' });
      return res.json();
    }
  }

  // Single source of truth is window.s4lProductCardHTML (product-card.js),
  // shared with shop/store/home so every page shows products identically,
  // including the shipping label.
  const productCardHtml = (p) => window.s4lProductCardHTML(p, { reviewsConfig: _rvCfg, showBasketButton: true });

  // ======================================================
  // RESOLVE CATEGORY FROM URL
  // ======================================================

  function getCategoryIdFromPath() {
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    return last.replace('.html', '').toLowerCase();
  }

  const categoryId = getCategoryIdFromPath();
  if (!categoryId) return;

  // ======================================================
  // REDIRECT IF CATEGORY HAS NO PRODUCTS
  // ======================================================

  try {
    const _dbKey = { 'home-garden': 'home', 'health-beauty': 'health' };
    const dbCat  = _dbKey[categoryId] || categoryId;
    const cntRes = await fetch(`${window.API_BASE}/products/category/counts`);
    if (cntRes.ok) {
      const counts = await cntRes.json();
      if ((counts[dbCat] || 0) === 0) {
        location.replace('/shop/');
        return;
      }
    }
  } catch { /* non-fatal — proceed to show the page */ }

  // ======================================================
  // LOAD DATA
  // ======================================================

  let categories = [];
  let products = [];

  try {
    const [catRes, prodData] = await Promise.all([
      fetch(CATEGORY_JSON_URL, { cache: 'no-store' }),
      loadProducts(),
    ]);

    categories = await catRes.json();
    products = prodData;
  } catch (err) {
    console.error('Failed loading data:', err);
    return;
  }

  // ======================================================
  // MATCH CATEGORY
  // ======================================================

  const category = categories.find((c) => normalize(c.id) === categoryId);

  // ======================================================
  // FUTURE-PROOF CATEGORY + SUBCATEGORY FILTER
  // ======================================================

  const urlParams = new URLSearchParams(location.search);
  const subcategoryId = normalize(urlParams.get('subcategory') || '');

  console.log('Category:', categoryId);
  console.log('Subcategory:', subcategoryId);

  const catProducts = products.filter((p) => {
    if (!p.category) return false;

    const matchCategory = normalize(p.category) === categoryId;

    // no subcategory yet → only filter by category
    if (!subcategoryId) return matchCategory;

    // future: filter by subcategory too
    const matchSubcategory = p.subcategory && normalize(p.subcategory) === subcategoryId;

    return matchCategory && matchSubcategory;
  });
  // ======================================================
  // FEATURED SECTION
  // ======================================================

  const featuredWrap = $('#featured-list');

  if (featuredWrap) {
    const featured = catProducts.slice(0, 2);

    featuredWrap.innerHTML = featured.length
      ? featured.map(productCardHtml).join('')
      : `<p class="empty-note">No featured products yet.</p>`;
    window.s4l_markOwnListings?.();
  }

  // ======================================================
  // SUBCATEGORIES
  // ======================================================

  const subcatWrap = $('#subcategory-cards');

  if (subcatWrap && category?.subcategories) {
    subcatWrap.innerHTML = category.subcategories
      .map((sub) => {
        const href = `/shop/index.html?category=${encodeURIComponent(category.id)}&subcategory=${encodeURIComponent(sub.id)}`;
        const imgSrc = sub.image || `/assets/images/category/${category.id}/${sub.id}.png`;

        return `
          <a href="${href}" class="subcat-card">
            <div class="subcat-thumb">
              <img src="${imgSrc}" alt="${sub.name}">
            </div>
            <span class="subcat-name">${sub.name}</span>
          </a>
        `;
      })
      .join('');
  }

  // ======================================================
  // ALL PRODUCTS GRID
  // ======================================================

  const productsWrap = $('#category-product-grid');

  if (productsWrap) {
    productsWrap.innerHTML = catProducts.length
      ? catProducts.map(productCardHtml).join('')
      : `<p class="empty-note">No products found in this category yet.</p>`;
    window.s4l_markOwnListings?.();
  }

  // ======================================================
  // UI TITLES
  // ======================================================

  if (category) {
    const title = $('.category-products h2');
    if (title) title.textContent = `All ${category.name}`;

    const shopBtn = $('.btn-shop-all');
    if (shopBtn) {
      shopBtn.textContent = `Shop All ${category.name}`;
      shopBtn.href = `/shop/index.html?category=${encodeURIComponent(category.id)}`;
    }
  }
})();
