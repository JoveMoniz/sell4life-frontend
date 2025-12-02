// =====================================================
// 0. GLOBAL CACHE BUSTER
// Forces CSS + JS to reload fresh on every visit
// =====================================================
(function forceFreshAssets() {
    const stamp = Date.now();

    // Refresh CSS
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href').split('?')[0];
        link.setAttribute('href', href + '?v=' + stamp);
    });

    // Refresh JS loaded in <script> tags on the page
    document.querySelectorAll('script[src]').forEach(script => {
        const src = script.getAttribute('src');
        if (src.startsWith('/assets/js/')) {
            const clean = src.split('?')[0];
            script.setAttribute('src', clean + '?v=' + stamp);
        }
    });
})();


// =====================================================
// 1. LOAD DESKTOP HEADER
// =====================================================
(async function loadLayout() {

    try {
        const headerRes = await fetch("/includes/header.html", { cache: "no-store" });
        const headerHTML = await headerRes.text();
        document.body.insertAdjacentHTML("afterbegin", headerHTML);

        document.dispatchEvent(new Event("headerLoaded"));
    } catch (err) {
        console.error("Failed to load header:", err);
    }

    // =================================================
    // 1B. LOAD MOBILE HEADER
    // =================================================
    try {
        const mobRes = await fetch("/includes/header-mobile.html", { cache: "no-store" });
        const mobHTML = await mobRes.text();
        document.body.insertAdjacentHTML("afterbegin", mobHTML);
    } catch (err) {
        console.error("Failed to load mobile header:", err);
    }


    // =================================================
    // 2. LOAD FOOTER
    // =================================================
    try {
        const footerRes = await fetch("/includes/footer.html", { cache: "no-store" });
        const footerHTML = await footerRes.text();
        document.body.insertAdjacentHTML("beforeend", footerHTML);
    } catch (err) {
        console.error("Failed to load footer:", err);
    }


    // =================================================
    // 3. LOAD CART ONCE
    // =================================================
    if (!window.__cartScriptLoaded) {
        const c = document.createElement("script");
        c.src = "/assets/js/cart.js?v=" + Date.now();   // forced refresh
        document.body.appendChild(c);
        window.__cartScriptLoaded = true;
    }

})();


// =====================================================
// 4. Load SEARCH after header appears
// =====================================================
document.addEventListener("headerLoaded", () => {
    console.log("headerLoaded → injecting search.js");

    if (!window.__searchLoaded) {
        const s = document.createElement("script");
        s.src = "/assets/js/search.js?v=" + Date.now(); // forced refresh
        document.body.appendChild(s);
        window.__searchLoaded = true;
    }
});
