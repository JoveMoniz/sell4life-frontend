// =====================================================
// 0. GLOBAL CACHE-BUSTER (safe version)
// Forces CSS + inline <script src=...> to reload fresh
// =====================================================
(function forceFreshAssets() {
    const stamp = Date.now();

    // Refresh CSS
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const clean = link.href.split('?')[0];
        link.href = clean + "?v=" + stamp;
    });

    // Refresh only inline static JS (NOT injected ones)
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
        const res = await fetch("/includes/header.html", { cache: "no-store" });
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

    // CART JS (once only)
    if (!window.__cartScriptLoaded) {
        const c = document.createElement("script");
        c.src = "/assets/js/cart.js?v=" + Date.now();
        document.body.appendChild(c);
        window.__cartScriptLoaded = true;
    }

})();
    


// =====================================================
// 2. SEARCH — load only after header is injected
// =====================================================
document.addEventListener("headerLoaded", () => {
    if (window.__searchLoaded) return;

    const s = document.createElement("script");
    s.src = "/assets/js/search.js?v=" + Date.now();
    document.body.appendChild(s);

    window.__searchLoaded = true;
});
