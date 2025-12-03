// /assets/js/cart.js
(async function () {

  // Wait for header (both desktop + mobile)
  await new Promise(r => setTimeout(r, 50));

  // Skip if minicart does not exist
  if (!document.querySelector(".mini-cart-items")) {
    console.log("cart.js skipped on non-cart pages");
    return;
  }

  // Prevent double loading
  if (window.__cartBooted) return;
  window.__cartBooted = true;

  // -----------------------------------
  // SAFE CART READ
  // -----------------------------------
  function readCart() {
    try {
      const arr = JSON.parse(localStorage.getItem("cart") || "[]");
      return Array.isArray(arr) ? arr.filter(x => x && x.id) : [];
    } catch {
      return [];
    }
  }

  let cart = readCart();

  function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart));
  }

  // -----------------------------------
  // ELEMENTS
  // -----------------------------------
  const miniCartList  = document.querySelector(".mini-cart-items");
  const miniCartTotal = document.querySelector(".mini-cart-total");

  // Cart page columns (may not exist)
  const colProduct  = document.getElementById("col-product");
  const colQty      = document.getElementById("col-qty");
  const colPrice    = document.getElementById("col-price");
  const colSubtotal = document.getElementById("col-subtotal");
  const colRemove   = document.getElementById("col-remove");
  const totalSpan   = document.getElementById("cart-total");

  // -----------------------------------
  // BADGE (desktop + mobile)
  // -----------------------------------
  function updateBadge() {
    const count = cart.reduce((s, i) => s + (i.quantity || 0), 0);

    document.querySelectorAll(".basket-qty").forEach(badge => {
      badge.textContent = count;
      badge.classList.toggle("hide", count === 0);
    });
  }

  // -----------------------------------
  // MINI CART RENDER
  // -----------------------------------
  function renderMiniCart() {
    miniCartList.innerHTML = "";

    if (!cart.length) {
      miniCartList.innerHTML =
        `<li><div class="mini-cart-empty">No items in basket.</div></li>`;
      miniCartTotal.textContent = "£0.00";
      return;
    }

    let total = 0;

    cart.forEach(item => {
      const price = Number(item.price);
      const qty   = Number(item.quantity);
      const sub   = price * qty;
      total += sub;

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="mini-cart-item">
          <img src="${item.image || ''}" alt="${item.name}" class="mini-cart-thumb" />
          <div class="mini-cart-info">
            <div class="mini-cart-name">${item.name}</div>
            <div class="mini-cart-meta">£${price.toFixed(2)} × ${qty}</div>
          </div>
          <div class="mini-cart-sub">£${sub.toFixed(2)}</div>
        </div>
      `;
      miniCartList.appendChild(li);
    });

    miniCartTotal.innerHTML = `
      <div class="mini-cart-total-line">
        <span class="mini-cart-total-label">Total:</span>
        <span class="mini-cart-total-value">£${total.toFixed(2)}</span>
      </div>
    `;
  }

  // -----------------------------------
  // CART PAGE (FULL PAGE) RENDER
  // -----------------------------------
  function renderCartPage() {
    if (!colProduct) return;

    colProduct.innerHTML  = "";
    colQty.innerHTML      = "";
    colPrice.innerHTML    = "";
    colSubtotal.innerHTML = "";
    colRemove.innerHTML   = "";

    if (!cart.length) {
      totalSpan.textContent = "0.00";
      return;
    }

    let total = 0;

    cart.forEach((item, index) => {
      const price = Number(item.price);
      const qty   = Number(item.quantity);
      const sub   = price * qty;
      total += sub;

      // Product cell
      const p = document.createElement("div");
      p.className = "cart-product-info";

      const link = document.createElement("a");
      link.href = `/${item.category}/${item.subcategory}/?id=${item.id}`;
      link.className = "cart-product-link";

      const img = document.createElement("img");
      img.src = item.image || "";
      img.alt = item.name;
      img.className = "cart-thumb";

      const name = document.createElement("span");
      name.textContent = item.name;

      link.appendChild(img);
      link.appendChild(name);
      p.appendChild(link);
      colProduct.appendChild(p);

      // Qty
      const qc = document.createElement("div");
      qc.className = "qty-control";

      qc.innerHTML = `
        <button class="qty-minus" data-index="${index}">−</button>
        <span class="qty-value">${qty}</span>
        <button class="qty-plus" data-index="${index}">+</button>
      `;

      colQty.appendChild(qc);

      // Price
      colPrice.innerHTML += `<div>£${price.toFixed(2)}</div>`;

      // Subtotal
      colSubtotal.innerHTML += `<div>£${sub.toFixed(2)}</div>`;

      // Remove
      colRemove.innerHTML += `
        <div class="remove-wrap">
          <button class="remove-item" data-index="${index}">×</button>
        </div>
      `;
    });

    totalSpan.textContent = total.toFixed(2);
  }

  // -----------------------------------
  // FULL REFRESH
  // -----------------------------------
  function refreshAll() {
    cart = readCart();
    renderMiniCart();
    updateBadge();
    renderCartPage();
  }

  // -----------------------------------
  // QTY / REMOVE BUTTONS
  // -----------------------------------
  document.addEventListener("click", e => {

    if (e.target.classList.contains("qty-plus")) {
      const i = +e.target.dataset.index;
      cart[i].quantity++;
      saveCart();
      refreshAll();
      return;
    }

    if (e.target.classList.contains("qty-minus")) {
      const i = +e.target.dataset.index;
      cart[i].quantity > 1
        ? cart[i].quantity--
        : cart.splice(i, 1);
      saveCart();
      refreshAll();
      return;
    }

    if (e.target.classList.contains("remove-item")) {
      const i = +e.target.dataset.index;
      cart.splice(i, 1);
      saveCart();
      refreshAll();
      return;
    }
  });


// -----------------------------------
// CLEAR CART LOGIC
// -----------------------------------
document.addEventListener("click", e => {

  // OPEN CLEAR MODAL
  if (e.target.id === "clear-cart") {
    const modal = document.querySelector(".clear-cart-modal");
    if (modal) modal.classList.add("show");
    return;
  }

  // CONFIRM CLEAR
  if (e.target.classList.contains("confirm-clear")) {
    cart = [];
    localStorage.setItem("cart", JSON.stringify(cart));
    refreshAll();

    const modal = document.querySelector(".clear-cart-modal");
    if (modal) modal.classList.remove("show");
    return;
  }

  // CANCEL CLEAR
  if (e.target.classList.contains("cancel-clear")) {
    const modal = document.querySelector(".clear-cart-modal");
    if (modal) modal.classList.remove("show");
    return;
  }
});



  // -----------------------------------
  // INITIAL RENDER
  // -----------------------------------
  refreshAll();

})(); // END IIFE



/* =========================================================
   MOBILE BASKET TOGGLE
========================================================= */
document.addEventListener("click", e => {
  const mobileWrap = document.getElementById("basket-wrapper-mobile");
  const miniCart   = document.querySelector(".mini-cart");

  if (!mobileWrap || !miniCart) return;

  if (mobileWrap.contains(e.target)) {
    miniCart.style.display    = "block";
    miniCart.style.opacity    = "1";
    miniCart.style.visibility = "visible";
    return;
  }

  if (!miniCart.contains(e.target)) {
    miniCart.style.display    = "none";
    miniCart.style.opacity    = "0";
    miniCart.style.visibility = "hidden";
  }
});


// BUY BUTTON SHORTCUT
document.addEventListener("click", e => {
  if (e.target.id === "btn-buy") {
    window.location.href = "/cart/checkout.html";
  }
});
