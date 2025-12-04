console.log("search.js loaded");

(async function bindSearch() {

    // Wait for BOTH search bars to exist (desktop + mobile)
    while (
        !document.querySelector("#desktop-search-input") ||
        !document.querySelector("#mobile-search-input")
    ) {
        await new Promise(r => setTimeout(r, 20));
    }

    console.log("Binding search...");

    // Elements
    const desktop = {
        form: document.querySelector("#desktop-search-form"),
        input: document.querySelector("#desktop-search-input"),
        box: document.querySelector(".desktop-ac")
    };

    const mobile = {
        form: document.querySelector("#mobile-search-form"),
        input: document.querySelector("#mobile-search-input"),
        box: document.querySelector(".mobile-ac")
    };

    // Use same logic for both boxes
    function hide(box) { box.classList.remove("show"); }
    function show(box) { box.classList.add("show"); }

    // Load product list once
    let products = [];
    try {
        const res = await fetch("/data/products.json", { cache: "no-store" });
        products = await res.json();
    } catch (err) {
        console.error("autocomplete load failed:", err);
    }

    // BIND SEARCH FUNCTION TO BOTH INPUTS
    function bind(input, box) {

        input.addEventListener("input", () => {
            const q = input.value.trim().toLowerCase();
            if (!q) return hide(box);

            let matches = products.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q) ||
                p.subcategory.toLowerCase().includes(q)
            ).slice(0, 8);

            if (!matches.length) return hide(box);

            box.innerHTML = matches.map(m => `
                <div class="ac-item" data-id="${m.id}">
                    <img src="/assets/images/products/${m.images[0]}" class="ac-thumb" />
                    <div class="ac-details">
                        <span class="ac-name">${m.name}</span>
                        <span class="ac-cat">${m.category} → ${m.subcategory}</span>
                    </div>
                </div>
            `).join("");

            show(box);
        });

        // Item click
        box.addEventListener("click", e => {
            const item = e.target.closest(".ac-item");
            if (!item) return;
            window.location.href = `/product/product.html?id=${item.dataset.id}`;
        });

        // Close on outside click
        document.addEventListener("click", e => {
            if (!e.target.closest(".header-search")) hide(box);
        });
    }

    // Bind both search bars
    bind(desktop.input, desktop.box);
    bind(mobile.input, mobile.box);

    // Submit → go to /shop/?q=
    desktop.form.addEventListener("submit", e => {
        e.preventDefault();
        const term = desktop.input.value.trim();
        if (term) window.location.href = `/shop/?q=${encodeURIComponent(term)}`;
    });

    mobile.form.addEventListener("submit", e => {
        e.preventDefault();
        const term = mobile.input.value.trim();
        if (term) window.location.href = `/shop/?q=${encodeURIComponent(term)}`;
    });

    console.log("Search ready.");
})();
