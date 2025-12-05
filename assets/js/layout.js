// =====================================================
// 0. GLOBAL CACHE-BUSTER
// =====================================================
(function forceFreshAssets() {
    const stamp = Date.now();

    // Refresh CSS
    document.querySelectorAll('link[data-bust="true"]')
.forEach(link => {
        const clean = link.href.split('?')[0];
        link.href = clean + "?v=" + stamp;
    });

    // Refresh static JS (only /assets/js/)
    document.querySelectorAll('script[src]').forEach(script => {
        const src = script.getAttribute('src');
        if (src.startsWith("/assets/js/")) {
            const clean = src.split("?")[0];
            script.setAttribute("src", clean + "?v=" + stamp);
        }
    });
})();
    

// =====================================================
// 1. LOAD HEADER + FOOTER
// =====================================================
(async function loadLayout() {

    // HEADER
    try {
const res = await fetch("/includes/header.html?v=1", { cache: "force-cache" });
        const html = await res.text();
        document.body.insertAdjacentHTML("afterbegin", html);
        document.dispatchEvent(new Event("headerLoaded"));
    } catch (err) {
        console.error("Failed to load header:", err);
    }

    // FOOTER
    try {
        const res = await fetch("/includes/footer.html", { cache: "no-store" });
        const html = await res.text();
        document.body.insertAdjacentHTML("beforeend", html);
    } catch (err) {
        console.error("Failed to load footer:", err);
    }

})();
    

// =====================================================
// 2. LOAD CART.JS AFTER HEADER
// =====================================================
document.addEventListener("headerLoaded", () => {
    if (window.__cartScriptLoaded) return;

    const c = document.createElement("script");
    c.src = "/assets/js/cart.js?v=" + Date.now();
    document.body.appendChild(c);

    window.__cartScriptLoaded = true;
});


// =====================================================
// 3. LOAD SEARCH.JS AFTER HEADER
// =====================================================
document.addEventListener("headerLoaded", () => {
    if (window.__searchLoaded) return;

    const s = document.createElement("script");
    s.src = "/assets/js/search.js?v=" + Date.now();
    document.body.appendChild(s);

    window.__searchLoaded = true;
});



// =====================================================
// 4. DESKTOP MINI-CART HOVER + MOBILE TAP REDIRECT
// =====================================================

let miniCartTimeout;

document.addEventListener("headerLoaded", () => {

    // DESKTOP TARGETS ONLY
    const wrapper  = document.querySelector(".s4l-header-desktop .basket-wrapper");
    const miniCart = document.querySelector(".s4l-header-desktop .mini-cart");

    // DESKTOP MINICART HOVER
    if (wrapper && miniCart) {

        document.addEventListener("mouseover", e => {

            if (!wrapper.classList.contains("has-items")) {
                miniCart.style.display = "none";
                miniCart.style.opacity = "0";
                miniCart.style.visibility = "hidden";
                return;
            }

            if (wrapper.contains(e.target) || miniCart.contains(e.target)) {
                clearTimeout(miniCartTimeout);
                miniCart.style.display = "block";
                miniCart.style.opacity = "1";
                miniCart.style.visibility = "visible";
                return;
            }

            miniCartTimeout = setTimeout(() => {
                miniCart.style.opacity = "0";
                miniCart.style.visibility = "hidden";
                miniCart.style.display = "none";
            }, 200);
        });
    }

    // MOBILE TAP → CART PAGE
    const mobileBasket = document.querySelector(".s4l-header-mobile .mobile-basket");

    if (mobileBasket) {
        mobileBasket.addEventListener("click", () => {
            window.location.href = "/cart/cart.html";
        });
    }

});

