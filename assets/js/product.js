console.log('product.js loaded');

(async function () {
  const $ = (sel) => document.querySelector(sel);

  const API = window.API_BASE;
  const IMAGE_BASE = '/assets/images/products/';

  // ── Get product ID / slug ──────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('id');
  const productSlug = params.get('slug');
  if (!productId && !productSlug) { console.warn('No ?id=... or ?slug=... in URL'); return; }

  // ── Load product ───────────────────────────────────────────
  let product = null;

  try {
    const res = await fetch(
      productSlug ? `${API}/products/slug/${encodeURIComponent(productSlug)}` : `${API}/products/${productId}`
    );
    if (res.ok) product = await res.json();
  } catch (e) {}

  if (!product && productId) {
    try {
      const res = await fetch('/data/products.json', { cache: 'no-store' });
      const all = await res.json();
      product = all.find((p) => p.id === productId);
    } catch (e) {}
  }

  if (!product) { console.error('Product not found:', productId || productSlug); return; }

  // Currency detection runs in parallel with the product fetch above (both
  // kick off as soon as their scripts load) — this just waits for whichever
  // one hasn't resolved yet, so every price render below already knows the
  // right currency/rate instead of flashing £ first.
  if (window.S4L_CURRENCY_READY) await window.S4L_CURRENCY_READY;
  const fmtPrice = window.s4lFormatPrice || ((n) => `£${Number(n || 0).toFixed(2)}`);

  const pid = product._id || product.id;

  // Track recently viewed (for shop browse rows)
  try {
    const key     = 's4l_recently_viewed';
    const stored  = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = [pid, ...stored.filter(id => id !== pid)].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch { /* storage unavailable */ }

  if (window.s4lTrack) {
    window.s4lTrack('product_view', { productId: pid, name: product.name, price: Number(product.price || 0) });
  }
  const firstImage = product.images?.[0] || '';
  const productImage = firstImage.startsWith('http') ? firstImage : IMAGE_BASE + firstImage;

  // ── Title / page title ─────────────────────────────────────
  if ($('.product-title')) $('.product-title').textContent = product.name;
  document.title = `${product.name} | Sell4Life`;

  const _desc = (product.description || product.name).replace(/<[^>]+>/g, '').slice(0, 155);
  const _setMeta = (sel, val) => { const el = document.querySelector(sel); if (el) el.setAttribute('content', val); };
  _setMeta('meta[name="description"]', _desc);
  _setMeta('meta[property="og:title"]', `${product.name} | Sell4Life`);
  _setMeta('meta[property="og:description"]', _desc);

  // ── JSON-LD structured data (SEO) ──────────────────────────
  try {
    const ldImages = (product.images || []).map(img => img.startsWith('http') ? img : IMAGE_BASE + img);
    const availability = (product.stock === undefined || product.stock > 0)
      ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: _desc,
      sku: pid,
      offers: {
        '@type': 'Offer',
        url: window.location.href,
        priceCurrency: 'GBP',
        price: Number(product.price || 0).toFixed(2),
        availability,
      },
    };
    if (ldImages.length) ld.image = ldImages;
    if (product.condition) {
      ld.itemCondition = product.condition === 'New'
        ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition';
    }
    const ldScript = document.createElement('script');
    ldScript.type = 'application/ld+json';
    ldScript.textContent = JSON.stringify(ld);
    document.head.appendChild(ldScript);
  } catch { /* non-critical */ }

  // ── Category breadcrumb ────────────────────────────────────
  if ($('.product-category')) {
    const cat = product.category || '';
    const sub = product.subcategory || '';
    $('.product-category').textContent = sub ? `${cat} › ${sub}` : cat;
  }

  // ── Condition badge (casual listings) ──────────────────────
  const conditionEl = document.getElementById('pd-condition-badge');
  if (conditionEl) {
    if (product.condition) {
      conditionEl.textContent = product.condition;
      conditionEl.style.display = '';
    } else {
      conditionEl.style.display = 'none';
    }
  }

  // Casual vendors sell single items → use "Sold" instead of "Out of stock"
  const _vendorType = (product.vendor && typeof product.vendor === 'object' && product.vendor !== null)
    ? (product.vendor.type || null)
    : null;
  const _oosLabel = _vendorType === 'casual' ? 'Sold' : 'Out of stock';

  // ── Price ──────────────────────────────────────────────────
  if ($('.product-price')) {
    $('.product-price').textContent = fmtPrice(product.price);
  }

  // ── Shipping note ─────────────────────────────────────────
  const shippingNote = document.getElementById('pd-shipping-note');
  if (shippingNote) {
    const effectiveShip = product.shipIncluded ? 0 : product.shippingCost;
    shippingNote.textContent = window.s4lShippingText(effectiveShip, product.collectionOnly);
    shippingNote.style.display = 'block';
  }
  const collectionNote = document.getElementById('pd-collection-note');
  if (collectionNote) {
    collectionNote.style.display = product.collectionOnly ? 'block' : 'none';
  }
  // Show "Free delivery included" when shipping is baked into price or genuinely
  // free — never for collection-only (there's no delivery at all to be "free")
  const freeDeliveryEl = document.getElementById('pd-free-delivery');
  if (freeDeliveryEl) {
    freeDeliveryEl.style.display = (!product.collectionOnly && (product.shipIncluded || Number(product.shippingCost) === 0)) ? '' : 'none';
  }

  // ── Estimated delivery ──────────────────────────────────────
  const deliveryEl = document.getElementById('pd-delivery-estimate');
  if (deliveryEl) {
    const minDays = Number(product.estDeliveryMinDays);
    const maxDays = Number(product.estDeliveryMaxDays);
    if (Number.isFinite(minDays) && Number.isFinite(maxDays) && minDays >= 0 && maxDays >= minDays) {
      const fmt = (days) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      };
      deliveryEl.textContent = `Delivery by ${fmt(maxDays)}`;
      deliveryEl.style.display = 'block';
    } else {
      deliveryEl.style.display = 'none';
    }
  }

  // ── Returns postage note ───────────────────────────────────
  // Product-level freeReturns wins if explicitly set; otherwise inherit
  // the vendor's store-wide default.
  const postageNoteEl = document.getElementById('pd-returns-postage-note');
  if (postageNoteEl) {
    const vendorFreeReturns = typeof product.vendor === 'object' && product.vendor !== null
      ? !!product.vendor.freeReturns
      : false;
    const freeReturns = typeof product.freeReturns === 'boolean' ? product.freeReturns : vendorFreeReturns;
    const returnCost = product.shipIncluded ? 0 : Number(product.shippingCost || 0);
    if (freeReturns) {
      postageNoteEl.innerHTML = '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg> Free returns — this seller covers return postage for change-of-mind returns.';
    } else if (returnCost > 0) {
      postageNoteEl.textContent = `For change-of-mind returns, return postage (approx. ${fmtPrice(returnCost)}) may be paid by the buyer.`;
    } else {
      postageNoteEl.textContent = 'For change-of-mind returns, return postage may be paid by the buyer.';
    }
    postageNoteEl.classList.toggle('pd-returns-good', freeReturns);
  }

  // ── Compare / RRP price ────────────────────────────────────
  const compareRaw = product.comparePrice ?? product.compare_price ?? null;
  const compareEl = document.getElementById('pd-compare-price');
  if (compareEl && compareRaw && Number(compareRaw) > Number(product.price)) {
    compareEl.textContent = fmtPrice(compareRaw);
  }

  // ── "Or best offer" ─────────────────────────────────────────
  const oboEl = document.getElementById('pd-obo');
  if (oboEl && product.acceptOffers) {
    oboEl.textContent = 'or best offer';
  }

  // ── Stock badge ────────────────────────────────────────────
  const stockBadge = document.getElementById('pd-stock-badge');
  if (stockBadge && product.stock !== undefined) {
    if (product.stock <= 0 && _vendorType === 'casual') {
      stockBadge.textContent = 'Sold';
      stockBadge.className = 'pd-stock-badge oos';
    } else if (product.stock <= 0) {
      stockBadge.textContent = 'Out of stock';
      stockBadge.className = 'pd-stock-badge oos';
    } else if (product.stock <= 2) {
      stockBadge.textContent = `Only ${product.stock} left!`;
      stockBadge.className = 'pd-stock-badge critical';
    } else if (product.stock <= 5) {
      stockBadge.textContent = `Only ${product.stock} left`;
      stockBadge.className = 'pd-stock-badge low';
    }
  }

  // ── Short description (tagline) ────────────────────────────
  const shortDescEl = document.getElementById('pd-short-desc');
  const shortDesc = product.shortDescription || product.short_description || '';

  if (shortDescEl) {
    if (shortDesc) {
      shortDescEl.textContent = shortDesc;
    } else {
      shortDescEl.style.display = 'none';
    }
  }

  // ── Bullet points: gallery info (desktop) + product info ───
  const bulletPoints = product.bulletPoints || '';

  function renderBullets(text) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      return '<ul class="pd-bullets">' +
        lines.map(l => `<li>${l.replace(/^[•\-\*✓]\s*/, '')}</li>`).join('') +
        '</ul>';
    }
    return `<p class="pd-gallery-short">${text}</p>`;
  }

  // ── Gallery info: bullets under slider (desktop) ──────────
  const galleryInfoEl = document.getElementById('pd-gallery-info');
  if (galleryInfoEl && bulletPoints) {
    galleryInfoEl.innerHTML = renderBullets(bulletPoints);
  }

  // ── Bullet points in right column (all screen sizes) ────────
  const bulletsEl = document.getElementById('pd-bullets');
  if (bulletsEl && bulletPoints) {
    const lines = bulletPoints.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length) {
      bulletsEl.innerHTML = '<ul class="pd-bullets">' +
        lines.map(l => `<li>${l.replace(/^[•\-\*✓]\s*/, '')}</li>`).join('') +
        '</ul>';
    }
  }

  // ── Full description + read more ───────────────────────────
  const descEl = $('.product-desc');
  const descWrap = document.getElementById('pd-desc-wrap');
  const readMoreBtn = document.getElementById('pd-read-more');

  if (descEl) descEl.textContent = product.description || '';

  if (descEl && readMoreBtn) {
    requestAnimationFrame(() => {
      if (descEl.scrollHeight > descEl.clientHeight + 4) {
        readMoreBtn.style.display = 'inline-block';
      }
    });
    readMoreBtn.addEventListener('click', () => {
      const expanded = descWrap.classList.toggle('expanded');
      readMoreBtn.textContent = expanded ? 'Show less ▴' : 'Read more ▾';
    });
  }

  // ── Is this the vendor's own listing? (needed by Ask Seller, Make an
  //    Offer, and the Buy/Edit button below — computed once here) ──────
  const _myVendorId = localStorage.getItem('s4l_vendorId');
  const _productVendorId = typeof product.vendor === 'object'
    ? (product.vendor?._id || product.vendor?.id)
    : product.vendor;
  const _loggedIn = !!localStorage.getItem('s4l_token');
  const _isOwnListing = !!(_loggedIn && _myVendorId && _productVendorId && _myVendorId === String(_productVendorId));

  // ── Seller strip ───────────────────────────────────────────
  const sellerStrip = document.getElementById('pd-seller-strip');
  const sellerAvatarEl = document.getElementById('pd-seller-avatar');
  const sellerNameEl = document.getElementById('pd-seller-name');
  const sellerLinkEl = document.getElementById('pd-seller-link');
  const dividerBeforeSeller = document.getElementById('pd-divider-before-seller');
  const dividerAfterSeller = document.getElementById('pd-divider-after-seller');

  const vendorObj = product.vendor;
  if (vendorObj) {
    const vendorId = typeof vendorObj === 'object'
      ? (vendorObj._id || vendorObj.id)
      : vendorObj;
    let displayName = typeof vendorObj === 'object'
      ? (vendorObj.storeName || vendorObj.businessName || vendorObj.name || null)
      : null;

    if (!displayName && vendorId) {
      try {
        const vRes = await fetch(`${API}/vendors/${vendorId}`);
        if (vRes.ok) {
          const v = await vRes.json();
          displayName = v.storeName || v.businessName || v.name || null;
        }
      } catch (e) {}
    }

    displayName = displayName || 'Seller';
    if (sellerNameEl) sellerNameEl.textContent = displayName;
    if (sellerAvatarEl) sellerAvatarEl.textContent = displayName.charAt(0).toUpperCase();
    if (sellerLinkEl && vendorId) sellerLinkEl.href = `/stores/?id=${vendorId}`;

    // Show verified badge when we have a real store name (all active stores are approved)
    const verifiedBadge = document.getElementById('pd-verified-badge');
    if (verifiedBadge && displayName !== 'Seller') {
      verifiedBadge.classList.add('show');
    }

    // Verified Refurbisher Badge — only for refurbished vendors with badge enabled
    const vObj = typeof vendorObj === 'object' ? vendorObj : null;
    if (vObj?.refurbishedBadge && vObj?.type === 'refurbished') {
      const refurbBadge = document.createElement('span');
      refurbBadge.className = 'pd-refurb-badge';
      refurbBadge.innerHTML = '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.3 2.3-2-2 2.3-2.3z"/></svg> Verified Refurbisher';
      const sellerInfo = document.querySelector('.pd-seller-info');
      if (sellerInfo) sellerInfo.appendChild(refurbBadge);
    }

    // ── Ask Seller button ──────────────────────────────────────
    const askBtn      = document.getElementById('pd-ask-seller');
    const askBackdrop = document.getElementById('ask-modal-backdrop');
    const askCancel   = document.getElementById('ask-modal-cancel');
    const askSubmit   = document.getElementById('ask-modal-submit');
    const askBody     = document.getElementById('ask-modal-body');
    const askMsg      = document.getElementById('ask-modal-msg');
    const askTitle    = document.getElementById('ask-modal-product-name');

    if (askBtn && pid && !_isOwnListing) {
      askBtn.style.display = 'inline-flex';
      if (askTitle) askTitle.textContent = product.name;

      askBtn.addEventListener('click', () => {
        if (!localStorage.getItem('s4l_token')) {
          localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
        window.location.href = '/account/signin.html';
          return;
        }
        askBackdrop?.classList.add('open');
        askBody?.focus();
      });

      askCancel?.addEventListener('click', () => {
        askBackdrop?.classList.remove('open');
        if (askMsg) { askMsg.textContent = ''; askMsg.className = 'ask-modal-msg'; }
        if (askBody) askBody.value = '';
      });

      askBackdrop?.addEventListener('click', (e) => {
        if (e.target === askBackdrop) askCancel?.click();
      });

      askSubmit?.addEventListener('click', async () => {
        const text = askBody?.value.trim();
        if (!text) { if (askMsg) { askMsg.textContent = 'Please write a message.'; askMsg.className = 'ask-modal-msg err'; } return; }
        window.setButtonLoading?.(askSubmit, true, 'Sending…');
        if (askMsg) { askMsg.textContent = ''; askMsg.className = 'ask-modal-msg'; }
        try {
          const res = await fetch(`${API}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('s4l_token')}` },
            body: JSON.stringify({ productId: pid, body: text }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to send.');
          if (askMsg) { askMsg.textContent = 'Message sent!'; askMsg.className = 'ask-modal-msg ok'; }
          if (askBody) askBody.value = '';
          setTimeout(() => askCancel?.click(), 1500);
        } catch (err) {
          if (askMsg) { askMsg.textContent = err.message; askMsg.className = 'ask-modal-msg err'; }
        } finally {
          window.setButtonLoading?.(askSubmit, false);
        }
      });
    } else if (askBtn && _isOwnListing) {
      askBtn.style.display = 'none'; // can't ask yourself a question
    }
  } else {
    if (sellerStrip) sellerStrip.style.display = 'none';
    if (dividerBeforeSeller) dividerBeforeSeller.style.display = 'none';
    if (dividerAfterSeller) dividerAfterSeller.style.display = 'none';
  }

  // ── Render images ──────────────────────────────────────────
  const hiddenGallery = document.getElementById('hidden-gallery');
  const variantImageMap = {}; // variantIndex → 1-based gallery slide index
  const toSrc = (s) => (s && s.startsWith('http')) ? s : IMAGE_BASE + s;

  if (hiddenGallery && Array.isArray(product.images)) {
    hiddenGallery.innerHTML = '';
    const addedSrcs = new Set();
    product.images.forEach((imgFile) => {
      const src = toSrc(imgFile);
      const img = document.createElement('img');
      img.setAttribute('src', src);
      img.alt = product.name;
      hiddenGallery.appendChild(img);
      addedSrcs.add(src);
    });
    if (Array.isArray(product.variants)) {
      product.variants.forEach((v, i) => {
        if (!v.image) return;
        const src = toSrc(v.image);
        const children = Array.from(hiddenGallery.children);
        let found = children.findIndex((el) => el.getAttribute('src') === src);
        if (found === -1 && !addedSrcs.has(src)) {
          // Variant image not in main gallery — add it as a new slide
          const img = document.createElement('img');
          img.setAttribute('src', src);
          img.alt = product.name;
          hiddenGallery.appendChild(img);
          addedSrcs.add(src);
          found = hiddenGallery.children.length - 1;
        }
        if (found !== -1) variantImageMap[i] = found + 1;
      });
    }
    [product.videoUrl, product.videoUrl2, product.videoUrl3, product.videoUrl4, product.videoUrl5].forEach((url) => {
      if (!url) return;
      const vDiv = document.createElement('div');
      vDiv.className = 'video-slide-src';
      vDiv.dataset.url = url;
      hiddenGallery.appendChild(vDiv);
    });
    document.dispatchEvent(new Event('productImagesLoaded'));
  }

  // ── Variant selectors ─────────────────────────────────────
  let currentVariant = null;
  const variantsEl = document.getElementById('pd-variants');
  const variantDivider = document.getElementById('pd-divider-variants');
  const priceEl = $('.product-price');

  // Reassigned below once attrNames/selections exist — lets addToCart/Buy Now
  // (defined much further down) name exactly which attribute is still unpicked.
  let getMissingVariantAttrs = () => [];

  // Toast naming the specific missing attribute(s) + a brief red shake/outline
  // on that pill row, instead of a generic "select a variant" message that
  // leaves the buyer hunting for which one still needs picking.
  function promptSelectVariant() {
    const missing = getMissingVariantAttrs();
    if (!missing.length) { window.showToast?.('Please select an option'); return; }
    window.showToast?.(`Please select a ${missing.join(' and ')}`);
    if (!variantsEl) return;
    variantsEl.querySelectorAll('.pd-variant-group.pd-variant-missing').forEach((g) => g.classList.remove('pd-variant-missing'));
    variantsEl.querySelectorAll('.pd-variant-label').forEach((label) => {
      const attrName = label.textContent.replace(/^Choose\s+/, '');
      if (!missing.includes(attrName)) return;
      const group = label.closest('.pd-variant-group');
      if (!group) return;
      group.classList.add('pd-variant-missing');
      group.addEventListener('animationend', () => group.classList.remove('pd-variant-missing'), { once: true });
    });
    variantsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (product.variants && product.variants.length > 0 && variantsEl) {
    const sampleAttrs = product.variants[0].attributes || {};
    const attrNames = Object.keys(sampleAttrs);

    if (attrNames.length > 0) {
      // Build colorMap: { attrName: { attrValue: hexColor } }
      const colorMap = {};
      product.variants.forEach((v) => {
        if (!v.color) return;
        attrNames.forEach((name) => {
          const val = v.attributes[name];
          if (!val) return;
          if (!colorMap[name]) colorMap[name] = {};
          if (!colorMap[name][val]) colorMap[name][val] = v.color;
        });
      });

      const html = attrNames.map((attrName, attrIdx) => {
        const values = [...new Set(product.variants.map((v) => v.attributes[attrName]).filter(Boolean))];
        let hasSwatch = false;
        const buttons = values.map((val) => {
          const v = product.variants.find(v2 => v2.attributes[attrName] === val);
          // Only the first attribute (colour) uses swatch/image mode.
          // All other attributes (Model, Size, etc.) always render as text pills.
          if (attrIdx > 0) {
            return `<button type="button" class="pd-variant-pill" data-attr="${attrName}" data-val="${val}">${val}</button>`;
          }
          const useImg = v?.displayMode === 'image' || (!v?.displayMode && product.variantDisplay === 'image');
          if (useImg) {
            hasSwatch = true;
            const imgSrc = v?.image ? toSrc(v.image) : '';
            return `<button type="button" class="pd-img-swatch" data-attr="${attrName}" data-val="${val}" title="${val}">${
              imgSrc ? `<img src="${imgSrc}" alt="${val}" loading="lazy" />` : `<span>${val}</span>`
            }</button>`;
          }
          const hex = v?.color || colorMap[attrName]?.[val];
          const attrUsesColor = !!colorMap[attrName] || /colou?r/i.test(attrName);
          if (hex || attrUsesColor) {
            hasSwatch = true;
            return `<button type="button" class="pd-color-swatch" data-attr="${attrName}" data-val="${val}" style="background:${hex || '#e5e7eb'}" title="${val}"></button>`;
          }
          return `<button type="button" class="pd-variant-pill" data-attr="${attrName}" data-val="${val}">${val}</button>`;
        }).join('');
        const selector = `<div class="pd-variant-pills">${buttons}${hasSwatch ? '<span class="pd-swatch-selected-name"></span>' : ''}</div>`;
        return `<div class="pd-variant-group"><div class="pd-variant-label">Choose ${attrName}</div>${selector}</div>`;
      }).join('');

      variantsEl.innerHTML = html;
      if (variantDivider) variantDivider.style.display = '';

      const selections = {};
      getMissingVariantAttrs = () => attrNames.filter((name) => !selections[name]);

      function findMatchingVariant() {
        return product.variants.find((v) =>
          attrNames.every((name) => (v.attributes[name] || '') === (selections[name] || ''))
        ) || null;
      }

      function switchGalleryToVariant(v) {
        if (!v) return;
        const vi = product.variants.indexOf(v);
        const slideIdx = variantImageMap[vi];
        if (slideIdx == null) return;
        const thumbs = document.querySelectorAll('.thumb-img');
        const thumb = thumbs[slideIdx - 1];
        if (thumb) thumb.click();
      }

      function applyVariant() {
        const v = findMatchingVariant();
        currentVariant = v;
        const price = (v && v.price != null) ? v.price : product.price;
        const stockVal = (v && v.stock != null) ? v.stock : product.stock;
        if (priceEl) priceEl.textContent = fmtPrice(price);
        // Don't change buttons if product is Coming Soon
        if (!product.comingSoon) {
          const oos = stockVal !== undefined && stockVal <= 0;
          addBtns.forEach((btn) => {
            btn.disabled = oos;
            btn.textContent = oos ? _oosLabel : 'Add to Basket';
          });
          if (buyBtn) { buyBtn.disabled = oos; buyBtn.textContent = oos ? _oosLabel : 'Buy Now'; }
        }
        switchGalleryToVariant(v);
      }

      variantsEl.addEventListener('click', (e) => {
        const pill      = e.target.closest('.pd-variant-pill');
        const swatch    = e.target.closest('.pd-color-swatch');
        const imgSwatch = e.target.closest('.pd-img-swatch');
        const target = pill || swatch || imgSwatch;
        if (!target) return;
        const attr = target.dataset.attr;
        variantsEl.querySelectorAll(
          `.pd-variant-pill[data-attr="${attr}"], .pd-color-swatch[data-attr="${attr}"], .pd-img-swatch[data-attr="${attr}"]`
        ).forEach((p) => p.classList.remove('selected'));
        target.classList.add('selected');
        if (swatch || imgSwatch) {
          const nameEl = target.closest('.pd-variant-pills')?.querySelector('.pd-swatch-selected-name');
          if (nameEl) nameEl.textContent = target.dataset.val;
          const val = target.dataset.val;
          const vi = product.variants.findIndex((v) => v.attributes[attr] === val && v.image);
          if (vi >= 0 && variantImageMap[vi] != null) {
            const thumbs = document.querySelectorAll('.thumb-img');
            const thumb = thumbs[variantImageMap[vi] - 1];
            if (thumb) thumb.click();
          }
        }
        selections[attr] = target.dataset.val;
        applyVariant();
      });
    }
  }

  // ── Add-ons ────────────────────────────────────────────────
  let selectedAddOns = [];
  const addOnsEl = document.getElementById('pd-addons');
  const addOnsDivider = document.getElementById('pd-divider-addons');

  if (product.addOns && product.addOns.length > 0 && addOnsEl) {
    const html = `
      <div class="pd-addons-label">Optional Extras</div>
      ${product.addOns.map((ao, i) => `
        <label class="pd-addon-item" data-index="${i}">
          <input type="checkbox" class="pd-addon-check" data-index="${i}" data-price="${ao.price}" />
          ${ao.image ? `<img src="${ao.image}" class="pd-addon-thumb" alt="${ao.name}" />` : ''}
          <div class="pd-addon-info">
            <div class="pd-addon-name">${ao.name}</div>
            ${ao.description ? `<div class="pd-addon-desc">${ao.description}</div>` : ''}
          </div>
          <div class="pd-addon-price">+${fmtPrice(ao.price)}</div>
        </label>
      `).join('')}
    `;
    addOnsEl.innerHTML = html;
    if (addOnsDivider) addOnsDivider.style.display = '';

    function updateAddOnsTotal() {
      selectedAddOns = [];
      addOnsEl.querySelectorAll('.pd-addon-check:checked').forEach((cb) => {
        const i = parseInt(cb.dataset.index, 10);
        selectedAddOns.push(product.addOns[i]);
      });
      const basePrice = (currentVariant && currentVariant.price != null) ? currentVariant.price : product.price;
      const addOnTotal = selectedAddOns.reduce((s, ao) => s + ao.price, 0);
      if (priceEl) priceEl.textContent = fmtPrice(basePrice + addOnTotal);
    }

    addOnsEl.addEventListener('change', (e) => {
      if (!e.target.classList.contains('pd-addon-check')) return;
      const label = e.target.closest('.pd-addon-item');
      if (label) label.classList.toggle('selected', e.target.checked);
      updateAddOnsTotal();
    });
  }

  // ── Stock / out-of-stock ───────────────────────────────────
  const addBtns = document.querySelectorAll('.btn-add');
  const buyBtn = $('.btn-buy');
  const isOos = product.stock !== undefined && product.stock <= 0 && (!product.variants || product.variants.length === 0);

  if (isOos) {
    addBtns.forEach((btn) => { btn.disabled = true; btn.textContent = _oosLabel; });
    if (buyBtn) { buyBtn.disabled = true; buyBtn.textContent = _oosLabel; }
  }

  // ── Not shippable to the buyer's (GeoIP-detected) country ──
  // Seller-set scope only, checked server-side in the product fetch — see
  // shippingScope.js. Doesn't block browsing, just purchase, and never
  // overrides isOos's own messaging if both are true.
  if (!isOos && product.shippableToBuyer === false) {
    addBtns.forEach((btn) => { btn.disabled = true; btn.textContent = 'Not available in your country'; });
    if (buyBtn) { buyBtn.disabled = true; buyBtn.textContent = 'Not available in your country'; }

    const stockBadgeEl = document.getElementById('pd-stock-badge');
    const notice = document.createElement('div');
    notice.className = 'pd-stock-badge oos';
    notice.innerHTML = '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M6.5 6.5l11 11"/></svg> This item is not shipped to your location';
    (stockBadgeEl || $('.product-title'))?.insertAdjacentElement('afterend', notice);
  }

  // ── Prevent vendor from purchasing their own product ──────────────────
  // (_isOwnListing already computed above, before the seller strip)
  if (_isOwnListing) {
    const _pid = product._id || product.id;
    addBtns.forEach((btn) => {
      btn.disabled = true;
      btn.textContent = 'Your listing';
      btn.style.cssText = 'background:#f0faf9;color:#0b6b6a;border:1.5px solid rgba(11,107,106,0.3);cursor:default;opacity:0.75';
    });
    if (buyBtn) {
      buyBtn.disabled = false;
      buyBtn.innerHTML = '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z"/><path d="M13 7l3.5 3.5"/></svg> Edit product';
      buyBtn.style.cssText = 'background:#0b6b6a;color:#fff';
      buyBtn.onclick = (e) => {
        e.preventDefault();
        window.location.href = `/account/vendor/edit-product.html?id=${_pid}`;
      };
    }
  }

  // ── Make an Offer button ────────────────────────────────────
  const offerBtn      = document.getElementById('pd-make-offer');
  const offerBackdrop = document.getElementById('offer-modal-backdrop');
  const offerCancel   = document.getElementById('offer-modal-cancel');
  const offerSubmit   = document.getElementById('offer-modal-submit');
  const offerAmountEl = document.getElementById('offer-modal-amount');
  const offerMsg      = document.getElementById('offer-modal-msg');
  const offerTitle    = document.getElementById('offer-modal-product-name');
  const offerListed   = document.getElementById('offer-modal-listed-price');

  if (offerBtn && pid && product.acceptOffers && !_isOwnListing && !isOos) {
    offerBtn.style.display = 'inline-flex';
    if (offerTitle) offerTitle.textContent = product.name;
    if (offerListed) offerListed.textContent = `Listed at ${fmtPrice(product.price)}`;

    offerBtn.addEventListener('click', () => {
      if (!localStorage.getItem('s4l_token')) {
        localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
        window.location.href = '/account/signin.html';
        return;
      }
      offerBackdrop?.classList.add('open');
      offerAmountEl?.focus();
    });

    offerCancel?.addEventListener('click', () => {
      offerBackdrop?.classList.remove('open');
      if (offerMsg) { offerMsg.textContent = ''; offerMsg.className = 'ask-modal-msg'; }
      if (offerAmountEl) offerAmountEl.value = '';
    });

    offerBackdrop?.addEventListener('click', (e) => {
      if (e.target === offerBackdrop) offerCancel?.click();
    });

    offerSubmit?.addEventListener('click', async () => {
      const amount = Number(offerAmountEl?.value);
      if (!Number.isFinite(amount) || amount <= 0) {
        if (offerMsg) { offerMsg.textContent = 'Enter a valid offer amount.'; offerMsg.className = 'ask-modal-msg err'; }
        return;
      }
      window.setButtonLoading?.(offerSubmit, true, 'Sending…');
      if (offerMsg) { offerMsg.textContent = ''; offerMsg.className = 'ask-modal-msg'; }
      try {
        const res = await fetch(`${API}/messages/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('s4l_token')}` },
          body: JSON.stringify({ productId: pid, amount }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send offer.');
        if (offerMsg) {
          offerMsg.innerHTML = `Offer sent! <a href="/account/messages.html?id=${data.conversation._id}" style="color:inherit;text-decoration:underline">View in Messages →</a>`;
          offerMsg.className = 'ask-modal-msg ok';
        }
        if (offerAmountEl) offerAmountEl.value = '';
      } catch (err) {
        if (offerMsg) { offerMsg.textContent = err.message; offerMsg.className = 'ask-modal-msg err'; }
      } finally {
        window.setButtonLoading?.(offerSubmit, false);
      }
    });
  }

  // ── Coming Soon ────────────────────────────────────────────
  if (product.comingSoon) {
    // Disable all buy buttons and replace text
    addBtns.forEach((btn) => { btn.disabled = true; btn.innerHTML = '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg> Coming Soon'; btn.classList.add('btn-coming-soon'); });
    if (buyBtn) { buyBtn.disabled = true; buyBtn.innerHTML = '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg> Coming Soon'; buyBtn.classList.add('btn-coming-soon'); }
    // Disable quantity stepper
    const qMinus = document.getElementById('pd-qty-minus');
    const qPlus  = document.getElementById('pd-qty-plus');
    if (qMinus) qMinus.disabled = true;
    if (qPlus)  qPlus.disabled  = true;
    // Insert banner below the price
    const priceBlock = $('.product-price')?.closest('.pd-price-row') || $('.product-price');
    if (priceBlock) {
      const banner = document.createElement('div');
      banner.className = 'pd-coming-soon-banner';
      banner.innerHTML = '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg> <strong>Coming Soon</strong> — This product is not yet available for purchase.';
      priceBlock.insertAdjacentElement('afterend', banner);
    }
  }

  // ── Quantity stepper ───────────────────────────────────────
  let currentQty = 1;
  const maxStock = (product.trackInventory && product.stock > 0) ? product.stock : 99;
  const qtyValEl = document.getElementById('pd-qty-val');
  const qtyMinus = document.getElementById('pd-qty-minus');
  const qtyPlus = document.getElementById('pd-qty-plus');

  function setQty(n) {
    currentQty = Math.max(1, Math.min(n, maxStock));
    if (qtyValEl) qtyValEl.textContent = currentQty;
    if (qtyMinus) qtyMinus.disabled = currentQty <= 1;
    if (qtyPlus) qtyPlus.disabled = currentQty >= maxStock;
  }

  setQty(1);
  if (qtyMinus) qtyMinus.addEventListener('click', () => setQty(currentQty - 1));
  if (qtyPlus)  qtyPlus.addEventListener('click',  () => setQty(currentQty + 1));

  if (isOos) {
    if (qtyMinus) qtyMinus.disabled = true;
    if (qtyPlus)  qtyPlus.disabled  = true;
  }

  // ── Add to cart ────────────────────────────────────────────
  function addToCart() {
    const hasVariants = product.variants && product.variants.length > 0;
    if (hasVariants && !currentVariant) {
      promptSelectVariant();
      return { added: false };
    }

    let cart = JSON.parse(localStorage.getItem('cart') || '[]')
      .filter((i) => i && (i.productId || i.id));

    const addOnTotal = selectedAddOns.reduce((s, ao) => s + ao.price, 0);
    const effectivePrice = ((currentVariant && currentVariant.price != null) ? currentVariant.price : product.price) + addOnTotal;

    const existing = cart.find((i) => {
      if ((i.productId || i.id) !== pid) return false;
      if (!currentVariant && !i.variant) return true;
      if (!currentVariant || !i.variant) return false;
      return JSON.stringify(currentVariant.attributes) === JSON.stringify(i.variant.attributes);
    });

    if (existing) {
      const stockToCheck = (currentVariant && currentVariant.stock != null) ? currentVariant.stock : product.stock;
      const desired = existing.quantity + currentQty;
      if (product.trackInventory && desired > stockToCheck) {
        window.showToast?.(`Only ${stockToCheck} in stock`);
        existing.quantity = stockToCheck;
      } else {
        existing.quantity = desired;
      }
    } else {
      cart.push({
        productId: pid, _id: pid,
        name: product.name,
        price: effectivePrice,
        image: productImage,
        quantity: currentQty,
        category: product.category,
        subcategory: product.subcategory,
        vendor: product.vendor,
        variant: currentVariant
          ? { attributes: currentVariant.attributes, sku: currentVariant.sku, price: currentVariant.price }
          : undefined,
        addOns: selectedAddOns.length ? selectedAddOns.map((ao) => ({ name: ao.name, price: ao.price })) : undefined,
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    document.dispatchEvent(new Event('cartUpdated'));
    return { cart, added: true };
  }

  addBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isOos) { window.showToast?.('Out of stock'); return; }
      const result = addToCart();
      const badge = document.querySelector('.basket-qty');
      if (badge) {
        const total = result.cart.reduce((s, i) => s + (i.quantity || 0), 0);
        badge.textContent = total;
        badge.classList.remove('hide');
      }
      const label = currentQty > 1 ? `×${currentQty} added to basket` : 'Added to basket';
      window.showToast?.(label);
    });
  });

  // ── Buy Now ────────────────────────────────────────────────
  // Stored in its own key, entirely separate from the real basket (`cart`)
  // — checkout reads from here instead when buyNow is set. This means an
  // abandoned Buy Now never touches the buyer's actual basket contents,
  // unlike the old backup/restore approach which only restored the basket
  // on a *successful* purchase and silently stranded it otherwise.
  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      if (_isOwnListing) return; // button is repurposed as "Edit product" — its own onclick handles this
      const hasVariants = product.variants && product.variants.length > 0;
      if (hasVariants && !currentVariant) {
        promptSelectVariant();
        return;
      }
      const buyAddOnTotal = selectedAddOns.reduce((s, ao) => s + ao.price, 0);
      const buyPrice = ((currentVariant && currentVariant.price != null) ? currentVariant.price : product.price) + buyAddOnTotal;
      localStorage.setItem('buyNowItem', JSON.stringify({
        productId: pid, name: product.name,
        price: buyPrice, image: productImage,
        quantity: currentQty,
        variant: currentVariant ? { attributes: currentVariant.attributes, sku: currentVariant.sku, price: currentVariant.price } : undefined,
        addOns: selectedAddOns.length ? selectedAddOns.map((ao) => ({ name: ao.name, price: ao.price })) : undefined,
      }));
      localStorage.setItem('buyNow', 'true');
      // Navigation itself is the "loading" state here — this just gives
      // instant feedback and blocks a second click in the brief window
      // before the page actually unloads.
      window.setButtonLoading?.(buyBtn, true, 'Redirecting…');
      window.location.href = '/cart/checkout.html';
    });
  }

  document.dispatchEvent(new Event('productLoaded'));

  // ── Related products ───────────────────────────────────────
  loadRelatedProducts(product.category, pid);

  async function loadRelatedProducts(category, currentPid) {
    const relSection = document.getElementById('pd-related');
    const relGrid = document.getElementById('pd-related-grid');
    if (!relSection || !relGrid || !category) return;

    let products = [];

    try {
      const res = await fetch(`${API}/products?category=${encodeURIComponent(category)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        products = Array.isArray(data) ? data : (data.products || []);
      }
    } catch (e) {}

    if (!products.length) {
      try {
        const res = await fetch('/data/products.json', { cache: 'no-store' });
        const all = await res.json();
        products = all.filter((p) => p.category === category);
      } catch (e) {}
    }

    products = products
      .filter((p) => (p._id || p.id) !== currentPid)
      .slice(0, 4);

    if (!products.length) return;

    let reviewsConfig = { reviewsEnabled: false, reviewsMinCount: 3 };
    try {
      const rvRes = await fetch(`${API}/reviews/config`);
      if (rvRes.ok) reviewsConfig = await rvRes.json();
    } catch (e) {}

    // Same card renderer used on Shop/Store, so related products show the
    // same shipping/star-rating/basket-button as everywhere else on the site.
    relGrid.innerHTML = products
      .map((p) => window.s4lProductCardHTML(p, { reviewsConfig, showBasketButton: true }))
      .join('');

    relSection.style.display = 'block';
  }

  // ── Reviews ────────────────────────────────────────────────
  if (typeof window.initReviews === 'function') {
    const _reviewVendorId = typeof product.vendor === 'object'
      ? (product.vendor?._id || product.vendor?.id)
      : product.vendor;
    window.initReviews(pid, _reviewVendorId);
  }
})();
