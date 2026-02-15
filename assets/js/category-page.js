// /assets/js/category-page.js
// Universal logic for ALL category pages

(async function () {

  console.log("category-page.js loaded");

  const CATEGORY_JSON_URL  = "/data/category.json";
  const PRODUCTS_JSON_URL  = "/data/products.json";
  const PRODUCT_IMAGE_BASE = "/assets/images/products/";

  // ---------------------------------------
  // Helpers
  // ---------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);

  function featuredCardHtml(p) {
    return `
      <a class="featured-item" href="/product/product.html?id=${p.id}">
        <img src="${p.image}" alt="${p.name}">
        <h3>${p.name}</h3>
        <div class="price">£${p.price}</div>
      </a>
    `;
  }

  function getCategoryIdFromPath() {
    const parts = location.pathname.split("/").filter(Boolean);
    const last  = parts[parts.length - 1] || "";
    return last.replace(".html", "").toLowerCase();
  }

  function makePrice(p) {
    const currency = p.currency || "£";
    const value    = Number(p.price || 0);
    return currency + value.toFixed(2);
  }

  function productCardHtml(p) {
    const imgFile = (p.images && p.images[0]) ? p.images[0] : "";
    const imgSrc  = imgFile ? (PRODUCT_IMAGE_BASE + imgFile) : "";
    const price   = makePrice(p);

    return `
      <div class="product-card">
        <a href="/product/product.html?id=${encodeURIComponent(p.id)}">
          ${imgSrc ? `<img src="${imgSrc}" alt="${p.name}">` : ""}
          <h3>${p.name}</h3>
          <p class="product-price">${price}</p>
        </a>
      </div>
    `;
  }

  // ---------------------------------------
  // Resolve category
  // ---------------------------------------
  const categoryId = getCategoryIdFromPath();
  if (!categoryId) return;

  let categories = [];
  let products   = [];

  try {
    const [catRes, prodRes] = await Promise.all([
      fetch(CATEGORY_JSON_URL, { cache: "no-store" }),
      fetch(PRODUCTS_JSON_URL, { cache: "no-store" })
    ]);

    categories = await catRes.json();
    products   = await prodRes.json();

  } catch (err) {
    console.error("[category-page] Failed loading JSON:", err);
    return;
  }

  const category = categories.find(
    c => (c.id || "").toLowerCase() === categoryId
  );

  const catProducts = products.filter(
    p => (p.category || "").toLowerCase() === categoryId
  );

  // ---------------------------------------
  // FEATURED
  // ---------------------------------------
  const featuredWrap = $("#featured-list");

  if (featuredWrap) {
    const featured = catProducts.slice(0, 2);

    if (!featured.length) {
      featuredWrap.innerHTML =
        `<p class="empty-note">No featured products yet.</p>`;
    } else {
      featuredWrap.innerHTML = featured.map(p =>
        featuredCardHtml({
          id: p.id,
          name: p.name,
          price: Number(p.price).toFixed(2),
          image: PRODUCT_IMAGE_BASE + (p.images?.[0] || "")
        })
      ).join("");
    }
  }

  // ---------------------------------------
  // SUBCATEGORIES
  // ---------------------------------------
  const subcatWrap = $("#subcategory-cards");

  if (subcatWrap && category && Array.isArray(category.subcategories)) {
    subcatWrap.innerHTML = category.subcategories.map(sub => {

      const href =
        `/shop/index.html?category=${encodeURIComponent(category.id)}&subcategory=${encodeURIComponent(sub.id)}`;

      const imgSrc = sub.image
        ? sub.image
        : `/assets/images/category/${category.id}/${sub.id}.png`;

      return `
        <a href="${href}" class="subcat-card">
          <div class="subcat-thumb">
            <img src="${imgSrc}" alt="${sub.name}">
          </div>
          <span class="subcat-name">${sub.name}</span>
        </a>
      `;
    }).join("");
  }

  // ---------------------------------------
  // ALL PRODUCTS
  // ---------------------------------------
  const productsWrap = $("#category-product-grid");

  if (productsWrap) {
    if (!catProducts.length) {
      productsWrap.innerHTML =
        `<p class="empty-note">No products found in this category yet.</p>`;
    } else {
      productsWrap.innerHTML =
        catProducts.map(productCardHtml).join("");
    }
  }

  // ---------------------------------------
  // Titles
  // ---------------------------------------
  if (category) {
    const allTitle = $(".category-products h2");
    if (allTitle) allTitle.textContent = `All ${category.name}`;

    const shopAllBtn = document.querySelector(".btn-shop-all");
    if (shopAllBtn) {
      shopAllBtn.textContent = `Shop All ${category.name}`;
      shopAllBtn.setAttribute(
        "href",
        `/shop/index.html?category=${encodeURIComponent(category.id)}`
      );
    }
  }

})();
