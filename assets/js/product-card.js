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
  const price = Number(p.price || 0).toFixed(2);

  const compareRaw = p.comparePrice ?? p.compare_price ?? null;
  const compareEl = compareRaw && Number(compareRaw) > Number(p.price)
    ? `<span class="sp-compare">£${Number(compareRaw).toFixed(2)}</span>` : '';

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
  const isOutOfStock = !hasVariants && stockNum !== null && stockNum <= 0;

  const disabled = isOwnListing || isOutOfStock;
  const disabledTitle = isOwnListing ? 'Your listing' : 'Out of stock';

  const basketBtn = (opts.showBasketButton && !p.comingSoon) ? `
    <button class="sp-quick-add-btn" data-id="${id}" title="${disabled ? disabledTitle : 'Add to basket'}"
      ${disabled ? `disabled style="opacity:0.35;cursor:not-allowed"` : ''}
      ${isOutOfStock ? 'data-oos="1"' : ''}>
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
      <a href="${href}" class="sp-card${p.comingSoon ? ' sp-card-coming-soon' : ''}">
        <div class="sp-img-wrap">
          <img src="${img}" alt="${p.name}" loading="lazy"
            onerror="this.src='/assets/images/products/sell4life-placeholder.png'" />
          ${p.comingSoon ? '<div class="sp-coming-soon-badge">🕐 Coming Soon</div>' : ''}
        </div>
        <div class="sp-info">
          <p class="sp-name">${p.name}</p>
          ${starsRow}
        </div>
      </a>
      <div class="sp-card-footer">
        <div class="sp-price-block">
          <div class="sp-price-row">
            <span class="sp-price">£${price}</span>
            ${compareEl}
          </div>
          <span class="sp-shipping">${window.s4lShippingText(p.shippingCost)}</span>
        </div>
        ${basketBtn}
      </div>
    </div>`;
};
