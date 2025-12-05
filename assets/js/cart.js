// ======================================================================
// SELL4LIFE CART.JS — Final Stable Version (with empty-cart hover fix)
// ======================================================================

(async function () {

    // ---------------------------------------------------------
    // 0. Wait for header + minicart structure to exist
    // ---------------------------------------------------------
    let attempts = 0;
    while (
        !document.querySelector(".basket-wrapper") ||
        !document.querySelector(".mini-cart-items")
    ) {
        attempts++;
        if (attempts > 80) {
            console.warn("Header did not load. Cart.js aborted.");
            return;
        }
        await new Promise(r => setTimeout(r, 50));
    }

    // ---------------------------------------------------------
    // 1. LocalStorage SAFE read
    // ---------------------------------------------------------
    function readCart() {
        try {
            const arr = JSON.parse(localStorage.getItem("cart") || "[]");
            return Array.isArray(arr) ? arr.filter(x => x && x.id) : [];
        } catch {
            return [];
        }
    }

    function saveCart() {
        localStorage.setItem("cart", JSON.stringify(cart));
    }

    let cart = readCart();

    // ---------------------------------------------------------
    // 2. DOM references
    // ---------------------------------------------------------
    const miniCartList  = document.querySelector(".mini-cart-items");
    const miniCartTotal = document.querySelector(".mini-cart-total");

    // Optional (cart page only)
    const colProduct  = document.getElementById("col-product");
    const colQty      = document.getElementById("col-qty");
    const colPrice    = document.getElementById("col-price");
    const colSubtotal = document.getElementById("col-subtotal");
    const colRemove   = document.getElementById("col-remove");
    const totalSpan   = document.getElementById("cart-total");

    // ---------------------------------------------------------
    // 3. BADGE UPDATER
    // ---------------------------------------------------------
    function updateBadge() {
        const count = cart.reduce((s, i) => s + (i.quantity || 0), 0);
        document.querySelectorAll(".basket-qty").forEach(b => {
            b.textContent = count;
            b.classList.toggle("hide", count === 0);
        });
    }

    // ---------------------------------------------------------
    // 4. RENDER MINICART
    // ---------------------------------------------------------
    function renderMiniCart() {
        if (!miniCartList || !miniCartTotal) return;

        miniCartList.innerHTML = "";

        if (!cart.length) {
            miniCartList.innerHTML =
                `<li><div class='mini-cart-empty'>No items in basket.</div></li>`;
            miniCartTotal.innerHTML = `£0.00`;
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
                    <img src="${item.image}" class="mini-cart-thumb">
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

    // ---------------------------------------------------------
    // 5. RENDER CART PAGE
    // ---------------------------------------------------------
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

        cart.forEach((item, i) => {
            const price = Number(item.price);
            const qty   = Number(item.quantity);
            const sub   = price * qty;
            total += sub;

            colProduct.innerHTML += `
                <div class="cart-product-info">
                    <a href="/${item.category}/${item.subcategory}/?id=${item.id}" class="cart-product-link">
                        <img src="${item.image}" class="cart-thumb">
                        <span>${item.name}</span>
                    </a>
                </div>
            `;

            colQty.innerHTML += `
                <div class="qty-control">
                    <button class="qty-minus" data-index="${i}">−</button>
                    <span class="qty-value">${qty}</span>
                    <button class="qty-plus" data-index="${i}">+</button>
                </div>
            `;

            colPrice.innerHTML    += `<div>£${price.toFixed(2)}</div>`;
            colSubtotal.innerHTML += `<div>£${sub.toFixed(2)}</div>`;
            colRemove.innerHTML   += `
                <div class="remove-wrap">
                    <button class="remove-item" data-index="${i}">×</button>
                </div>
            `;
        });

        totalSpan.textContent = total.toFixed(2);
    }

    // ---------------------------------------------------------
    // 6. FULL REFRESH
    // ---------------------------------------------------------
    function refreshAll() {
        cart = readCart();
        renderMiniCart();
        updateBadge();
        renderCartPage();
    }

    refreshAll();
    document.addEventListener("cartUpdated", refreshAll);

    // ---------------------------------------------------------
    // 7. QTY / REMOVE BUTTONS
    // ---------------------------------------------------------
    document.addEventListener("click", e => {
        if (e.target.classList.contains("qty-plus")) {
            const i = +e.target.dataset.index;
            cart[i].quantity++;
            saveCart();
            refreshAll();
        }

        if (e.target.classList.contains("qty-minus")) {
            const i = +e.target.dataset.index;
            cart[i].quantity > 1 ?
                cart[i].quantity-- :
                cart.splice(i, 1);
            saveCart();
            refreshAll();
        }

        if (e.target.classList.contains("remove-item")) {
            const i = +e.target.dataset.index;
            cart.splice(i, 1);
            saveCart();
            refreshAll();
        }
    });

    // ---------------------------------------------------------
    // 8. CLEAR CART
    // ---------------------------------------------------------
    document.addEventListener("click", e => {
        if (e.target.id === "clear-cart") {
            document.querySelector(".clear-cart-modal")?.classList.add("show");
        }

        if (e.target.classList.contains("confirm-clear")) {
            cart = [];
            saveCart();
            refreshAll();
            document.querySelector(".clear-cart-modal")?.classList.remove("show");
        }

        if (e.target.classList.contains("cancel-clear")) {
            document.querySelector(".clear-cart-modal")?.classList.remove("show");
        }
    });

    // ---------------------------------------------------------
    // 9. MOBILE MINI CART
    // ---------------------------------------------------------
    document.addEventListener("click", e => {
        const mobileBasket = document.querySelector(".s4l-header-mobile .basket-shell");
        const miniCart     = document.querySelector(".mini-cart");

        if (!mobileBasket || !miniCart) return;

        if (mobileBasket.contains(e.target)) {
            miniCart.style.display = "block";
            miniCart.style.opacity = "1";
            miniCart.style.visibility = "visible";
            return;
        }

        if (!miniCart.contains(e.target)) {
            miniCart.style.display = "none";
            miniCart.style.opacity = "0";
            miniCart.style.visibility = "hidden";
        }
    });

    // ---------------------------------------------------------
    // 10. DESKTOP HOVER LOGIC (only if cart has items)
    // ---------------------------------------------------------
    let miniCartTimeout;
    const isTouch = matchMedia("(hover: none)").matches;

    if (!isTouch) {
        document.addEventListener("mouseover", e => {
            const wrap = document.querySelector(".basket-wrapper");
            const mini = document.querySelector(".mini-cart");

            if (!wrap || !mini) return;

            // 🟧 SHOW ONLY IF CART HAS ITEMS
            if (wrap.contains(e.target) || mini.contains(e.target)) {
                const cartNow = readCart();
                if (!cartNow.length) return;

                clearTimeout(miniCartTimeout);
                mini.style.display = "block";
                mini.style.opacity = "1";
                mini.style.visibility = "visible";
                return;
            }

            miniCartTimeout = setTimeout(() => {
                mini.style.display = "none";
                mini.style.opacity = "0";
                mini.style.visibility = "hidden";
            }, 200);
        });
    }

})();


// ======================================================================
// 11. CHECKOUT BUTTON
// ======================================================================
document.addEventListener("click", e => {
    const btn = e.target.closest("#btn-buy");
    if (btn) window.location.href = "/cart/checkout.html";
});
