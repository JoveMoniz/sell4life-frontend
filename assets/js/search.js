console.log("search.js loaded");

(async function bindSearch() {

    // Wait until BOTH input + autocomplete box exist
    while (
        !document.querySelector("#header-search-form") ||
        !document.querySelector("#header-search-input") ||
        !document.querySelector(".search-autocomplete")
    ) {
        await new Promise(r => setTimeout(r, 20));
    }

    console.log("Binding search...");

    const form = document.querySelector("#header-search-form");
    const input = document.querySelector("#header-search-input");
    const box  = document.querySelector(".search-autocomplete");

    // CLEAN display control
    function hideBox() {
        box.classList.remove("show");
    }

    function showBox() {
        box.classList.add("show");
    }

    // Load products for autocomplete
    let products = [];
    try {
        const res = await fetch("/data/products.json", { cache: "no-store" });
        products = await res.json();
    } catch (err) {
        console.error("autocomplete load failed:", err);
    }

    // AUTOCOMPLETE
    input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();

        if (!q) return hideBox();

        const matches = products
            .filter(p => p.name.toLowerCase().includes(q))
            .slice(0, 6);

        if (matches.length === 0) return hideBox();

        box.innerHTML = matches.map(m => `
            <div class="ac-item" data-name="${m.name}">
                ${m.name}
            </div>
        `).join("");

        showBox();
    });

    // CLICK → fill + submit
    document.addEventListener("click", e => {
        if (e.target.classList.contains("ac-item")) {
            input.value = e.target.dataset.name;
            form.dispatchEvent(new Event("submit"));
        } else {
            hideBox(); // Clicked outside
        }
    });

    // SEARCH SUBMIT
    form.addEventListener("submit", e => {
        e.preventDefault();

        const term = input.value.trim();
        if (!term) return;

        window.location.href = `/shop/?q=${encodeURIComponent(term)}`;
    });

    console.log("Search ready.");

    document.dispatchEvent(new Event("searchReady"));
})();
