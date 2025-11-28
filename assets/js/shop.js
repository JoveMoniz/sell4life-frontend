// /frontend/assets/js/shop.js

(async function () { 
  console.log("shop.js loaded");

  const container = document.getElementById("product-list");

  // Always use clean absolute paths in frontend
  const IMAGE_BASE = "/assets/images/products/";

  // ---------------------------------------------------------
  // 1. Load products.json
  // ---------------------------------------------------------
  let products = [];
  try {
    const res = await fetch("/data/products.json", { cache: "no-store" });
    products = await res.json();
  } catch (err) {
    console.error("Failed to load /data/products.json:", err);
    container.innerHTML = `<p>Could not load products.</p>`;
    return;
  }

  // ---------------------------------------------------------
  // 2. Read ALL query parameters once
  // ---------------------------------------------------------
  const params = new URLSearchParams(window.location.search);

  const searchTerm = params.get("q")?.toLowerCase() || "";
  const selectedCategory = params.get("category");
  const selectedSub = params.get("subcategory");

  console.log("Search term:", searchTerm);
  console.log("Category:", selectedCategory);
  console.log("Subcategory:", selectedSub);

  // ---------------------------------------------------------
  // 3. FILTER the products
  // ---------------------------------------------------------
  let filtered = products;

  // Filter by category
  if (selectedCategory) {
    filtered = filtered.filter(p => p.category === selectedCategory);
  }

  // Filter by subcategory
  if (selectedSub) {
    filtered = filtered.filter(p => p.subcategory === selectedSub);
  }

  // Filter by SEARCH TEXT
  if (searchTerm) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchTerm)
    );
  }

  // ---------------------------------------------------------
  // 4. HANDLE NO RESULTS
  // ---------------------------------------------------------
  if (filtered.length === 0) {
    container.innerHTML = `<p>No products found.</p>`;
    return;
  }

  // ---------------------------------------------------------
  // 5. RENDER PRODUCTS
  // ---------------------------------------------------------
  container.innerHTML = filtered.map(p => `
    <div class="product-card">
      <a href="/product/product.html?id=${p.id}">
        <img src="${IMAGE_BASE + p.images[0]}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>£${p.price.toFixed(2)}</p>
      </a>
    </div>
  `).join("");

  document.dispatchEvent(new Event("searchReady"));

})();

