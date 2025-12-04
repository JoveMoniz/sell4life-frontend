// =====================================================
// 0. GLOBAL CACHE-BUSTER
// Forces browsers to always load the newest CSS + JS
// =====================================================
(function forceFreshAssets() {
    const stamp = Date.now();

    // Refresh CSS
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const clean = link.href.split('?')[0];
        link.href = clean + "?v=" + stamp;
    });

    // Refresh static JS (not dynamically injected ones)
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

    // LOAD HEADER
    try {
        const res = await fetch("/includes/header.html", { cache: "no-store" });
        const html = await res.text();
        document.body.insertAdjacentHTML("afterbegin", html);

        // Tell the world header exists
        document.dispatchEvent(new Event("headerLoaded"));
    } catch (err) {
        console.error("Failed to load header:", err);
    }

    // LOAD FOOTER
    try {
        const res = await fetch("/includes/footer.html", { cache: "no-store" });
        const html = await res.text();
        document.body.insertAdjacentHTML("beforeend", html);
    } catch (err) {
        console.error("Failed to load footer:", err);
    }

})();
    


// =====================================================
// 2. LOAD CART.JS only AFTER header exists
// =====================================================
document.addEventListener("headerLoaded", () => {
    if (window.__cartScriptLoaded) return;

    const c = document.createElement("script");
    c.src = "/assets/js/cart.js?v=" + Date.now();
    document.body.appendChild(c);

    window.__cartScriptLoaded = true;
});


// =====================================================
// 3. LOAD SEARCH.JS only AFTER header exists
// =====================================================
document.addEventListener("headerLoaded", () => {
    if (window.__searchLoaded) return;

    const s = document.createElement("script");
    s.src = "/assets/js/search.js?v=" + Date.now();
    document.body.appendChild(s);

    window.__searchLoaded = true;
});



// =====================================================
// 4. DESKTOP MINI-CART HOVER DELAY (Smooth)
// =====================================================
let miniCartTimeout;

document.addEventListener("mouseover", e => {
    const wrapper = document.querySelector(".basket-wrapper");
    const miniCart = document.querySelector(".mini-cart");
    if (!wrapper || !miniCart) return;

    // Hovering basket or mini-cart → keep open
    if (wrapper.contains(e.target) || miniCart.contains(e.target)) {
        clearTimeout(miniCartTimeout);
        miniCart.style.display = "block";
        miniCart.style.opacity = "1";
        miniCart.style.visibility = "visible";
        return;
    }

    // Leaving → fade away after delay
    miniCartTimeout = setTimeout(() => {
        miniCart.style.display = "none";
        miniCart.style.opacity = "0";
        miniCart.style.visibility = "hidden";
    }, 200);
});
