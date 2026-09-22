// Single source of truth for rendering a product card.
// Used by shop.js and store.js so every page shows products identically.

function s4lStarsHTML(rating, size) {
  let html = '<span class="s4l-stars">';
  for (let i = 1; i <= 5; i++) {
    const diff = rating - (i - 1);
    const cls = diff >= 1 ? 'filled' : diff >= 0.25 ? 'half' : 'empty';
    html += `<span class="s4l-star ${cls}" style="font-size:${size}px">★</span>`;
  }
  return html + '</span>';
}

window.s4lProductCardHTML = function (p, opts = {}) {
  const id = p._id || p.id;
  // Callers should `await window.S4L_CURRENCY_READY` before rendering
  // cards in a loop — this reads whatever currency.js has already
  // resolved by then, falling back to plain GBP if currency.js never
  // loaded on a given page.
  const fmtPrice = window.s4lFormatPrice || ((n) => `£${Number(n || 0).toFixed(2)}`);
  const price = fmtPrice(p.price || 0);

  const compareRaw = p.comparePrice ?? p.compare_price ?? null;
  const compareEl = compareRaw && Number(compareRaw) > Number(p.price)
    ? `<span class="sp-compare">${fmtPrice(compareRaw)}</span>` : '';

  let img = '/assets/images/products/sell4life-placeholder.png';
  if (Array.isArray(p.images) && p.images[0]) {
    img = p.images[0].startsWith('http') ? p.images[0] : `/assets/images/products/${p.images[0]}`;
  } else if (p.image) {
    img = p.image;
  }

  const href = p.slug
    ? `/product/product.html?slug=${encodeURIComponent(p.slug)}`
    : `/product/product.html?id=${id}`;

  const rv = opts.reviewsConfig || {};
  const starsRow = rv.reviewsEnabled && (p.reviewCount || 0) >= (rv.reviewsMinCount || 0) && p.avgRating
    ? `<div class="sp-stars-row">${s4lStarsHTML(p.avgRating, 16)}<span class="s4l-stars-count">${p.reviewCount}</span></div>`
    : '';

  // Own-listing / out-of-stock disable is decided here, synchronously, at
  // render time — single source of truth, same on every page. (quick-add.js's
  // s4l_markOwnListings() still runs afterward too, as a fallback for the rare
  // case where the vendor's own ID resolves a moment after this card already
  // rendered; this synchronous check covers the common case immediately.)
  const myVid = localStorage.getItem('s4l_vendorId');
  const pvid = p.vendor && typeof p.vendor === 'object' ? (p.vendor._id || p.vendor.id) : p.vendor;
  const isOwnListing = !!(myVid && pvid && String(pvid) === myVid);

  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
  const stockNum = p.stock !== undefined && p.stock !== null ? Number(p.stock) : null;
  const productOos = stockNum !== null && stockNum <= 0;
  // A product-level "out of stock" is always authoritative and is never
  // overridden by a variant's own (possibly stale/inconsistent) number —
  // otherwise a broken/duplicate listing can show contradictory stock
  // status on different pages. Separately, a variant product also counts
  // as out of stock once EVERY variant individually reports 0 — a variant
  // with genuinely unknown stock is treated as available, never as
  // confirmed zero (mirrors the CJ sync inventory rule).
  const allVariantsOos = hasVariants && p.variants.every(
    (v) => v.stock !== undefined && v.stock !== null && Number(v.stock) <= 0
  );
  const isOutOfStock = productOos || (hasVariants && allVariantsOos);
  // Seller-set shipping scope vs. this browser's GeoIP-detected country —
  // same field product.js reads for the single-product page. Unlike
  // own-listing/out-of-stock, this one stays a real (non-disabled) button:
  // quick-add.js shows a toast explaining why instead of adding, so a
  // buyer clicking it from a card gets the same answer they'd get on the
  // product page rather than a button that just silently does nothing.
  const notShippable = p.shippableToBuyer === false;

  const disabled = isOwnListing || isOutOfStock;
  const disabledTitle = isOwnListing ? 'Your listing' : 'Out of stock';

  const basketBtn = (opts.showBasketButton && !p.comingSoon) ? `
    <button class="sp-quick-add-btn" data-id="${id}"
      title="${disabled ? disabledTitle : notShippable ? 'Not shipped to your location' : 'Add to basket'}"
      ${disabled ? `disabled style="opacity:0.35;cursor:not-allowed"` : notShippable ? `style="opacity:0.35"` : ''}
      ${isOutOfStock ? 'data-oos="1"' : ''}
      ${notShippable ? 'data-not-shippable="1"' : ''}>
      <svg width="21" height="24" viewBox="0 0 24 28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 13C7 5 17 5 17 13"/>
        <path d="M1 12H23V23Q23 27 19 27H5Q1 27 1 23V12Z"/>
      </svg>
      <span class="sp-qa-clr" title="Remove from basket">CLR</span>
    </button>` : '';

  if (opts.showBasketButton) {
    window._qaProducts = window._qaProducts || {};
    window._qaProducts[id] = p;
  }

  return `
    <div class="sp-card-wrap">
      <a href="${href}" class="sp-card${p.comingSoon ? ' sp-card-coming-soon' : ''}${!p.comingSoon && isOutOfStock ? ' sp-card-oos' : ''}">
        <div class="sp-img-wrap">
          <img src="${img}" alt="${p.name}" loading="lazy"
            onerror="this.src='/assets/images/products/sell4life-placeholder.png'" />
          ${p.comingSoon ? '<div class="sp-coming-soon-badge"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg> Coming Soon</div>' : ''}
          ${!p.comingSoon && isOutOfStock ? '<div class="sp-oos-badge">Out of Stock</div>' : ''}
        </div>
        <div class="sp-info">
          <p class="sp-name">${p.name}</p>
          ${starsRow}
        </div>
      </a>
      <div class="sp-card-footer">
        <div class="sp-price-block">
          <div class="sp-price-row">
            <span class="sp-price">${price}</span>
            ${compareEl}
          </div>
          <div class="sp-shipping-row">
            ${p.acceptOffers ? '<span class="sp-offer-badge">Make an Offer</span>' : ''}
            <span class="sp-shipping">${window.s4lShippingText(p.shipIncluded ? 0 : p.shippingCost, p.collectionOnly)}</span>
          </div>
        </div>
        ${basketBtn}
      </div>
    </div>`;
};
