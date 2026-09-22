// ============================================================
// QUICK-ADD POPUP — sell4life
// Opens a compact modal to pick a variant and add to cart.
// Works with shop.js and category-page.js cards.
// ============================================================
if (window.__quickAddLoaded) { /* already loaded by layout.js */ }
else {
window.__quickAddLoaded = true;
(function () {

  // ── Modal DOM — created lazily on first open() call ──────
  let modal = null;

  function ensureModal() {
    if (modal) return;
    modal = document.createElement('div');
    modal.id = 'qa-modal';
    modal.className = 'qa-modal';
    modal.innerHTML = `
      <div class="qa-backdrop"></div>
      <div class="qa-box">
        <button class="qa-close" aria-label="Close">&times;</button>
        <div class="qa-price" style="display:none"></div>
        <div class="qa-variants"></div>
        <button class="qa-confirm" disabled>Select an option</button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('qa-backdrop') ||
          e.target.classList.contains('qa-close')) {
        close(); return;
      }
      const vBtn = e.target.closest('.qa-v');
      if (vBtn && !vBtn.disabled) {
        const attr = vBtn.dataset.attr;
        const val  = vBtn.dataset.val;
        if (attr && val !== undefined) {
          modal.querySelectorAll(`.qa-v[data-attr="${attr}"]`).forEach(b => b.classList.remove('qa-v-sel'));
          vBtn.classList.add('qa-v-sel');
          _selectedAttrs[attr] = val;
          tryResolveVariant();
        }
        return;
      }
      if (e.target.classList.contains('qa-confirm') && !e.target.disabled) {
        addToCart(); return;
      }
    });
  }

  let _product       = null;
  let _variant       = null;
  let _selectedAttrs = {};
  let _attrNames     = [];
  let _sourceBtn     = null;

  // A product-level "out of stock" is always authoritative and is never
  // overridden by a variant's own (possibly stale/inconsistent) number —
  // otherwise a broken/duplicate listing can show contradictory stock
  // status on different pages (mirrors product.js's applyVariant()).
  function isVariantOos(v, product) {
    const variantStock = v && v.stock !== undefined && v.stock !== null ? Number(v.stock) : null;
    const productStock = product && product.stock !== undefined && product.stock !== null ? Number(product.stock) : null;
    return (variantStock !== null && variantStock <= 0) || (productStock !== null && productStock <= 0);
  }

  // ── Try to find a matching variant from current selections ─
  function tryResolveVariant() {
    const confirm = modal.querySelector('.qa-confirm');
    if (!_attrNames.length) return;

    const missing = _attrNames.filter(n => _selectedAttrs[n] === undefined);
    if (missing.length) {
      _variant = null;
      confirm.disabled    = true;
      confirm.textContent = (_attrNames[0] === '_variant') ? 'Select an option' : `Select a ${missing[0]}`;
      return;
    }

    const match = (_product.variants || []).find(v =>
      _attrNames.every(n => (v.attributes?.[n] || '') === _selectedAttrs[n])
    );

    if (match) {
      _variant = match;
      const price = Number(match.price || _product.price || 0);
      setPrice(price);
      const soldOut = isVariantOos(match, _product);
      confirm.disabled    = soldOut;
      confirm.textContent = soldOut ? 'Out of stock' : 'Add to Basket';
    } else {
      _variant = null;
      confirm.disabled    = true;
      confirm.textContent = 'Select an option';
    }
  }

  // ── Build per-attribute selection UI ─────────────────────
  function buildVariantsUI(product) {
    const variants = product.variants || [];
    const firstWithAttrs = variants.find(v => v.attributes && typeof v.attributes === 'object');
    _attrNames = firstWithAttrs ? Object.keys(firstWithAttrs.attributes) : [];

    if (!_attrNames.length) {
      // Fallback: flat text list
      _attrNames = ['_variant'];
      return `<div class="qa-attr-group"><div class="qa-attr-btns">${
        variants.map((v, i) => {
          const label = Object.values(v.attributes || {}).join(' / ') || v.color || `Option ${i + 1}`;
          const soldOut = isVariantOos(v, product);
          return `<button class="qa-v${soldOut ? ' qa-v-out' : ''}" data-attr="_variant" data-val="${i}" ${soldOut ? 'disabled' : ''}>${label}</button>`;
        }).join('')
      }</div></div>`;
    }

    return _attrNames.map((attrName, attrIdx) => {
      const isFirst = attrIdx === 0;
      const seen = new Set();
      const uniqueVals = [];
      variants.forEach(v => {
        const val = v.attributes?.[attrName];
        if (val && !seen.has(val)) { seen.add(val); uniqueVals.push({ val, v }); }
      });

      // An attribute with only one real value isn't a choice — pre-select it
      // silently instead of showing a picker with a single, pointless
      // option (which also silently blocked matching for any OTHER, real
      // choice on the same product, since this one was never picked).
      if (uniqueVals.length <= 1) {
        if (uniqueVals[0]) _selectedAttrs[attrName] = uniqueVals[0].val;
        return '';
      }

      const btns = uniqueVals.map(({ val, v }) => {
        // A colour is sold out only if ALL model variants for it are sold out
        const soldOut = isFirst
          ? variants.filter(x => x.attributes?.[attrName] === val).every(x => isVariantOos(x, product))
          : false;
        const dis = soldOut ? ' disabled' : '';
        const cls = `qa-v${soldOut ? ' qa-v-out' : ''}`;

        if (isFirst) {
          // First attribute: swatch buttons (colour dot / image thumbnail),
          // but still labelled above like every other attribute — a plain
          // dot with no text isn't self-explanatory on its own.
          if (v.displayMode === 'image' && v.image) {
            return `<button class="${cls} qa-v-img" data-attr="${attrName}" data-val="${val}" title="${val}"${dis}><img src="${v.image}" alt="${val}" /></button>`;
          }
          const hex = v.color && v.color.trim() && v.color !== '#ffffff' && v.color !== '#fff' ? v.color : '#e5e7eb';
          return `<button class="${cls} qa-v-dot" data-attr="${attrName}" data-val="${val}" title="${val}"${dis}><span class="qa-dot" style="background:${hex}"></span></button>`;
        }
        // Second+ attribute: text pill
        return `<button class="${cls}" data-attr="${attrName}" data-val="${val}"${dis}>${val}</button>`;
      }).join('');

      return `<div class="qa-attr-group">
        <div class="qa-attr-label">${attrName}</div>
        <div class="qa-attr-btns">${btns}</div>
      </div>`;
    }).join('');
  }

  // ── Open ──────────────────────────────────────────────────
  function open(product) {
    ensureModal();
    _product = product;
    _variant = null;
    _selectedAttrs = {};
    _attrNames = [];

    const realVariants = (product.variants || []).filter(v =>
      (v.attributes && Object.values(v.attributes).some(Boolean)) || v.image || v.color
    );

    if (!realVariants.length) {
      directAddToCart(product);
      return;
    }

    // No real choice to make (e.g. a single "Colour: Default" placeholder
    // variant, or every attribute has only one possible value) — add it
    // straight away instead of popping up a picker with nothing to pick.
    const attrNamesUnion = [...new Set(realVariants.flatMap(v => Object.keys(v.attributes || {})))];
    const hasRealChoice = attrNamesUnion.some((n) => {
      const vals = new Set(realVariants.map((v) => v.attributes?.[n]).filter(Boolean));
      return vals.size > 1;
    });
    if (!hasRealChoice) {
      _product = { ...product, variants: realVariants };
      _variant = realVariants[0];
      addToCart();
      return;
    }

    _product = { ...product, variants: realVariants };

    const variantsEl = modal.querySelector('.qa-variants');
    const confirmBtn = modal.querySelector('.qa-confirm');
    const priceEl    = modal.querySelector('.qa-price');

    variantsEl.innerHTML = buildVariantsUI(_product);

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Select an option';
    // buildVariantsUI() may have just pre-filled one or more singleton
    // attributes into _selectedAttrs above — reflect that immediately
    // (correct prompt text, and the confirm button enables outright if
    // that was the only attribute) instead of showing a stale default.
    tryResolveVariant();

    const prices = realVariants.map(v => Number(v.price || product.price || 0));
    const hasDiffPrices = prices.some(p => p !== prices[0]);
    if (priceEl) {
      if (hasDiffPrices) {
        priceEl.style.display = '';
        setPrice(Number(product.price || 0));
      } else {
        priceEl.style.display = 'none';
      }
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function setPrice(n) {
    const el = modal?.querySelector('.qa-price');
    const fmtPrice = window.s4lFormatPrice || ((v) => `£${Number(v || 0).toFixed(2)}`);
    if (el && el.style.display !== 'none') el.textContent = fmtPrice(n);
  }

  function close() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Add to localStorage cart ──────────────────────────────
  function addToCart() {
    // Defense in depth: don't rely solely on the confirm button already
    // being disabled — re-check the same either-signal-wins stock rule
    // directly before actually writing to the basket.
    if (isVariantOos(_variant, _product)) {
      window.showToast?.('Out of stock');
      return;
    }

    let cart = [];
    try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch {}

    const pid   = _product._id || _product.id;
    const v     = _variant;
    const price = Number(v ? (v.price || _product.price) : _product.price || 0);
    const stock = v ? v.stock : _product.stock;
    const img   = (v?.image) || (Array.isArray(_product.images) && _product.images[0]
      ? (_product.images[0].startsWith('http') ? _product.images[0] : `/assets/images/products/${_product.images[0]}`)
      : _product.image || '/assets/images/products/sell4life-placeholder.png');

    const variantKey = v ? JSON.stringify(v.attributes) : null;

    const existing = cart.find(item =>
      item.productId === pid &&
      JSON.stringify(item.variant?.attributes ?? null) === variantKey
    );

    if (existing) {
      const max = Number(stock ?? 999);
      if (existing.quantity >= max) { return; }
      existing.quantity++;
    } else {
      cart.push({
        productId: pid,
        id: pid,
        name: _product.name,
        price,
        image: img,
        category: _product.category,
        subcategory: _product.subcategory,
        quantity: 1,
        stock: stock !== undefined && stock !== null ? Number(stock) : 999,
        ...(v ? { variant: { attributes: v.attributes, sku: v.sku || '' } } : {}),
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    document.dispatchEvent(new Event('cartUpdated'));
    if (window.s4lTrack) window.s4lTrack('add_to_cart', { productId: pid, name: _product.name, price });

    if (_sourceBtn) {
      const total = cart.reduce((s, i) =>
        (i.productId || i.id) === pid ? s + (i.quantity || 1) : s, 0);
      applyBtnState(_sourceBtn, total);
      _sourceBtn.classList.add('just-added');
      _sourceBtn.addEventListener('mouseleave', () => _sourceBtn.classList.remove('just-added'), { once: true });
    }

    refreshBasketBtns();
    close();
  }

  // ── Apply/remove filled state on ONE button ───────────────
  function applyBtnState(btn, qty) {
    const body   = btn.querySelector('svg path:last-child');
    const handle = btn.querySelector('svg path:first-child');

    if (qty > 0) {
      btn.classList.add('has-qty');
      if (body)   { body.style.fill = '#0b6b6a'; body.style.stroke = '#0b6b6a'; }
      if (handle) { handle.style.stroke = '#0b6b6a'; handle.style.fill = 'none'; }
    } else {
      btn.classList.remove('has-qty');
      if (body)   { body.style.fill = ''; body.style.stroke = ''; }
      if (handle) { handle.style.stroke = ''; handle.style.fill = ''; }
    }
  }

  // ── Direct add (no variants) ──────────────────────────────
  function directAddToCart(product) {
    if (isVariantOos(null, product)) {
      window.showToast?.('Out of stock');
      return;
    }

    let cart = [];
    try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch {}

    const pid   = product._id || product.id;
    const price = Number(product.price || 0);
    const stock = product.stock;
    const img   = (Array.isArray(product.images) && product.images[0])
      ? (product.images[0].startsWith('http') ? product.images[0] : `/assets/images/products/${product.images[0]}`)
      : product.image || '/assets/images/products/sell4life-placeholder.png';

    const existing = cart.find(item =>
      (item.productId || item.id) === pid && !item.variant
    );

    if (existing) {
      const max = Number(stock ?? 999);
      if (existing.quantity >= max) { return; }
      existing.quantity++;
    } else {
      cart.push({
        productId: pid, id: pid, name: product.name, price, image: img,
        category: product.category, subcategory: product.subcategory,
        quantity: 1, stock: stock != null ? Number(stock) : 999,
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    document.dispatchEvent(new Event('cartUpdated'));
    if (window.s4lTrack) window.s4lTrack('add_to_cart', { productId: pid, name: product.name, price });
    if (_sourceBtn) {
      const total = cart.reduce((s, i) =>
        (i.productId || i.id) === pid ? s + (i.quantity || 1) : s, 0);
      applyBtnState(_sourceBtn, total);
      _sourceBtn.classList.add('just-added');
      _sourceBtn.addEventListener('mouseleave', () => _sourceBtn.classList.remove('just-added'), { once: true });
    }
    refreshBasketBtns();
  }

  // ── Refresh ALL basket buttons ────────────────────────────
  function refreshBasketBtns() {
    let cart = [];
    try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch {}

    const qtyMap = {};
    cart.forEach(item => {
      const id = item.productId || item.id;
      if (id) qtyMap[id] = (qtyMap[id] || 0) + (item.quantity || item.qty || 1);
    });

    document.querySelectorAll('.sp-quick-add-btn[data-id]')
      .forEach(btn => applyBtnState(btn, qtyMap[btn.dataset.id] || 0));
  }

  // ── Global open hook ─────────────────────────────────────
  window.openQuickAdd = open;

  // ── Disable basket buttons for own products + out-of-stock ─
  window.s4l_markOwnListings = function () {
    const myVid = localStorage.getItem('s4l_vendorId');
    if (!window._qaProducts) return;

    document.querySelectorAll(
      '.sp-quick-add-btn[data-id]'
    ).forEach((btn) => {
      if (btn.dataset.oos) return;

      const p = window._qaProducts[btn.dataset.id];
      if (!p) return;

      if (myVid) {
        const pvid = typeof p.vendor === 'object'
          ? (p.vendor?._id || p.vendor?.id)
          : p.vendor;
        if (pvid && String(pvid) === myVid) {
          btn.disabled = true;
          btn.style.opacity = '0.35';
          btn.style.cursor  = 'not-allowed';
          btn.title = 'Your listing';
          return;
        }
      }

      const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
      const stockNum    = p.stock !== undefined && p.stock !== null ? Number(p.stock) : null;
      if (!hasVariants && stockNum !== null && stockNum <= 0) {
        btn.disabled = true;
        btn.style.opacity = '0.35';
        btn.style.cursor  = 'not-allowed';
        btn.title = 'Out of stock';
        btn.dataset.oos = '1';
      }
    });
  };

  // ── Lazy-fetch vendorId ───────────────────────────────────
  (async function ensureVendorId() {
    const token    = localStorage.getItem('s4l_token');
    const isVendor = localStorage.getItem('s4l_isVendor') === 'true';
    const hasId    = localStorage.getItem('s4l_vendorId');
    if (!token || !isVendor || hasId) return;
    try {
      const r = await fetch(`${window.API_BASE}/vendor/me`,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const d   = await r.json();
      const vid = d.vendor?._id || d.vendor?.id;
      if (vid) {
        localStorage.setItem('s4l_vendorId', String(vid));
        window.s4l_markOwnListings();
      }
    } catch {}
  })();

  // ── Delegate clicks from card buttons ────────────────────
  document.addEventListener('click', (e) => {

    const clrEl = e.target.closest('.sp-qa-clr');
    if (clrEl) {
      e.preventDefault();
      e.stopPropagation();
      const btn = clrEl.closest('[data-id]');
      if (!btn) return;
      let cart = [];
      try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch {}
      cart = cart.filter(i => (i.productId || i.id) !== btn.dataset.id);
      localStorage.setItem('cart', JSON.stringify(cart));
      document.dispatchEvent(new Event('cartUpdated'));
      applyBtnState(btn, 0);
      return;
    }

    const btn = e.target.closest('.sp-quick-add-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    if (btn.classList.contains('has-qty')) {
      let cart = [];
      try { cart = JSON.parse(localStorage.getItem('cart') || '[]'); } catch {}
      cart = cart.filter(i => (i.productId || i.id) !== btn.dataset.id);
      localStorage.setItem('cart', JSON.stringify(cart));
      applyBtnState(btn, 0);
      document.dispatchEvent(new Event('cartUpdated'));
      return;
    }

    _sourceBtn = btn;
    const product = (window._qaProducts || {})[btn.dataset.id];
    if (!product) return;

    // Unlike own-listing/out-of-stock (which disable the button so a click
    // never reaches here at all), this one is a real button on purpose —
    // show why instead of silently doing nothing, same message the
    // single-product page gives for the same field.
    if (product.shippableToBuyer === false) {
      window.showToast?.('This item is not shipped to your location', 'error');
      return;
    }

    const _myVid = localStorage.getItem('s4l_vendorId');
    const _pvid  = typeof product.vendor === 'object'
      ? (product.vendor?._id || product.vendor?.id)
      : product.vendor;
    if (_myVid && _pvid && _myVid === String(_pvid)) return;

    const _hasVar = Array.isArray(product.variants) && product.variants.length > 0;
    const _stock  = product.stock !== undefined && product.stock !== null ? Number(product.stock) : null;
    if (!_hasVar && _stock !== null && _stock <= 0) return;

    if (product.variants && product.variants.length > 0) {
      open(product);
    } else {
      directAddToCart(product);
    }
  });

  // ── Keyboard close ────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal) close();
  });

  // ── Sync on cart changes ──────────────────────────────────
  document.addEventListener('cartUpdated', refreshBasketBtns);

  document.addEventListener('DOMContentLoaded', refreshBasketBtns);
  if (document.readyState !== 'loading') refreshBasketBtns();

})();
} // end __quickAddLoaded guard
