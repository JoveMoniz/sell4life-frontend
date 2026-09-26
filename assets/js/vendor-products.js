/* ======================================================
   SELL4LIFE — VENDOR PRODUCTS
====================================================== */

const IMAGE_BASE = '/assets/images/products/';
const TIER_RANK_VP = { casual: 1, refurbished: 2, professional: 3, enterprise: 4 };
const _isPro = (TIER_RANK_VP[localStorage.getItem('s4l_vendorType')] || 1) >= 3;

// Foreign-currency equivalent(s) shown alongside every £ figure — but ONLY
// for a product actually scoped to that market (shippingOriginCountry/
// shippingCountries), same reasoning either way: a plain UK-only product
// has nothing to do with USD or EUR, so showing a conversion there is
// just noise, not useful reference info. Matches utils/shippingScope.js's
// own EU_CODES list (kept in sync manually — small, rarely changes).
const EU_CODES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
];
let _usdRate = null;
let _eurRate = null;
(async function loadForeignRates() {
  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch(`${window.API_BASE}/currency/rate/USD`),
      fetch(`${window.API_BASE}/currency/rate/EUR`),
    ]);
    if (usdRes.ok) _usdRate = (await usdRes.json()).rate;
    if (eurRes.ok) _eurRate = (await eurRes.json()).rate;
  } catch (_) { /* foreign-currency figures just won't show if this fails */ }
})();
function matchesMarket(p, code) {
  return p?.shippingOriginCountry === code
    || (Array.isArray(p?.shippingCountries) && p.shippingCountries.includes(code));
}
function isUsProduct(p) {
  return matchesMarket(p, 'US');
}
function isEuProduct(p) {
  return EU_CODES.some((code) => matchesMarket(p, code));
}
function currencyEquiv(gbpAmount, rate, symbol, cls) {
  const num = Number(gbpAmount || 0) * rate;
  const sign = num < 0 ? '-' : '';
  return ` <span class="${cls}">/ ${sign}${symbol}${Math.abs(num).toFixed(2)}</span>`;
}
function usdEquiv(gbpAmount, p) {
  if (!_usdRate || !isUsProduct(p)) return '';
  return currencyEquiv(gbpAmount, _usdRate, '$', 'vp-usd-equiv');
}
function eurEquiv(gbpAmount, p) {
  if (!_eurRate || !isEuProduct(p)) return '';
  return currencyEquiv(gbpAmount, _eurRate, '€', 'vp-usd-equiv');
}
// £ + $/€ formatter that keeps the sign consistent across every currency
// shown — callers pass the real signed number (e.g. fmtSigned(-fees, p))
// rather than prepending "-" themselves only in front of the £ side,
// which would leave the other figure(s) looking positive even when the £
// figure is negative.
function fmtSigned(n, p) {
  const num = Number(n || 0);
  const sign = num < 0 ? '-' : '';
  return `${sign}£${Math.abs(num).toFixed(2)}${usdEquiv(num, p)}${eurEquiv(num, p)}`;
}

// Styled confirm()/alert() (window.s4lConfirm/s4lAlert) come from the
// shared assets/js/s4l-dialog.js, injected on every vendor/admin page by
// config-global.js — no per-page setup needed here.

// Bulk price/stock edits require professional tier server-side (bulk
// archive/delete/coming-soon don't — those stay available to everyone).
// Non-pro sellers see the £ Price / ± Adjust / Stock buttons but get an
// upsell prompt instead of the real panel — no in-place upgrade exists,
// so this points at opening a new Professional seller account, not
// "upgrading" the current one.
function showProUpsell() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:380px;width:90%;box-shadow:0 20px 40px rgba(0,0,0,.2);text-align:center">
      <div style="margin-bottom:10px"><svg class="s4l-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></div>
      <h3 style="margin:0 0 10px;font-size:1.1rem">Professional feature</h3>
      <p style="margin:0 0 20px;color:#4b5563;font-size:0.92rem;line-height:1.5">Bulk pricing tools (£ Price, ± Adjust, Stock) are available on Professional seller accounts. Open a new seller account to unlock this.</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="pro-upsell-close" style="padding:8px 18px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:14px">Not now</button>
        <a href="/account/vendor/create.html" style="padding:8px 18px;border:none;border-radius:6px;background:#0b6b6a;color:#fff;cursor:pointer;font-size:14px;font-weight:600;text-decoration:none;display:inline-block">Open a Seller Account</a>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#pro-upsell-close').onclick = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

let _allProducts = [];
let _archivedProducts = [];
let _trashedProducts = [];
let _currentView = 'grid';
let _currentStatus = 'all';
let _currentSort = 'newest';
let _searchQuery = '';
// Cost-price range filter — lets a vendor select every product whose cost
// (not retail price) falls in a range, e.g. "everything under £3", then
// use the existing Select All + bulk markup panel to set a different
// markup% per price band in a few clicks instead of picking products by hand.
let _costMin = null;
let _costMax = null;
// '' = all. A product with no shippingOriginCountry recorded (never CJ
// synced) falls back to 'CN', matching the schema default and product.js's
// own treatment of that field.
let _shipFrom = '';
const _selected = new Set();
let _bulkShipOverride = null; // null = use DB value; true/false = user's manual choice
let _bulkLastEdited   = 'markup'; // 'markup' | 'price' — whichever the vendor typed into most recently
let _selectAnchorId   = null; // last plain/Ctrl-clicked card — Shift+click ranges from here
let _justDragged      = false; // true for the one click event right after a real marquee drag — stops it from clearing what the drag just selected

/* ── localStorage cache for archived products ────── */
// Keyed per vendor so multiple vendors on same device don't mix
function _archivedKey() {
  return 's4l_vp_archived_' + (localStorage.getItem('s4l_vendorId') || 'v');
}
function _loadArchivedCache() {
  try { return JSON.parse(localStorage.getItem(_archivedKey()) || '[]'); } catch { return []; }
}
function _saveArchivedCache() {
  try { localStorage.setItem(_archivedKey(), JSON.stringify(_archivedProducts)); } catch {}
}

/* ── Helpers ─────────────────────────────────────── */

function getImage(p) {
  const raw = p.images?.[0];
  if (raw && typeof raw === 'string') {
    return raw.startsWith('http') ? raw : IMAGE_BASE + raw;
  }
  return '/assets/images/products/sell4life-placeholder.png';
}

function fmt(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function stockMeta(stock) {
  const warn = window.s4lIcon ? window.s4lIcon('warning') : '⚠';
  if (stock === 0) return { cls: 'vp-stock-zero', label: `${warn} Out of stock` };
  if (stock <= 5)  return { cls: 'vp-stock-low',  label: `${warn} Low: ${stock}` };
  return { cls: '', label: `Stock: ${stock}` };
}

// Only shown when a vendor has restricted where a product ships — the
// 'worldwide' default is the common case and would just be noise here.
function scopeBadge(p) {
  const labels = { uk: 'Ships to UK only', uk_eu: 'Ships to UK + Europe' };
  if (p.shippingScope === 'custom') {
    const codes = p.shippingCountries || [];
    const names = new Map((window.S4L_COUNTRIES || []).map(c => [c.code, c.name]));
    const text = codes.map(c => names.get(c) || c).join(', ');
    return `<span class="vp-scope-badge">Ships to ${text || '0 countries'}</span>`;
  }
  if (labels[p.shippingScope]) {
    return `<span class="vp-scope-badge">${labels[p.shippingScope]}</span>`;
  }
  return '';
}

function moveTargets(p) {
  if (p.archived) return [{ status: 'active', label: 'Activate' }, { status: 'draft', label: 'Draft' }];
  if (p.active === false) return [{ status: 'active', label: 'Activate' }, { status: 'archived', label: 'Archive' }];
  return [{ status: 'draft', label: 'Draft' }, { status: 'archived', label: 'Archive' }];
}

function renderHoverActions(p) {
  return `<div class="vp-hover-actions">
    ${moveTargets(p).map(t => `<button type="button" class="vp-hover-action-btn" data-target="${t.status}">${t.label}</button>`).join('')}
  </div>`;
}

/* ── Video badge (count of attached videos) ──────── */

function videoBadge(p) {
  const n = ['videoUrl', 'videoUrl2', 'videoUrl3', 'videoUrl4', 'videoUrl5']
    .filter(f => (p[f] || '').trim()).length;
  if (!n) return '';
  return `<span class="vp-video-badge" title="${n} video${n !== 1 ? 's' : ''} attached">▶${n > 1 ? `<span class="vp-video-count">${n}</span>` : ''}</span>`;
}

// Inline-editable price, shown on both card and list views. Professional+
// only — the /products/bulk PATCH it saves through is tier-gated server-side.
function priceCell(p, id) {
  const val = Number(p.price || 0).toFixed(2);
  const foreign = `${usdEquiv(val, p)}${eurEquiv(val, p)}`;
  if (!_isPro) return `<span class="price">£${val}</span>${foreign}`;
  return `<span class="vp-price-edit-wrap" title="Click to edit price">
    <span class="vp-price-currency">£</span><input type="number" class="vp-price-edit" data-id="${id}" data-orig="${val}" value="${val}" step="0.01" min="0.01" draggable="false" />
  </span>${foreign}`;
}

/* ── Render: grid card ───────────────────────────── */

function renderCard(p) {
  const id     = p._id || p.id;
  const active = p.active !== false;
  const stock  = p.stock ?? 0;
  const { cls, label } = stockMeta(stock);
  const sel = _selected.has(id);

  return `
    <div class="vendor-product-card${sel ? ' vp-selected' : ''}" data-id="${id}" draggable="true">
      ${renderHoverActions(p)}
      <label class="vp-select-wrap" title="Select">
        <input type="checkbox" class="vp-select-cb" data-id="${id}"${sel ? ' checked' : ''} />
      </label>
      <div class="vp-img-wrap">
        <img src="${getImage(p)}" alt="${p.name || 'product'}" loading="lazy" draggable="false" />
        <span class="vp-badge ${active ? 'vp-badge-active' : 'vp-badge-draft'}">${active ? 'Active' : 'Draft'}</span>
        ${p.comingSoon ? '<span class="vp-badge vp-badge-coming-soon"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg> Coming Soon</span>' : ''}
        ${p.supplierUrl ? `<a href="${p.supplierUrl}" target="_blank" rel="noopener" class="vp-supplier-link" title="Open supplier listing" draggable="false"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M9 15l6-6"/><path d="M13 5l1.5-1.5a3.5 3.5 0 015 5L18 10"/><path d="M11 19l-1.5 1.5a3.5 3.5 0 01-5-5L6 14"/></svg></a>` : ''}
        ${videoBadge(p)}
        ${p.shippingUnavailableUK ? `<span class="vp-ship-warn-icon" title="CJ currently has no shipping route to the UK for this product — check the vendor's CJ API connection or this product's CJ listing"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M6.5 6.5l11 11"/></svg></span>` : ''}
      </div>

      <div class="vp-card-body">
        <h3 class="vp-name">${p.name || 'Unnamed product'}</h3>

        ${p.category ? `<div class="product-cat">${fmt(p.category)}${p.subcategory ? ' / ' + fmt(p.subcategory) : ''}</div>` : ''}

        <div class="vp-price-row">
          ${priceCell(p, id)}
          ${p.comparePrice ? `<span class="vp-compare">£${Number(p.comparePrice).toFixed(2)}</span>` : ''}
        </div>

        <div class="stock ${cls}">${label}</div>
        ${scopeBadge(p)}
      </div>

      <div class="vendor-product-actions">
        <a href="/account/vendor/edit-product.html?id=${id}" class="btn-edit" draggable="false">Edit</a>
        <a href="/product/product.html?id=${id}" class="btn-view-store" target="_blank" rel="noopener" draggable="false">View</a>
        ${_isPro ? `<button class="btn-duplicate" data-id="${id}" title="Duplicate as draft">Copy</button>` : ''}
        ${p.archived
          ? `<button class="btn-unarchive" data-id="${id}">Unarchive</button>`
          : `<button class="btn-coming-soon-toggle${p.comingSoon ? ' is-coming-soon' : ''}" data-id="${id}" title="${p.comingSoon ? 'Click to unblock — Coming Soon is ON' : 'Click to enable Coming Soon'}"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg></button>
        <button class="btn-archive" data-id="${id}">Archive</button>`}
        <button class="btn-delete" data-id="${id}">Delete</button>
      </div>
    </div>
  `;
}

/* ── Render: list row ────────────────────────────── */

function renderListRow(p) {
  const id     = p._id || p.id;
  const active = p.active !== false;
  const stock  = p.stock ?? 0;
  const { cls, label } = stockMeta(stock);
  const sel = _selected.has(id);

  return `
    <div class="vp-list-row${sel ? ' vp-selected' : ''}" data-id="${id}" draggable="true">
      ${renderHoverActions(p)}
      <label class="vp-select-wrap vp-select-wrap-list" title="Select">
        <input type="checkbox" class="vp-select-cb" data-id="${id}"${sel ? ' checked' : ''} />
      </label>
      <img src="${getImage(p)}" alt="${p.name || 'product'}" class="vp-list-img" loading="lazy" draggable="false" />
      ${p.supplierUrl ? `<a href="${p.supplierUrl}" target="_blank" rel="noopener" class="vp-supplier-link vp-supplier-link-list" title="Open supplier listing" draggable="false"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M9 15l6-6"/><path d="M13 5l1.5-1.5a3.5 3.5 0 015 5L18 10"/><path d="M11 19l-1.5 1.5a3.5 3.5 0 01-5-5L6 14"/></svg></a>` : ''}
      ${videoBadge(p)}

      <div class="vp-list-info">
        <div class="vp-list-name">${p.name || 'Unnamed product'}</div>
        ${p.category ? `<div class="product-cat">${fmt(p.category)}${p.subcategory ? ' / ' + fmt(p.subcategory) : ''}</div>` : ''}
        ${p.sku ? `<div class="vp-list-sku">SKU: ${p.sku}</div>` : ''}
      </div>

      <span class="vp-badge ${active ? 'vp-badge-active' : 'vp-badge-draft'}">${active ? 'Active' : 'Draft'}</span>
      ${p.comingSoon ? '<span class="vp-badge vp-badge-coming-soon"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg> Coming Soon</span>' : ''}

      <div class="vp-list-price">
        ${priceCell(p, id)}
        ${p.comparePrice ? `<span class="vp-compare">£${Number(p.comparePrice).toFixed(2)}</span>` : ''}
      </div>

      <div class="stock ${cls}">${label}</div>
      ${scopeBadge(p)}
      ${p.shippingUnavailableUK ? `<div class="vp-shipping-warn" title="CJ currently has no shipping route to the UK for this product — check the vendor's CJ API connection or this product's CJ listing"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M6.5 6.5l11 11"/></svg> No UK shipping</div>` : ''}

      <div class="vp-list-actions">
        <a href="/account/vendor/edit-product.html?id=${id}" class="btn-edit" draggable="false">Edit</a>
        <a href="/product/product.html?id=${id}" class="btn-view-store" target="_blank" rel="noopener" draggable="false">View</a>
        ${_isPro ? `<button class="btn-duplicate" data-id="${id}" title="Duplicate as draft">Copy</button>` : ''}
        ${p.archived
          ? `<button class="btn-unarchive" data-id="${id}">Unarchive</button>`
          : `<button class="btn-coming-soon-toggle${p.comingSoon ? ' is-coming-soon' : ''}" data-id="${id}" title="${p.comingSoon ? 'Disable Coming Soon' : 'Enable Coming Soon'}"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg> ${p.comingSoon ? 'Unblock' : 'Coming Soon'}</button>
        <button class="btn-archive" data-id="${id}">Archive</button>`}
        <button class="btn-delete" data-id="${id}">Delete</button>
      </div>
    </div>
  `;
}

/* ── Render: trash (grid + list) ──────────────────── */

function deletedDateLabel(p) {
  if (!p.deletedAt) return '';
  return new Date(p.deletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderTrashCard(p) {
  const id  = p._id || p.id;
  const sel = _selected.has(id);

  return `
    <div class="vendor-product-card vp-trashed${sel ? ' vp-selected' : ''}" data-id="${id}">
      <label class="vp-select-wrap" title="Select">
        <input type="checkbox" class="vp-select-cb" data-id="${id}"${sel ? ' checked' : ''} />
      </label>
      <div class="vp-img-wrap">
        <img src="${getImage(p)}" alt="${p.name || 'product'}" loading="lazy" />
        <span class="vp-badge vp-badge-trash">Deleted ${deletedDateLabel(p)}</span>
      </div>

      <div class="vp-card-body">
        <h3 class="vp-name">${p.name || 'Unnamed product'}</h3>
        ${p.category ? `<div class="product-cat">${fmt(p.category)}${p.subcategory ? ' / ' + fmt(p.subcategory) : ''}</div>` : ''}
        <div class="vp-price-row">
          <span class="price">£${Number(p.price || 0).toFixed(2)}</span>
        </div>
      </div>

      <div class="vendor-product-actions">
        <button class="btn-restore" data-id="${id}">Restore</button>
        <button class="btn-delete-forever" data-id="${id}">Delete Forever</button>
      </div>
    </div>
  `;
}

function renderTrashListRow(p) {
  const id  = p._id || p.id;
  const sel = _selected.has(id);

  return `
    <div class="vp-list-row vp-trashed${sel ? ' vp-selected' : ''}" data-id="${id}">
      <label class="vp-select-wrap vp-select-wrap-list" title="Select">
        <input type="checkbox" class="vp-select-cb" data-id="${id}"${sel ? ' checked' : ''} />
      </label>
      <img src="${getImage(p)}" alt="${p.name || 'product'}" class="vp-list-img" loading="lazy" />

      <div class="vp-list-info">
        <div class="vp-list-name">${p.name || 'Unnamed product'}</div>
        <div class="product-cat">Deleted ${deletedDateLabel(p)}</div>
      </div>

      <span class="vp-badge vp-badge-trash">Trash</span>

      <div class="vp-list-price">
        <span class="price">£${Number(p.price || 0).toFixed(2)}</span>
      </div>

      <div class="stock"></div>

      <div class="vp-list-actions">
        <button class="btn-restore" data-id="${id}">Restore</button>
        <button class="btn-delete-forever" data-id="${id}">Delete Forever</button>
      </div>
    </div>
  `;
}

/* ── Skeleton loader ─────────────────────────────── */

function showSkeleton(container) {
  container.className = 'vendor-products-grid';
  container.innerHTML = Array.from({ length: 4 }, () => `
    <div class="vp-skeleton">
      <div class="vp-sk-img"></div>
      <div class="vp-sk-line"></div>
      <div class="vp-sk-line vp-sk-short"></div>
      <div class="vp-sk-line vp-sk-short"></div>
    </div>
  `).join('');
}

/* ── Filter + sort + render ──────────────────────── */

function renderProducts() {
  const container = document.getElementById('vendor-products');
  if (!container) return;

  const isArchiveMode = _currentStatus === 'archived';
  const isTrashMode   = _currentStatus === 'trash';

  // Toggle bulk bar buttons depending on the active tab
  const bulkPrice      = document.getElementById('btn-bulk-price');
  const bulkStock      = document.getElementById('btn-bulk-stock');
  const bulkDelivery   = document.getElementById('btn-bulk-delivery');
  const bulkComingSoon = document.getElementById('btn-bulk-coming-soon');
  const bulkArchive    = document.getElementById('btn-bulk-archive');
  const bulkUnarchive  = document.getElementById('btn-bulk-unarchive');
  const bulkDelete     = document.getElementById('btn-bulk-delete');
  const bulkRestoreTr  = document.getElementById('btn-bulk-restore-trash');
  const bulkEmptyTrash = document.getElementById('btn-bulk-empty-trash');
  if (bulkPrice)      bulkPrice.hidden      = isTrashMode;
  if (bulkStock)      bulkStock.hidden      = isTrashMode;
  if (bulkDelivery)   bulkDelivery.hidden   = isTrashMode;
  if (bulkComingSoon) bulkComingSoon.hidden = isArchiveMode || isTrashMode;
  if (bulkArchive)   bulkArchive.hidden   = isArchiveMode || isTrashMode;
  if (bulkUnarchive) bulkUnarchive.hidden = !isArchiveMode || isTrashMode;
  if (bulkDelete)    bulkDelete.hidden    = isTrashMode;
  if (bulkRestoreTr)  bulkRestoreTr.hidden  = !isTrashMode;
  if (bulkEmptyTrash) bulkEmptyTrash.hidden = !isTrashMode;

  let items = isTrashMode ? [..._trashedProducts] : isArchiveMode ? [..._archivedProducts] : [..._allProducts];

  if (!isArchiveMode && !isTrashMode && _currentStatus !== 'all') {
    const want = _currentStatus === 'active';
    items = items.filter(p => (p.active !== false) === want);
  }

  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    items = items.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    );
  }

  if (_costMin != null || _costMax != null) {
    items = items.filter(p => {
      const cost = Number(p.costPrice);
      if (!Number.isFinite(cost)) return false; // no cost price recorded — can't judge the range
      // Total cost = item cost + shipping, matching "True Cost" on the CSV
      // import tool — a £2 item with £3 shipping is a £5 landed cost, not £2.
      const ship = Number(p.shippingCost);
      const total = cost + (Number.isFinite(ship) ? ship : 0);
      if (_costMin != null && total < _costMin) return false;
      if (_costMax != null && total > _costMax) return false;
      return true;
    });
  }

  if (_shipFrom) {
    items = items.filter(p => (p.shippingOriginCountry || 'CN') === _shipFrom);
  }

  switch (_currentSort) {
    case 'name':
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'price-asc':
      items.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price-desc':
      items.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'stock-asc':
      items.sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
      break;
    // newest: keep API order
  }

  if (!items.length) {
    container.className = 'vendor-products-grid';

    if (isTrashMode) {
      container.innerHTML = `<div class="vp-empty"><p>Trash is empty.</p></div>`;
      return;
    }

    if (isArchiveMode) {
      container.innerHTML = `
        <div class="vp-empty">
          <p>No archived products.</p>
          <p style="font-size:0.83rem;color:#9ca3af;margin-top:6px">
            Already archived something? Paste its product page URL or ID below.
          </p>
          <div style="display:flex;gap:8px;margin-top:12px;max-width:420px">
            <input type="text" id="vp-recover-input" class="vp-search"
              placeholder="product.html?id=… or just the ID" style="flex:1;min-width:0" />
            <button class="btn-add-product" id="vp-recover-btn">Recover</button>
          </div>
        </div>`;
      return;
    }

    const hasFilters = _searchQuery || _currentStatus !== 'all' || _costMin != null || _costMax != null || _shipFrom;
    const msg = hasFilters ? 'No products match your filters.' : 'No products yet.';
    container.innerHTML = `
      <div class="vp-empty">
        <p>${msg}</p>
        ${!hasFilters
          ? `<a href="/account/vendor/add-product.html" class="btn-add-product">Add your first product</a>`
          : ''}
      </div>
    `;
    return;
  }

  container.className = `vendor-products-grid${_currentView === 'list' ? ' vp-list' : ''}`;
  if (isTrashMode) {
    container.innerHTML = (_currentView === 'list' ? items.map(renderTrashListRow) : items.map(renderTrashCard)).join('');
  } else {
    container.innerHTML = (_currentView === 'list' ? items.map(renderListRow) : items.map(renderCard)).join('');
  }
}

/* ── Toolbar wiring ──────────────────────────────── */

function updateClearFiltersBtn() {
  const btn = document.getElementById('btn-clear-filters');
  if (btn) btn.hidden = !(_searchQuery || _costMin != null || _costMax != null || _shipFrom);

  // Dot on the (mobile/tablet-only) "Filters" toggle — so an active cost or
  // shipping-origin filter is still visible even while that panel is collapsed.
  const dot = document.getElementById('vp-filters-dot');
  if (dot) dot.hidden = !(_costMin != null || _costMax != null || _shipFrom);
}

// Only lists countries actually present in this vendor's own catalog,
// rather than every possible country — a fixed, mostly-empty dropdown
// would be far less useful than one scoped to what they actually stock.
function populateShipFilterOptions() {
  const sel = document.getElementById('vp-ship-filter');
  if (!sel) return;
  const codes = new Set(
    [..._allProducts, ..._archivedProducts].map(p => p.shippingOriginCountry || 'CN')
  );
  const names = new Map((window.S4L_COUNTRIES || []).map(c => [c.code, c.name]));
  const options = [...codes].sort((a, b) => (names.get(a) || a).localeCompare(names.get(b) || b));
  const current = sel.value;
  sel.innerHTML = '<option value="">All</option>' +
    options.map(code => `<option value="${code}">${names.get(code) || code}</option>`).join('');
  if (options.includes(current)) sel.value = current;
}

function bindToolbar() {
  populateShipFilterOptions();

  const costMin = document.getElementById('vp-cost-min');
  const costMax = document.getElementById('vp-cost-max');
  if (costMin) {
    costMin.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      _costMin = Number.isFinite(v) ? v : null;
      updateClearFiltersBtn();
      renderProducts();
    });
  }
  if (costMax) {
    costMax.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      _costMax = Number.isFinite(v) ? v : null;
      updateClearFiltersBtn();
      renderProducts();
    });
  }

  const search = document.getElementById('vp-search');
  if (search) {
    search.addEventListener('input', e => {
      _searchQuery = e.target.value.trim();
      updateClearFiltersBtn();
      renderProducts();
    });
  }

  const shipFilter = document.getElementById('vp-ship-filter');
  if (shipFilter) {
    shipFilter.addEventListener('change', e => {
      _shipFrom = e.target.value;
      updateClearFiltersBtn();
      renderProducts();
    });
  }

  const filtersToggle = document.getElementById('vp-filters-toggle');
  const filtersRow = document.getElementById('vp-filters-row');
  if (filtersToggle && filtersRow) {
    filtersToggle.addEventListener('click', () => {
      const open = filtersRow.classList.toggle('vp-filters-open');
      filtersToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    _searchQuery = '';
    _costMin = null;
    _costMax = null;
    _shipFrom = '';
    if (search) search.value = '';
    if (costMin) costMin.value = '';
    if (costMax) costMax.value = '';
    if (shipFilter) shipFilter.value = '';
    updateClearFiltersBtn();
    renderProducts();
  });
  updateClearFiltersBtn();

  document.querySelectorAll('.vp-filter-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.vp-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentStatus = btn.dataset.status;
      _selected.clear();
      updateBulkBar();
      if (_currentStatus === 'trash') await fetchTrash();
      renderProducts();
    });
  });

  const sort = document.getElementById('vp-sort');
  if (sort) {
    sort.addEventListener('change', e => {
      _currentSort = e.target.value;
      renderProducts();
    });
  }

  document.querySelectorAll('.vp-view-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.vp-view-btn[data-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _currentView = btn.dataset.view;
      renderProducts();
    });
  });

  bindDropZones();
}

/* ── Trash ─────────────────────────────────────────── */

async function fetchTrash() {
  const token = localStorage.getItem('s4l_token');
  if (!token) return;
  try {
    const res = await fetch(`${window.API_BASE}/vendor/products?trashed=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    _trashedProducts = await res.json();
  } catch {
    window.showToast?.('Could not load Trash', 'error');
  }
}

// Lighter than loadVendorProducts() — re-syncs Active/Draft/Archived lists
// after a restore without re-binding toolbar listeners or flashing the skeleton.
async function refreshMainLists() {
  const token = localStorage.getItem('s4l_token');
  if (!token) return;
  try {
    const res = await fetch(`${window.API_BASE}/vendor/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    const all = await res.json();
    _allProducts = all.filter(p => !p.archived);

    const apiArchived = all.filter(p => p.archived);
    const cached       = _loadArchivedCache();
    const merged       = new Map();
    cached.forEach(p    => merged.set(p._id || p.id, p));
    apiArchived.forEach(p => merged.set(p._id || p.id, p));
    const activeIds = new Set(_allProducts.map(p => p._id || p.id));
    _archivedProducts = [...merged.values()].filter(p => !activeIds.has(p._id || p.id));
    _saveArchivedCache();
    populateShipFilterOptions();
  } catch {}
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-restore');
  if (!btn) return;
  const id = btn.dataset.id;
  const token = localStorage.getItem('s4l_token');
  if (!token) return;

  btn.disabled = true;
  btn.textContent = 'Restoring…';

  try {
    const res = await fetch(`${window.API_BASE}/products/${id}/restore`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    _trashedProducts = _trashedProducts.filter(p => (p._id || p.id) !== id);
    await refreshMainLists();
    renderProducts();
    window.showToast?.('Product restored');
  } catch {
    btn.disabled = false;
    btn.textContent = 'Restore';
    window.showToast?.('Restore failed', 'error');
  }
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-delete-forever');
  if (!btn) return;
  const id = btn.dataset.id;

  const confirmed = await window.confirmAction?.('Permanently delete this product? This cannot be undone.');
  if (!confirmed) return;

  const token = localStorage.getItem('s4l_token');
  if (!token) return;

  btn.disabled = true;
  btn.textContent = 'Deleting…';

  try {
    const res = await fetch(`${window.API_BASE}/products/${id}/permanent`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    _trashedProducts = _trashedProducts.filter(p => (p._id || p.id) !== id);
    renderProducts();
    window.showToast?.('Product permanently deleted');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Delete Forever';
    window.showToast?.(err.message || 'Delete failed', 'error');
  }
});

async function bulkTrashAction(action) {
  if (_selected.size === 0) return;
  const token = localStorage.getItem('s4l_token');
  const ids = [..._selected];
  const n = ids.length;

  const msg = action === 'restore'
    ? `Restore ${n} product${n > 1 ? 's' : ''}?`
    : `Permanently delete ${n} product${n > 1 ? 's' : ''}? This cannot be undone.`;
  const confirmed = await window.confirmAction?.(msg);
  if (!confirmed) return;

  let ok = 0;
  await Promise.all(ids.map(async (id) => {
    try {
      const url = action === 'restore'
        ? `${window.API_BASE}/products/${id}/restore`
        : `${window.API_BASE}/products/${id}/permanent`;
      const res = await fetch(url, {
        method: action === 'restore' ? 'PATCH' : 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        _trashedProducts = _trashedProducts.filter(p => (p._id || p.id) !== id);
        _selected.delete(id);
        ok++;
      }
    } catch {}
  }));

  if (action === 'restore') await refreshMainLists();
  renderProducts();
  updateBulkBar();
  window.showToast?.(`${ok} product${ok !== 1 ? 's' : ''} ${action === 'restore' ? 'restored' : 'permanently deleted'}`);
}

document.getElementById('btn-bulk-restore-trash')?.addEventListener('click', () => bulkTrashAction('restore'));
document.getElementById('btn-bulk-empty-trash')?.addEventListener('click',   () => bulkTrashAction('permanent'));

/* ── Drag-and-drop / hover-buttons into Active, Draft, Archived ── */

// Dragging a selected card moves the WHOLE selection, not just the one grabbed
document.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.vendor-product-card, .vp-list-row');
  if (!card) return;
  const id = card.dataset.id;
  const ids = (_selected.has(id) && _selected.size > 1) ? [..._selected] : [id];
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', JSON.stringify(ids));
  card.classList.add('vp-dragging');
});

document.addEventListener('dragend', (e) => {
  const card = e.target.closest('.vendor-product-card, .vp-list-row');
  card?.classList.remove('vp-dragging');
});

function bindDropZones() {
  const activeBtn = document.querySelector('.vp-filter-btn[data-status="active"]');
  const draftBtn = document.querySelector('.vp-filter-btn[data-status="draft"]');
  const archivedBtn = document.querySelector('.vp-filter-btn[data-status="archived"]');

  [activeBtn, draftBtn, archivedBtn].forEach((btn) => {
    if (!btn || btn.dataset.dropBound) return;
    btn.dataset.dropBound = '1';

    btn.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      btn.classList.add('vp-drop-target-active');
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('vp-drop-target-active'));
    btn.addEventListener('drop', async (e) => {
      e.preventDefault();
      btn.classList.remove('vp-drop-target-active');
      let ids;
      try { ids = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { ids = null; }
      if (!Array.isArray(ids) || !ids.length) return;
      await applyStatusToIds(ids, btn.dataset.status);
    });
  });
}

// Click a hover-action button → applies to the whole current selection (or just this card if nothing selected)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.vp-hover-action-btn');
  if (!btn) return;
  const card = btn.closest('[data-id]');
  const id = card?.dataset.id;
  if (!id) return;
  const ids = _selected.size > 0 ? [..._selected] : [id];
  await applyStatusToIds(ids, btn.dataset.target);
});

async function applyStatusToOne(id, targetStatus, token) {
  const isArchived = !!_archivedProducts.find(p => (p._id || p.id) === id);

  if (targetStatus === 'archived') {
    if (isArchived) return;
    const res = await fetch(`${window.API_BASE}/products/${id}/archive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    const product = _allProducts.find(p => (p._id || p.id) === id);
    if (product) { product.archived = true; _archivedProducts.push(product); }
    _allProducts = _allProducts.filter(p => (p._id || p.id) !== id);
    _saveArchivedCache();
    return;
  }

  // 'active' or 'draft' — unarchive first if needed, then set the active flag
  if (isArchived) {
    const archivedProduct = _archivedProducts.find(p => (p._id || p.id) === id);
    const res = await fetch(`${window.API_BASE}/products/${id}/unarchive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    archivedProduct.archived = false;
    _archivedProducts = _archivedProducts.filter(p => (p._id || p.id) !== id);
    _allProducts.push(archivedProduct);
    _saveArchivedCache();
  }

  const product = _allProducts.find(p => (p._id || p.id) === id);
  if (!product) return;
  const wantActive = targetStatus === 'active';

  const res = await fetch(`${window.API_BASE}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active: wantActive }),
  });
  if (!res.ok) throw new Error();
  product.active = wantActive;
}

async function applyStatusToIds(ids, targetStatus) {
  const token = localStorage.getItem('s4l_token');
  if (!token) return;

  let ok = 0;
  await Promise.all(ids.map(async (id) => {
    try {
      await applyStatusToOne(id, targetStatus, token);
      ok++;
    } catch {}
  }));

  renderProducts();
  updateBulkBar();

  const label = targetStatus === 'draft' ? 'moved to Draft' : targetStatus === 'archived' ? 'archived' : 'activated';
  window.showToast?.(`${ok} product${ok !== 1 ? 's' : ''} ${label}`);
}

/* ── Bulk selection ──────────────────────────────── */

function visibleIds() {
  return [...document.querySelectorAll('.vp-select-cb')].map(cb => cb.dataset.id);
}

document.getElementById('btn-multi-select')?.addEventListener('click', () => {
  // Single-stage now: select everything currently visible, or clear the
  // selection if everything visible is already selected. Ctrl+A does the
  // same thing — this button is just a mouse-only shortcut for it.
  const vids = visibleIds();
  const allSelected = vids.length > 0 && vids.every(id => _selected.has(id));
  if (allSelected) {
    vids.forEach(id => {
      _selected.delete(id);
      const card = document.querySelector(`[data-id="${id}"]`);
      card?.classList.remove('vp-selected');
      const cb = card?.querySelector('.vp-select-cb');
      if (cb) cb.checked = false;
    });
    _selectAnchorId = null;
  } else {
    // Selection matches exactly what's currently visible — not a union
    // with whatever was already selected under a different filter. Without
    // this, items hidden by a filter change (e.g. switching Shipping From)
    // stayed silently selected forever, so the count (and any bulk action)
    // included products the vendor could no longer even see.
    _selected.clear();
    document.querySelectorAll('.vp-selected').forEach(el => el.classList.remove('vp-selected'));
    document.querySelectorAll('.vp-select-cb:checked').forEach(cb => { cb.checked = false; });

    vids.forEach(id => {
      _selected.add(id);
      const card = document.querySelector(`[data-id="${id}"]`);
      card?.classList.add('vp-selected');
      const cb = card?.querySelector('.vp-select-cb');
      if (cb) cb.checked = true;
    });
    _selectAnchorId = vids[vids.length - 1] ?? null;
  }
  updateBulkBar();
  refillBulkPanel();
});

// Selects only products that have never had a successful AI listing
// generation (supplierTitle only ever gets set on the first successful
// run — see routes/vendor.js bulk-generate-listing). Lets a vendor re-run
// generation on just the ones that failed, instead of re-running (and
// re-paying for) the whole batch to catch a handful of failures.
document.getElementById('btn-select-needs-ai-listing')?.addEventListener('click', () => {
  const vids = visibleIds().filter(id => {
    const p = _allProducts.find(p => (p._id || p.id) === id);
    return p && !p.supplierTitle;
  });

  _selected.clear();
  document.querySelectorAll('.vp-selected').forEach(el => el.classList.remove('vp-selected'));
  document.querySelectorAll('.vp-select-cb:checked').forEach(cb => { cb.checked = false; });

  vids.forEach(id => {
    _selected.add(id);
    const card = document.querySelector(`[data-id="${id}"]`);
    card?.classList.add('vp-selected');
    const cb = card?.querySelector('.vp-select-cb');
    if (cb) cb.checked = true;
  });
  _selectAnchorId = vids[vids.length - 1] ?? null;

  updateBulkBar();
  refillBulkPanel();

  if (vids.length === 0) {
    window.showToast?.('Every visible product already has an AI-generated listing');
  }
});

function updateBulkBar() {
  const bar   = document.getElementById('vp-bulk-bar');
  const count = document.getElementById('vp-bulk-count');
  if (!bar) return;
  bar.hidden = _selected.size === 0;
  if (_selected.size === 0) {
    const panel = document.getElementById('vp-bulk-edit-panel');
    if (panel) { panel.hidden = true; delete panel.dataset.mode; }
    _selectAnchorId = null;
  }
  if (count) count.textContent = `${_selected.size} selected`;

  // "Select All" button reflects whether everything currently visible is
  // already selected — click does the opposite either way.
  const multiBtn = document.getElementById('btn-multi-select');
  if (multiBtn) {
    const vids = visibleIds();
    const allSelected = vids.length > 0 && vids.every(id => _selected.has(id));
    multiBtn.classList.toggle('active', allSelected);
    multiBtn.textContent = allSelected ? 'Deselect All' : 'Select All';
    multiBtn.title = allSelected ? 'Clear selection' : 'Select all visible products';
  }

  // Sync from CJ requires a selection — disabled until products are ticked
  const cjSyncBtn = document.getElementById('btn-bulk-cj-images');
  if (cjSyncBtn) {
    const syncIcon = window.s4lIcon ? window.s4lIcon('sync') : '';
    cjSyncBtn.innerHTML = _selected.size > 0
      ? `${syncIcon} Sync ${_selected.size} from CJ`
      : `${syncIcon} Sync from CJ`;
    cjSyncBtn.disabled = _selected.size === 0;
    cjSyncBtn.title    = _selected.size === 0 ? 'Select products first, then sync them from CJ' : '';
  }
  const bulkCjBtn = document.getElementById('btn-bulk-cj-sync');
  if (bulkCjBtn) {
    const syncIcon2 = window.s4lIcon ? window.s4lIcon('sync') : '';
    bulkCjBtn.innerHTML = _selected.size > 0
      ? `${syncIcon2} Sync ${_selected.size} from CJ`
      : `${syncIcon2} Sync CJ`;
  }

  // Force Re-match Category — also requires a selection
  const rematchBtn = document.getElementById('btn-bulk-rematch-category');
  if (rematchBtn) {
    rematchBtn.innerHTML = _selected.size > 0
      ? `<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M3 11V5a2 2 0 012-2h6l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/></svg> Re-match ${_selected.size}`
      : '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M3 11V5a2 2 0 012-2h6l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/></svg> Re-match Category';
    rematchBtn.disabled = _selected.size === 0;
    rematchBtn.title    = _selected.size === 0 ? 'Select products first, then re-match their category' : rematchBtn.title;
  }
  const bulkRematchBtn = document.getElementById('btn-bulk-rematch-sync');
  if (bulkRematchBtn) {
    bulkRematchBtn.innerHTML = _selected.size > 0
      ? `<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M3 11V5a2 2 0 012-2h6l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/></svg> Re-match ${_selected.size}`
      : '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M3 11V5a2 2 0 012-2h6l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/></svg> Re-match Category';
  }

  // AI Generate Listing — also requires a selection
  const genListingBtn = document.getElementById('btn-bulk-generate-listing');
  if (genListingBtn) {
    genListingBtn.innerHTML = _selected.size > 0
      ? `<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/></svg> Generate ${_selected.size}`
      : '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/></svg> Generate Listing (AI)';
    genListingBtn.disabled = _selected.size === 0;
    genListingBtn.title    = _selected.size === 0 ? 'Select products first, then generate their listing with AI' : genListingBtn.title;
  }
  const bulkGenListingBtn = document.getElementById('btn-bulk-generate-listing-sync');
  if (bulkGenListingBtn) {
    bulkGenListingBtn.innerHTML = _selected.size > 0
      ? `<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/></svg> Generate ${_selected.size}`
      : '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/></svg> Generate Listing (AI)';
  }

  // Coming Soon bulk button reflects whether the current selection is
  // already all Coming Soon — so clicking it does the obvious opposite.
  const bulkComingSoonBtn = document.getElementById('btn-bulk-coming-soon');
  if (bulkComingSoonBtn && _selected.size > 0) {
    const selectedProducts = [..._selected].map(id => _allProducts.find(p => (p._id || p.id) === id)).filter(Boolean);
    const allAlreadyComingSoon = selectedProducts.length > 0 && selectedProducts.every(p => p.comingSoon);
    bulkComingSoonBtn.innerHTML = allAlreadyComingSoon
      ? `${window.s4lIcon ? window.s4lIcon('check') : '✓'} Unblock`
      : `${window.s4lIcon ? window.s4lIcon('clock') : ''} Coming Soon`;
    bulkComingSoonBtn.dataset.target = allAlreadyComingSoon ? 'false' : 'true';
  }
}

function _syncCardSelected(id, isSelected) {
  const card = document.querySelector(`[data-id="${id}"]`);
  card?.classList.toggle('vp-selected', isSelected);
  const cb = card?.querySelector('.vp-select-cb');
  if (cb) cb.checked = isSelected;
}

// Plain click — select only this card, clearing any other selection.
function selectOnly(id) {
  [..._selected].forEach(prevId => _syncCardSelected(prevId, false));
  _selected.clear();
  _bulkShipOverride = null; // each new card shows its own DB state
  _selected.add(id);
  _syncCardSelected(id, true);
  updateBulkBar();
  refillBulkPanel();
}

// Ctrl+click / checkbox click — toggle just this one, leave the rest alone.
function toggleOne(id) {
  if (_selected.has(id)) {
    _selected.delete(id);
    _syncCardSelected(id, false);
  } else {
    _selected.add(id);
    _syncCardSelected(id, true);
  }
  updateBulkBar();
  refillBulkPanel();
}

// Shift+click — select the contiguous range (in current grid order) between
// the last plain/Ctrl-clicked card and this one, replacing the selection.
function selectRange(fromId, toId) {
  const ordered = [...document.querySelectorAll('#vendor-products .vendor-product-card, #vendor-products .vp-list-row')].map(el => el.dataset.id);
  const fromIdx = ordered.indexOf(fromId);
  const toIdx   = ordered.indexOf(toId);
  if (fromIdx === -1 || toIdx === -1) { selectOnly(toId); return; }
  const [lo, hi] = fromIdx <= toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];

  [..._selected].forEach(prevId => _syncCardSelected(prevId, false));
  _selected.clear();
  _bulkShipOverride = null;
  for (let i = lo; i <= hi; i++) {
    _selected.add(ordered[i]);
    _syncCardSelected(ordered[i], true);
  }
  updateBulkBar();
  refillBulkPanel();
}

// Tracks where the mousedown that started the current click sequence
// actually began — click fires on wherever the mouse is released, which
// can be different from where the drag started (e.g. clicking into the
// search box or an inline price edit, then drifting out over the grid
// background before releasing — that "click" lands on the background even
// though the user was just editing text, not selecting products). Capture
// phase so this always runs before anything else can stop propagation.
let _mousedownStartedOnEditable = false;
document.addEventListener('mousedown', (e) => {
  _mousedownStartedOnEditable = !!e.target.closest('input, textarea, select, .vp-price-edit, [contenteditable]');
}, true);

// Click anywhere on card to select (ignore action buttons/links/inputs) —
// Windows-Explorer-style: plain click selects only this one, Ctrl/Cmd+click
// toggles it in/out of the selection, Shift+click selects the range from
// the last plain/Ctrl click.
document.addEventListener('click', (e) => {
  if (e.target.closest('.vendor-product-actions, .vp-list-actions, a, button, input')) return;
  const card = e.target.closest('.vendor-product-card, .vp-list-row');
  if (!card) {
    // Plain click on empty background clears the selection — same as
    // Explorer. Skipped for the one click that follows a real marquee
    // drag, so releasing the mouse doesn't immediately wipe out what the
    // drag just selected — and skipped when the click's mousedown actually
    // started inside a text field, so drifting out of the search box or a
    // price edit while releasing doesn't clear the selection either.
    if (_justDragged) { _justDragged = false; return; }
    if (_mousedownStartedOnEditable) return;
    // Clicking anywhere in the header, search/filter toolbar, or bulk-action
    // bar/edit panel is interacting with page chrome, not the grid — never
    // clears the selection, even on the whitespace between controls there.
    if (e.target.closest('.vp-page-header, .vp-toolbar, .vp-sticky-bulk')) return;
    if (e.target.closest('.vendor-main') && _selected.size > 0) {
      [..._selected].forEach(id => _syncCardSelected(id, false));
      _selected.clear();
      _selectAnchorId = null;
      updateBulkBar();
      refillBulkPanel();
    }
    return;
  }
  const id = card.dataset.id;

  if (e.shiftKey) {
    selectRange(_selectAnchorId ?? id, id);
  } else if (e.ctrlKey || e.metaKey) {
    toggleOne(id);
    _selectAnchorId = id;
  } else {
    selectOnly(id);
    _selectAnchorId = id;
  }
});

// Checkbox is always toggle-only, regardless of modifier keys — this is the
// touch/mobile-friendly multi-select path, since Ctrl/Shift don't exist there.
document.addEventListener('change', (e) => {
  if (!e.target.classList.contains('vp-select-cb')) return;
  toggleOne(e.target.dataset.id);
});

// Ctrl+A / Cmd+A — select everything currently visible/filtered, same set
// the "Select All" button uses. Skipped only for genuine free-text fields
// (the search box, and textareas) where select-all-to-overwrite is a real
// use case. Number inputs (the cost min/max filters) and <select> are
// deliberately NOT skipped — for a <select>, letting the browser's native
// Ctrl+A run instead selects the whole page's visible text, not just the
// dropdown, which is the bug this replaces; for the cost filters, users
// expect Ctrl+A there to bulk-select the filtered products, same as
// anywhere else on the page.
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    if (document.activeElement?.matches('input:not([type="number"]), textarea')) return;
    e.preventDefault();
    const vids = visibleIds();
    // Same fix as the Select All button — replace the selection with
    // exactly what's visible, don't union onto a stale selection from a
    // different filter state.
    _selected.forEach(id => { if (!vids.includes(id)) _syncCardSelected(id, false); });
    _selected.clear();
    vids.forEach(id => { _selected.add(id); _syncCardSelected(id, true); });
    _selectAnchorId = vids[vids.length - 1] ?? null;
    updateBulkBar();
    refillBulkPanel();
  }
});

/* ── Marquee (drag-to-select) on empty grid background ──────────────────
   Native card drag (dragstart above) only ever starts when the mousedown
   begins ON a card, so this only ever arms on genuine background clicks —
   the two features can't intercept each other. */
(function initMarqueeSelect() {
  const DRAG_THRESHOLD = 4;   // px before a marquee actually shows — avoids flashing one on a plain background click
  const EDGE_ZONE      = 40;  // px from viewport top/bottom that triggers auto-scroll
  const MAX_SCROLL_SPEED = 18; // px per frame at the very edge

  let dragging   = false;
  let armed      = false; // mousedown happened on valid background, waiting to cross the threshold
  let startX = 0, startY = 0;     // viewport coords at mousedown
  let startScrollX = 0, startScrollY = 0; // scroll position at mousedown — startX/Y + these = fixed document-space anchor
  let lastX  = 0, lastY  = 0;     // viewport coords, updated on every mousemove
  let marqueeEl = null;
  let rafId  = null;

  // `html`/`body` here have overflow-x set (clip in vendor.css, overriding
  // layout.css's hidden) with no overflow-y set — per the CSS spec that
  // forces overflow-y to compute as auto too, making body/html their own
  // scroll container. window.scrollY stays 0 the whole time as a result,
  // so it can't be used for the scroll math below — read/scroll whichever
  // of these actually has the real offset instead.
  function getScrollY() {
    return Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0, document.body.scrollTop || 0);
  }
  function getScrollX() {
    return Math.max(window.scrollX || 0, document.documentElement.scrollLeft || 0, document.body.scrollLeft || 0);
  }
  function scrollPageBy(dy) {
    window.scrollBy(0, dy);
    document.documentElement.scrollTop += dy;
    document.body.scrollTop += dy;
  }

  function startDrag() {
    dragging = true;
    _bulkShipOverride = null;
    marqueeEl = document.createElement('div');
    marqueeEl.className = 'vp-marquee';
    document.body.appendChild(marqueeEl);
    rafId = requestAnimationFrame(tick);
  }

  function stopDrag() {
    if (dragging) _justDragged = true; // suppress the trailing click's "clear on background click"
    dragging = false;
    armed = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    marqueeEl?.remove();
    marqueeEl = null;
    document.body.classList.remove('vp-marquee-active');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  function tick() {
    if (!dragging) return;

    // Auto-scroll when the pointer sits near the top/bottom edge
    if (lastY < EDGE_ZONE) {
      scrollPageBy(-Math.ceil((1 - lastY / EDGE_ZONE) * MAX_SCROLL_SPEED));
    } else if (lastY > window.innerHeight - EDGE_ZONE) {
      scrollPageBy(Math.ceil((1 - (window.innerHeight - lastY) / EDGE_ZONE) * MAX_SCROLL_SPEED));
    }

    // Document-space coordinates, not viewport — otherwise, once auto-scroll
    // moves the page, cards that were already swept into the rectangle
    // scroll out from under a viewport-fixed box and get deselected again.
    // The start corner is fixed (recorded once, at mousedown); the current
    // corner tracks the pointer plus whatever the page has scrolled since,
    // so the rectangle keeps growing to cover everything passed over.
    const scrollX = getScrollX(), scrollY = getScrollY();
    const startDocX = startX + startScrollX, startDocY = startY + startScrollY;
    const curDocX   = lastX + scrollX,        curDocY   = lastY + scrollY;

    const left   = Math.min(startDocX, curDocX);
    const top    = Math.min(startDocY, curDocY);
    const right  = Math.max(startDocX, curDocX);
    const bottom = Math.max(startDocY, curDocY);
    // The rectangle above is in document space (for the intersection test
    // below); the visible box stays position:fixed / viewport space — more
    // reliable to render than trying to figure out which element is the
    // real positioned ancestor when body/html end up as their own scroll
    // container — so convert back by subtracting this frame's scroll offset.
    if (marqueeEl) {
      marqueeEl.style.left   = (left - scrollX) + 'px';
      marqueeEl.style.top    = (top - scrollY) + 'px';
      marqueeEl.style.width  = (right - left) + 'px';
      marqueeEl.style.height = (bottom - top) + 'px';
    }

    const cards = document.querySelectorAll('#vendor-products .vendor-product-card, #vendor-products .vp-list-row');
    let changed = false;
    cards.forEach(card => {
      const r = card.getBoundingClientRect();
      const cardLeft = r.left + scrollX, cardRight  = r.right + scrollX;
      const cardTop  = r.top + scrollY,  cardBottom = r.bottom + scrollY;
      const intersects = cardLeft < right && cardRight > left && cardTop < bottom && cardBottom > top;
      const id = card.dataset.id;
      const wasSelected = _selected.has(id);
      if (intersects && !wasSelected) {
        _selected.add(id);
        _syncCardSelected(id, true);
        changed = true;
      } else if (!intersects && wasSelected) {
        _selected.delete(id);
        _syncCardSelected(id, false);
        changed = true;
      }
    });
    if (changed) { updateBulkBar(); refillBulkPanel(); }

    rafId = requestAnimationFrame(tick);
  }

  function onMouseMove(e) {
    lastX = e.clientX;
    lastY = e.clientY;
    if (!dragging && armed) {
      if (Math.abs(lastX - startX) > DRAG_THRESHOLD || Math.abs(lastY - startY) > DRAG_THRESHOLD) {
        startDrag();
      }
    }
  }

  function onMouseUp() {
    stopDrag();
  }

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // left-click only
    if (e.target.closest('.vendor-product-card, .vp-list-row, button, a, input, select, textarea')) return;
    // Scoped to the page's main content area (not the exact grid box) so a
    // drag starting in the visually-empty margin around the grid still
    // arms the marquee, not just clicks landing inside #vendor-products'
    // own tight bounding box.
    if (!e.target.closest('.vendor-main')) return;

    // Without this, the browser starts its own native text-selection drag
    // at the same time, which fights the marquee (selection highlight
    // flashing, mousemove coordinates getting confused).
    e.preventDefault();
    document.body.classList.add('vp-marquee-active');

    armed  = true;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    startScrollX = getScrollX();
    startScrollY = getScrollY();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
})();

// Inline price edit on the card/list — commits on blur/Enter, keeps markup%
// in sync the same way the edit-product page does (see markup-calc.js).
document.addEventListener('focusin', (e) => {
  if (e.target.classList?.contains('vp-price-edit')) e.target.select();
});

document.addEventListener('keydown', (e) => {
  if (e.target.classList?.contains('vp-price-edit') && e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
});

document.addEventListener('change', async (e) => {
  if (!e.target.classList.contains('vp-price-edit')) return;
  const input = e.target;
  const id    = input.dataset.id;
  const orig  = parseFloat(input.dataset.orig) || 0;
  let val     = parseFloat(input.value);

  if (isNaN(val) || val <= 0) {
    window.showToast?.('Enter a valid price', 'error');
    input.value = orig.toFixed(2);
    return;
  }
  val = Math.round(val * 100) / 100;
  if (val === orig) { input.value = val.toFixed(2); return; }

  const p     = _allProducts.find(x => (x._id || x.id) === id);
  const token = localStorage.getItem('s4l_token');

  // Derive markup% from the price the vendor just typed, same relationship
  // as markup-calc.js on the full edit page — only when a cost price exists.
  let markupPct;
  if (p && Number(p.costPrice) > 0) {
    const ship = p.shipIncluded ? (parseFloat(p.shippingCost) || 0) : 0;
    const base = Number(p.costPrice) + ship;
    if (base > 0) {
      const derived = Math.round((val / base - 1) * 1000) / 10;
      if (derived >= 0) markupPct = derived;
    }
  }

  input.disabled = true;
  try {
    const res = await fetch(`${window.API_BASE}/products/bulk`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: [id], price: val, ...(markupPct !== undefined ? { markupPct } : {}) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    if (p) {
      p.price = val;
      if (markupPct !== undefined) p.markupPct = markupPct;
    }
    input.dataset.orig = val.toFixed(2);
    input.value = val.toFixed(2);
    input.classList.add('vp-price-saved');
    setTimeout(() => input.classList.remove('vp-price-saved'), 1200);
    window.showToast?.('Price updated');
  } catch (err) {
    console.error(err);
    window.showToast?.(err.message || 'Failed to update price', 'error');
    input.value = orig.toFixed(2);
  } finally {
    input.disabled = false;
  }
});


document.getElementById('btn-bulk-clear')?.addEventListener('click', () => {
  _selected.clear();
  document.querySelectorAll('.vp-select-cb').forEach(cb => cb.checked = false);
  document.querySelectorAll('.vp-selected').forEach(el => el.classList.remove('vp-selected'));
  updateBulkBar();
});

// Toolbar dropdown menus ("Tools", "AI & CJ Tools", "Edit", "Manage") — same
// open/close pattern as the per-order .order-actions-wrapper elsewhere in
// this codebase, just delegated here since these are page-level, not
// per-row. The buttons inside are untouched — same ids, same listeners
// wired elsewhere in this file — this only opens/closes the wrapper.
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.vp-toolbar-menu-toggle');
  if (toggle) {
    const menu = toggle.parentElement.querySelector('.order-actions-menu');
    document.querySelectorAll('.vp-toolbar-menu .order-actions-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
    menu?.classList.toggle('open');
    return;
  }
  const clickedMenu = e.target.closest('.vp-toolbar-menu .order-actions-menu');
  if (clickedMenu) {
    clickedMenu.classList.remove('open');
    return;
  }
  if (!e.target.closest('.vp-toolbar-menu')) {
    document.querySelectorAll('.vp-toolbar-menu .order-actions-menu.open').forEach(m => m.classList.remove('open'));
  }
});

// Shows what statuses are actually in a selection — e.g. "5 Active, 2 Draft, 1 Archived" —
// so a bulk action from the "All" tab doesn't surprise you with items you didn't expect.
function statusBreakdown(ids) {
  const counts = { active: 0, draft: 0, archived: 0 };
  ids.forEach((id) => {
    const p = _allProducts.find((p) => (p._id || p.id) === id) || _archivedProducts.find((p) => (p._id || p.id) === id);
    if (!p) return;
    if (p.archived) counts.archived++;
    else if (p.active === false) counts.draft++;
    else counts.active++;
  });
  const parts = [];
  if (counts.active)   parts.push(`${counts.active} Active`);
  if (counts.draft)     parts.push(`${counts.draft} Draft`);
  if (counts.archived) parts.push(`${counts.archived} Archived`);
  return parts.length > 1 ? ` (${parts.join(', ')})` : '';
}

async function bulkAction(action) {
  if (_selected.size === 0) return;
  const token = localStorage.getItem('s4l_token');
  const ids = [..._selected];
  const n = ids.length;
  const breakdown = statusBreakdown(ids);
  const msg = action === 'delete'
    ? `Move ${n} product${n > 1 ? 's' : ''} to Trash${breakdown}? You can restore them later.`
    : action === 'unarchive'
      ? `Restore ${n} product${n > 1 ? 's' : ''}? They will be active and visible to buyers again.`
      : `Archive ${n} product${n > 1 ? 's' : ''}${breakdown}? They will be hidden from buyers.`;
  const confirmed = await window.confirmAction?.(msg);
  if (!confirmed) return;

  // Disable the existing buttons and show a spinner alongside them rather than
  // replacing .vp-bulk-actions' innerHTML — swapping the HTML destroys the
  // original button elements, which silently drops their addEventListener
  // bindings (bound once at page load) and leaves the bar permanently stuck.
  const bar = document.getElementById('vp-bulk-bar');
  const actionsEl = bar?.querySelector('.vp-bulk-actions');
  const actionButtons = actionsEl ? [...actionsEl.querySelectorAll('button, select')] : [];
  let spinner;
  if (actionsEl) {
    actionButtons.forEach((b) => { b.disabled = true; });
    spinner = document.createElement('span');
    spinner.className = 'vp-bulk-spinner';
    spinner.style.marginRight = '8px';
    actionsEl.prepend(spinner);
  }

  let ok = 0;
  await Promise.all(ids.map(async (id) => {
    try {
      const url = action === 'delete'
        ? `${window.API_BASE}/products/${id}`
        : `${window.API_BASE}/products/${id}/${action}`;
      const res = await fetch(url, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (action === 'unarchive') {
          const restored = _archivedProducts.find(p => (p._id || p.id) === id);
          _archivedProducts = _archivedProducts.filter(p => (p._id || p.id) !== id);
          if (restored) { restored.archived = false; _allProducts.push(restored); }
        } else {
          _allProducts = _allProducts.filter(p => (p._id || p.id) !== id);
        }
        _selected.delete(id);
        ok++;
      }
    } catch {}
  }));

  spinner?.remove();
  actionButtons.forEach((b) => { b.disabled = false; });

  renderProducts();
  updateBulkBar();
  const label = action === 'delete' ? 'moved to Trash' : action === 'unarchive' ? 'restored' : 'archived';
  window.showToast?.(`${ok} product${ok !== 1 ? 's' : ''} ${label}`);
}

document.getElementById('btn-bulk-archive')?.addEventListener('click',   () => bulkAction('archive'));
document.getElementById('btn-bulk-unarchive')?.addEventListener('click', () => bulkAction('unarchive'));
document.getElementById('btn-bulk-delete')?.addEventListener('click',    () => bulkAction('delete'));

/* ── Bulk Coming Soon ──────────────────────────────── */

async function bulkSetComingSoon() {
  if (_selected.size === 0) return;
  const token = localStorage.getItem('s4l_token');
  const ids = [..._selected];
  const n = ids.length;

  // Toggle direction was already computed in updateBulkBar() based on
  // whether the selection is currently all Coming Soon.
  const btn = document.getElementById('btn-bulk-coming-soon');
  const target = btn?.dataset.target !== 'false';

  const confirmed = await window.confirmAction?.(
    target
      ? `Mark ${n} product${n > 1 ? 's' : ''} as Coming Soon? Buyers won't be able to purchase them until you unblock.`
      : `Unblock ${n} product${n > 1 ? 's' : ''}? They'll be purchasable again.`
  );
  if (!confirmed) return;

  let ok = 0;
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch(`${window.API_BASE}/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comingSoon: target }),
      });
      if (res.ok) {
        const product = _allProducts.find((p) => (p._id || p.id) === id);
        if (product) product.comingSoon = target;
        ok++;
      }
    } catch {}
  }));

  renderProducts();
  updateBulkBar();
  window.showToast?.(`${ok} product${ok !== 1 ? 's' : ''} ${target ? 'marked Coming Soon' : 'unblocked'}`);
}

document.getElementById('btn-bulk-coming-soon')?.addEventListener('click', bulkSetComingSoon);

/* ── Bulk price/stock edit ────────────────────────────── */

// Refreshes the edit panel fields whenever the selection changes while the panel is open
function refillBulkPanel() {
  const panel = document.getElementById('vp-bulk-edit-panel');
  if (!panel || panel.hidden) return;
  const mode = panel.dataset.mode;

  if (mode === 'markup') {
    const markupInput = document.getElementById('vp-bulk-markup');
    const inclShip    = document.getElementById('vp-bulk-incl-ship');
    const selectedProducts = [..._selected]
      .map(id => _allProducts.find(x => (x._id || x.id) === id)).filter(Boolean);
    if (inclShip) {
      inclShip.checked = _bulkShipOverride !== null
        ? _bulkShipOverride
        : selectedProducts.every(p => p.shipIncluded);
    }
    const markups = selectedProducts.map(p => {
      if (p.markupPct != null && isFinite(p.markupPct) && p.markupPct >= 0) return p.markupPct;
      return null;
    }).filter(x => x !== null);
    if (markupInput) {
      const valid = markups.filter(m => m >= 0);
      const allSame = valid.length > 0 && valid.every(m => m === valid[0]);
      markupInput.value       = allSame ? valid[0] : '';
      markupInput.placeholder = (!allSame && valid.length) ? 'varies' : '';
    }
    updateBulkPreview();
  }

  if (mode === 'stock') {
    const flatInput = document.getElementById('vp-bulk-edit-value');
    if (!flatInput) return;
    const stocks = [..._selected].map(id => {
      const p = _allProducts.find(x => (x._id || x.id) === id);
      return p != null ? (parseInt(p.stock) ?? null) : null;
    }).filter(x => x !== null);
    const allSame = stocks.length > 0 && stocks.every(s => s === stocks[0]);
    flatInput.value       = allSame ? stocks[0] : '';
    flatInput.placeholder = allSame ? '' : (stocks.length ? 'varies' : '0');
  }

  if (mode === 'delivery') {
    const minInput = document.getElementById('vp-bulk-delivery-min');
    const maxInput = document.getElementById('vp-bulk-delivery-max');
    if (!minInput || !maxInput) return;
    const selectedProducts = [..._selected]
      .map(id => _allProducts.find(x => (x._id || x.id) === id)).filter(Boolean);
    const mins = selectedProducts.map(p => parseInt(p.estDeliveryMinDays)).filter(v => Number.isFinite(v));
    const maxs = selectedProducts.map(p => parseInt(p.estDeliveryMaxDays)).filter(v => Number.isFinite(v));
    const minSame = mins.length > 0 && mins.every(v => v === mins[0]);
    const maxSame = maxs.length > 0 && maxs.every(v => v === maxs[0]);
    minInput.value       = minSame ? mins[0] : '';
    minInput.placeholder = minSame ? '' : (mins.length ? 'varies' : 'min');
    maxInput.value       = maxSame ? maxs[0] : '';
    maxInput.placeholder = maxSame ? '' : (maxs.length ? 'varies' : 'max');
  }

  if (mode === 'shipping-scope') {
    const scopeSelect = document.getElementById('vp-bulk-shipping-scope-select');
    const countriesEl = document.getElementById('vp-bulk-shipping-countries');
    if (!scopeSelect) return;
    const selectedProducts = [..._selected]
      .map(id => _allProducts.find(x => (x._id || x.id) === id)).filter(Boolean);
    const scopes = selectedProducts.map(p => p.shippingScope || 'worldwide');
    const allSame = scopes.length > 0 && scopes.every(s => s === scopes[0]);
    scopeSelect.value = allSame ? scopes[0] : 'worldwide';
    if (countriesEl) {
      countriesEl.style.display = scopeSelect.value === 'custom' ? '' : 'none';
      if (allSame && scopes[0] === 'custom') {
        const common = selectedProducts[0]?.shippingCountries || [];
        Array.from(countriesEl.options).forEach(o => { o.selected = common.includes(o.value); });
      } else {
        Array.from(countriesEl.options).forEach(o => { o.selected = false; });
      }
    }
  }
}

document.getElementById('btn-bulk-price')?.addEventListener('click', () => {
  if (!_isPro) { showProUpsell(); return; }
  const panel      = document.getElementById('vp-bulk-edit-panel');
  const label      = document.getElementById('vp-bulk-edit-label');
  const flatInput  = document.getElementById('vp-bulk-edit-value');
  const markupWrap = document.getElementById('vp-bulk-markup-wrap');
  const adjustWrap = document.getElementById('vp-bulk-adjust-wrap');
  const deliveryWrap = document.getElementById('vp-bulk-delivery-wrap');
  const scopeWrap = document.getElementById('vp-bulk-scope-wrap');
  const markupInput = document.getElementById('vp-bulk-markup');
  if (label) label.style.display = 'none';
  if (flatInput) flatInput.style.display = 'none';
  if (markupWrap) markupWrap.style.display = 'flex';
  if (adjustWrap) adjustWrap.style.display = 'none';
  if (deliveryWrap) deliveryWrap.style.display = 'none';
  if (scopeWrap) scopeWrap.style.display = 'none';
  if (panel) { panel.hidden = false; panel.dataset.mode = 'markup'; }
  _bulkLastEdited = 'markup';
  refillBulkPanel();
  markupInput?.focus();
  markupInput?.select();
});

document.getElementById('btn-bulk-adjust')?.addEventListener('click', () => {
  if (!_isPro) { showProUpsell(); return; }
  const panel       = document.getElementById('vp-bulk-edit-panel');
  const label       = document.getElementById('vp-bulk-edit-label');
  const flatInput   = document.getElementById('vp-bulk-edit-value');
  const markupWrap  = document.getElementById('vp-bulk-markup-wrap');
  const adjustWrap  = document.getElementById('vp-bulk-adjust-wrap');
  const deliveryWrap = document.getElementById('vp-bulk-delivery-wrap');
  const scopeWrap = document.getElementById('vp-bulk-scope-wrap');
  const amountInput = document.getElementById('vp-bulk-adjust-amount');
  if (label) label.style.display = 'none';
  if (flatInput) flatInput.style.display = 'none';
  if (markupWrap) markupWrap.style.display = 'none';
  if (adjustWrap) adjustWrap.style.display = 'flex';
  if (deliveryWrap) deliveryWrap.style.display = 'none';
  if (scopeWrap) scopeWrap.style.display = 'none';
  if (panel) { panel.hidden = false; panel.dataset.mode = 'adjust'; }
  updateAdjustPreview();
  amountInput?.focus();
  amountInput?.select();
});

document.getElementById('btn-bulk-stock')?.addEventListener('click', () => {
  if (!_isPro) { showProUpsell(); return; }
  const panel      = document.getElementById('vp-bulk-edit-panel');
  const label      = document.getElementById('vp-bulk-edit-label');
  const flatInput  = document.getElementById('vp-bulk-edit-value');
  const markupWrap = document.getElementById('vp-bulk-markup-wrap');
  const adjustWrap = document.getElementById('vp-bulk-adjust-wrap');
  const deliveryWrap = document.getElementById('vp-bulk-delivery-wrap');
  const scopeWrap = document.getElementById('vp-bulk-scope-wrap');
  if (label) { label.textContent = 'Set stock (qty)'; label.style.display = ''; }
  if (markupWrap) markupWrap.style.display = 'none';
  if (adjustWrap) adjustWrap.style.display = 'none';
  if (deliveryWrap) deliveryWrap.style.display = 'none';
  if (scopeWrap) scopeWrap.style.display = 'none';
  if (flatInput) { flatInput.type = 'number'; flatInput.step = '1'; flatInput.style.display = ''; }
  if (panel) { panel.hidden = false; panel.dataset.mode = 'stock'; }
  refillBulkPanel();
  flatInput?.focus();
  flatInput?.select();
});

document.getElementById('btn-bulk-delivery')?.addEventListener('click', () => {
  if (!_isPro) { showProUpsell(); return; }
  const panel       = document.getElementById('vp-bulk-edit-panel');
  const label       = document.getElementById('vp-bulk-edit-label');
  const flatInput   = document.getElementById('vp-bulk-edit-value');
  const markupWrap  = document.getElementById('vp-bulk-markup-wrap');
  const adjustWrap  = document.getElementById('vp-bulk-adjust-wrap');
  const deliveryWrap = document.getElementById('vp-bulk-delivery-wrap');
  const scopeWrap = document.getElementById('vp-bulk-scope-wrap');
  const minInput    = document.getElementById('vp-bulk-delivery-min');
  if (label) label.style.display = 'none';
  if (flatInput) flatInput.style.display = 'none';
  if (markupWrap) markupWrap.style.display = 'none';
  if (adjustWrap) adjustWrap.style.display = 'none';
  if (deliveryWrap) deliveryWrap.style.display = 'flex';
  if (scopeWrap) scopeWrap.style.display = 'none';
  if (panel) { panel.hidden = false; panel.dataset.mode = 'delivery'; }
  refillBulkPanel();
  minInput?.focus();
  minInput?.select();
});

document.getElementById('btn-bulk-shipping-scope')?.addEventListener('click', () => {
  if (!_isPro) { showProUpsell(); return; }
  const panel       = document.getElementById('vp-bulk-edit-panel');
  const label       = document.getElementById('vp-bulk-edit-label');
  const flatInput   = document.getElementById('vp-bulk-edit-value');
  const markupWrap  = document.getElementById('vp-bulk-markup-wrap');
  const adjustWrap  = document.getElementById('vp-bulk-adjust-wrap');
  const deliveryWrap = document.getElementById('vp-bulk-delivery-wrap');
  const scopeWrap = document.getElementById('vp-bulk-scope-wrap');
  const scopeSelect = document.getElementById('vp-bulk-shipping-scope-select');
  if (label) label.style.display = 'none';
  if (flatInput) flatInput.style.display = 'none';
  if (markupWrap) markupWrap.style.display = 'none';
  if (adjustWrap) adjustWrap.style.display = 'none';
  if (deliveryWrap) deliveryWrap.style.display = 'none';
  if (scopeWrap) scopeWrap.style.display = 'flex';
  if (panel) { panel.hidden = false; panel.dataset.mode = 'shipping-scope'; }
  const countriesEl = document.getElementById('vp-bulk-shipping-countries');
  if (countriesEl && !countriesEl.options.length && Array.isArray(window.S4L_COUNTRIES)) {
    countriesEl.innerHTML = window.S4L_COUNTRIES.map(c => `<option value="${c.code}">${c.name}</option>`).join('');
  }
  refillBulkPanel();
  scopeSelect?.focus();
});

document.getElementById('vp-bulk-shipping-scope-select')?.addEventListener('change', function () {
  const countriesEl = document.getElementById('vp-bulk-shipping-countries');
  if (countriesEl) countriesEl.style.display = this.value === 'custom' ? '' : 'none';
});

function calcRetailPrice(costPrice, shippingCost, markupPct, inclShip) {
  const cost = parseFloat(costPrice) || 0;
  if (cost <= 0) return null;
  const ship = inclShip ? (parseFloat(shippingCost) || 0) : 0;
  return Math.round((cost + ship) * (1 + markupPct / 100) * 100) / 100;
}

function deriveMarkupPct(price, costPrice, shippingCost, inclShip) {
  const cost = parseFloat(costPrice) || 0;
  if (cost <= 0) return null;
  const ship = inclShip ? (parseFloat(shippingCost) || 0) : 0;
  const base = cost + ship;
  if (base <= 0) return null;
  const pct = Math.round((price / base - 1) * 1000) / 10;
  return pct >= 0 ? pct : null;
}

// Markup% or + shipping changed — recompute price (per selected product's own cost)
function updateBulkPreview() {
  const priceInput  = document.getElementById('vp-bulk-price');
  const markupInput = document.getElementById('vp-bulk-markup');
  const inclShip    = document.getElementById('vp-bulk-incl-ship');
  if (!priceInput) return;
  const markupPct = parseFloat(markupInput?.value);
  if (isNaN(markupPct) || markupPct < 0) { priceInput.value = ''; priceInput.placeholder = '0.00'; return; }
  const selectedProducts = [..._selected]
    .map(id => _allProducts.find(x => (x._id || x.id) === id))
    .filter(Boolean);
  const prices = selectedProducts
    .map(p => calcRetailPrice(p.costPrice, p.shippingCost, markupPct, inclShip?.checked))
    .filter(x => x !== null);
  if (!prices.length) { priceInput.value = ''; priceInput.placeholder = '0.00'; return; }
  const min = Math.min(...prices), max = Math.max(...prices);
  if (min === max) {
    priceInput.value = min.toFixed(2);
    priceInput.placeholder = '0.00';
  } else {
    priceInput.value = '';
    priceInput.placeholder = `${min.toFixed(2)}–${max.toFixed(2)}`;
  }
}

// Price typed directly — derive markup% per selected product's own cost.
// Same relationship as markup-calc.js on the add/edit product page: whichever
// field the vendor last touched drives the other.
function updateBulkMarkupFromPrice() {
  const priceInput  = document.getElementById('vp-bulk-price');
  const markupInput = document.getElementById('vp-bulk-markup');
  const inclShip    = document.getElementById('vp-bulk-incl-ship');
  const price = parseFloat(priceInput?.value);
  if (!markupInput) return;
  if (isNaN(price) || price <= 0) { markupInput.value = ''; markupInput.placeholder = ''; return; }

  const selectedProducts = [..._selected]
    .map(id => _allProducts.find(x => (x._id || x.id) === id))
    .filter(Boolean);
  const markups = selectedProducts
    .map(p => deriveMarkupPct(price, p.costPrice, p.shippingCost, inclShip?.checked))
    .filter(x => x !== null);

  if (!markups.length) { markupInput.value = ''; markupInput.placeholder = ''; return; }
  const allSame = markups.every(m => m === markups[0]);
  markupInput.value       = allSame ? markups[0] : '';
  markupInput.placeholder = allSame ? '' : 'varies';
}

document.getElementById('vp-bulk-incl-ship')?.addEventListener('change', function () {
  _bulkShipOverride = this.checked; // remember user's choice across panel open/close
  if (_bulkLastEdited === 'price') updateBulkMarkupFromPrice();
  else updateBulkPreview();
});
document.getElementById('vp-bulk-markup')?.addEventListener('input', () => {
  _bulkLastEdited = 'markup';
  updateBulkPreview();
});
document.getElementById('vp-bulk-price')?.addEventListener('input', () => {
  _bulkLastEdited = 'price';
  updateBulkMarkupFromPrice();
});

// Adjust mode — delta (and/or round-to-.99) applied on top of each
// selected product's own current price, not a shared target price.
function applyPriceAdjust(price, amount, round99) {
  let newPrice = Number(price || 0) + amount;
  if (newPrice < 0.01) newPrice = 0.01;
  if (round99) newPrice = Math.floor(newPrice) + 0.99;
  return Math.round(newPrice * 100) / 100;
}

function updateAdjustPreview() {
  const preview     = document.getElementById('vp-bulk-adjust-preview');
  const amountInput = document.getElementById('vp-bulk-adjust-amount');
  const round99     = document.getElementById('vp-bulk-round99')?.checked;
  if (!preview) return;
  const amount = parseFloat(amountInput?.value) || 0;
  if (amount === 0 && !round99) { preview.textContent = ''; return; }

  const selectedProducts = [..._selected]
    .map(id => _allProducts.find(x => (x._id || x.id) === id))
    .filter(Boolean);
  if (!selectedProducts.length) { preview.textContent = ''; return; }

  const prices = selectedProducts.map(p => applyPriceAdjust(p.price, amount, round99));
  const min = Math.min(...prices), max = Math.max(...prices);
  preview.textContent = min === max ? `→ £${min.toFixed(2)}` : `→ £${min.toFixed(2)}–£${max.toFixed(2)}`;
}

document.getElementById('vp-bulk-adjust-amount')?.addEventListener('input', updateAdjustPreview);
document.getElementById('vp-bulk-round99')?.addEventListener('change', updateAdjustPreview);

document.getElementById('btn-bulk-edit-cancel')?.addEventListener('click', () => {
  const panel      = document.getElementById('vp-bulk-edit-panel');
  const label      = document.getElementById('vp-bulk-edit-label');
  const flatInput  = document.getElementById('vp-bulk-edit-value');
  const markupWrap = document.getElementById('vp-bulk-markup-wrap');
  const adjustWrap = document.getElementById('vp-bulk-adjust-wrap');
  const deliveryWrap = document.getElementById('vp-bulk-delivery-wrap');
  const scopeWrap = document.getElementById('vp-bulk-scope-wrap');
  if (label) label.style.display = '';
  if (flatInput) flatInput.style.display = '';
  if (markupWrap) markupWrap.style.display = 'none';
  if (adjustWrap) adjustWrap.style.display = 'none';
  if (deliveryWrap) deliveryWrap.style.display = 'none';
  if (scopeWrap) scopeWrap.style.display = 'none';
  if (panel) { panel.hidden = true; delete panel.dataset.mode; }
});

document.getElementById('btn-bulk-edit-apply')?.addEventListener('click', async () => {
  const panel = document.getElementById('vp-bulk-edit-panel');
  const mode  = panel?.dataset.mode;

  if (!mode) return;
  if (_selected.size === 0) { window.showToast?.('No products selected', 'error'); return; }

  const token  = localStorage.getItem('s4l_token');
  const ids    = [..._selected];
  const n      = ids.length;
  const actBtn = document.getElementById('btn-bulk-edit-apply');

  // ── Adjust mode (± Adjust button) — delta and/or round-to-.99 applied
  // on top of each selected product's own current price ─────────────────
  if (mode === 'adjust') {
    const amountInput = document.getElementById('vp-bulk-adjust-amount');
    const round99      = document.getElementById('vp-bulk-round99')?.checked;
    const amount = parseFloat(amountInput?.value) || 0;

    if (amount === 0 && !round99) {
      window.showToast?.('Enter an amount or enable Round to .99', 'error');
      return;
    }

    const updates = ids.map(id => {
      const p = _allProducts.find(x => (x._id || x.id) === id);
      if (!p) return null;
      const price = applyPriceAdjust(p.price, amount, round99);
      const markupPct = deriveMarkupPct(price, p.costPrice, p.shippingCost, p.shipIncluded);
      return { id, price, markupPct };
    }).filter(Boolean);

    const amountLabel = amount !== 0 ? `${amount > 0 ? '+' : ''}£${amount.toFixed(2)}` : '';
    const actionLabel = [amountLabel, round99 ? 'round to .99' : ''].filter(Boolean).join(' and ');
    const msg = `Apply ${actionLabel} to ${updates.length} product${updates.length !== 1 ? 's' : ''}?`;
    const confirmed = await window.confirmAction?.(msg);
    if (!confirmed) return;

    if (actBtn) { actBtn.disabled = true; actBtn.textContent = 'Applying…'; }

    let successCount = 0;
    try {
      await Promise.all(updates.map(async ({ id, price, markupPct: mu }) => {
        const body = { ids: [id], price };
        if (mu != null) body.markupPct = mu;
        const res = await fetch(`${window.API_BASE}/products/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const p = _allProducts.find(x => (x._id || x.id) === id);
        if (p) { p.price = price; if (mu != null) p.markupPct = mu; }
        successCount++;
      }));

      renderProducts();
      window.showToast?.(`Updated ${successCount} product${successCount !== 1 ? 's' : ''}`);
      updateAdjustPreview();
    } catch (err) {
      console.error(err);
      window.showToast?.(err.message || 'Update failed', 'error');
    } finally {
      if (actBtn) { actBtn.disabled = false; actBtn.textContent = 'Apply to selected'; }
    }
    return;
  }

  // ── Price mode (vendor typed a price directly, not a markup%) ─────────
  if (mode === 'markup' && _bulkLastEdited === 'price') {
    const priceInput = document.getElementById('vp-bulk-price');
    const inclShip    = document.getElementById('vp-bulk-incl-ship');
    const flatPrice   = parseFloat(priceInput?.value);

    if (isNaN(flatPrice) || flatPrice <= 0) {
      window.showToast?.('Enter a valid price', 'error');
      return;
    }

    // Same flat price for every selected product; markup% is derived per
    // product from its own cost (for record-keeping) and simply omitted
    // where no cost price is set.
    const updates = ids.map(id => {
      const p = _allProducts.find(x => (x._id || x.id) === id);
      if (!p) return null;
      const markupPct = deriveMarkupPct(flatPrice, p.costPrice, p.shippingCost, inclShip?.checked);
      return { id, price: flatPrice, markupPct };
    }).filter(Boolean);

    const msg = `Set price to £${flatPrice.toFixed(2)} for ${updates.length} product${updates.length !== 1 ? 's' : ''}?`;
    const confirmed = await window.confirmAction?.(msg);
    if (!confirmed) return;

    if (actBtn) { actBtn.disabled = true; actBtn.textContent = 'Applying…'; }

    let successCount = 0;
    try {
      await Promise.all(updates.map(async ({ id, price, markupPct: mu }) => {
        const body = { ids: [id], price, shipIncluded: !!(inclShip?.checked) };
        if (mu != null) body.markupPct = mu;
        const res = await fetch(`${window.API_BASE}/products/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const p = _allProducts.find(x => (x._id || x.id) === id);
        if (p) { p.price = price; p.shipIncluded = !!(inclShip?.checked); if (mu != null) p.markupPct = mu; }
        successCount++;
      }));

      renderProducts();
      refillBulkPanel();
      window.showToast?.(`Updated ${successCount} product${successCount !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      window.showToast?.(err.message || 'Update failed', 'error');
    } finally {
      if (actBtn) { actBtn.disabled = false; actBtn.textContent = 'Apply to selected'; }
    }
    return;
  }

  // ── Markup mode (£ Price button) ─────────────────────────────────────
  if (mode === 'markup') {
    const markupInput = document.getElementById('vp-bulk-markup');
    const inclShip    = document.getElementById('vp-bulk-incl-ship');
    const markupPct   = parseFloat(markupInput?.value);

    if (isNaN(markupPct) || markupPct < 0) {
      window.showToast?.('Enter a valid markup %', 'error');
      return;
    }

    // Calculate per-product prices
    const updates = ids.map(id => {
      const p = _allProducts.find(x => (x._id || x.id) === id);
      if (!p) return null;
      const price = calcRetailPrice(p.costPrice, p.shippingCost, markupPct, inclShip?.checked);
      if (price === null) return null;
      return { id, price, markupPct };
    }).filter(Boolean);

    if (updates.length === 0) {
      window.showToast?.('No products have a cost price set', 'error');
      return;
    }

    const skipped = n - updates.length;
    const shipLabel = inclShip?.checked ? ' + shipping' : '';
    const prices = updates.map(u => u.price);
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const priceStr = minP === maxP ? `£${minP.toFixed(2)}` : `£${minP.toFixed(2)}–£${maxP.toFixed(2)}`;
    const msg = `Apply ${markupPct}%${shipLabel} markup to ${updates.length} product${updates.length !== 1 ? 's' : ''} → ${priceStr}${skipped ? ` (${skipped} skipped — no cost price)` : ''}?`;
    const confirmed = await window.confirmAction?.(msg);
    if (!confirmed) return;

    if (actBtn) { actBtn.disabled = true; actBtn.textContent = 'Applying…'; }

    let successCount = 0;
    try {
      await Promise.all(updates.map(async ({ id, price, markupPct: mu }) => {
        const res = await fetch(`${window.API_BASE}/products/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids: [id], price, shipIncluded: !!(inclShip?.checked), markupPct: mu }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const p = _allProducts.find(x => (x._id || x.id) === id);
        if (p) { p.price = price; p.shipIncluded = !!(inclShip?.checked); p.markupPct = mu; }
        successCount++;
      }));

      renderProducts();
      refillBulkPanel();
      window.showToast?.(`Updated ${successCount} product${successCount !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      window.showToast?.(err.message || 'Update failed', 'error');
    } finally {
      if (actBtn) { actBtn.disabled = false; actBtn.textContent = 'Apply to selected'; }
    }
    return;
  }

  // ── Delivery window mode ────────────────────────────────────────────────
  if (mode === 'delivery') {
    const minInput = document.getElementById('vp-bulk-delivery-min');
    const maxInput = document.getElementById('vp-bulk-delivery-max');
    const minVal   = minInput?.value?.trim();
    const maxVal   = maxInput?.value?.trim();

    if (!minVal && !maxVal) {
      window.showToast?.('Enter a min and/or max delivery days', 'error');
      return;
    }

    const body = { ids };
    if (minVal) {
      const n2 = parseInt(minVal, 10);
      if (isNaN(n2) || n2 < 0) { window.showToast?.('Invalid min delivery days', 'error'); return; }
      body.estDeliveryMinDays = n2;
    }
    if (maxVal) {
      const n2 = parseInt(maxVal, 10);
      if (isNaN(n2) || n2 < 0) { window.showToast?.('Invalid max delivery days', 'error'); return; }
      body.estDeliveryMaxDays = n2;
    }
    if (body.estDeliveryMinDays !== undefined && body.estDeliveryMaxDays !== undefined
      && body.estDeliveryMaxDays < body.estDeliveryMinDays) {
      window.showToast?.('Max delivery days must be greater than or equal to min', 'error');
      return;
    }

    const rangeLabel = minVal && maxVal ? `${minVal}–${maxVal} days`
      : minVal ? `min ${minVal} days`
      : `max ${maxVal} days`;
    const msg = `Set delivery estimate to ${rangeLabel} for ${n} product${n !== 1 ? 's' : ''}?`;
    const confirmed = await window.confirmAction?.(msg);
    if (!confirmed) return;

    if (actBtn) { actBtn.disabled = true; actBtn.textContent = 'Applying…'; }

    try {
      const res = await fetch(`${window.API_BASE}/products/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const updated = data.updated || ids.length;

      _allProducts.forEach(p => {
        const pid = p._id || p.id;
        if (!ids.includes(pid)) return;
        if (body.estDeliveryMinDays !== undefined) p.estDeliveryMinDays = body.estDeliveryMinDays;
        if (body.estDeliveryMaxDays !== undefined) p.estDeliveryMaxDays = body.estDeliveryMaxDays;
      });

      _selected.clear();
      renderProducts();
      updateBulkBar();
      if (panel) { panel.hidden = true; delete panel.dataset.mode; }
      window.showToast?.(`Updated ${updated} product${updated !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      window.showToast?.(err.message || 'Update failed', 'error');
    } finally {
      if (actBtn) { actBtn.disabled = false; actBtn.textContent = 'Apply to selected'; }
    }
    return;
  }

  // ── Shipping scope mode (Ships to) ──────────────────────────────────────
  if (mode === 'shipping-scope') {
    const scopeSelect = document.getElementById('vp-bulk-shipping-scope-select');
    const countriesEl = document.getElementById('vp-bulk-shipping-countries');
    const shippingScope = scopeSelect?.value || 'worldwide';
    const shippingCountries = shippingScope === 'custom'
      ? Array.from(countriesEl?.selectedOptions || []).map(o => o.value)
      : [];

    if (shippingScope === 'custom' && !shippingCountries.length) {
      window.showToast?.('Select at least one country', 'error');
      return;
    }

    const scopeLabels = { worldwide: 'Worldwide', uk: 'UK only', uk_eu: 'UK + Europe', custom: `${shippingCountries.length} selected countries` };
    const msg = `Set "Ships to: ${scopeLabels[shippingScope]}" for ${n} product${n !== 1 ? 's' : ''}?`;
    const confirmed = await window.confirmAction?.(msg);
    if (!confirmed) return;

    if (actBtn) { actBtn.disabled = true; actBtn.textContent = 'Applying…'; }

    try {
      const res = await fetch(`${window.API_BASE}/products/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids, shippingScope, shippingCountries }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const updated = data.updated || ids.length;

      _allProducts.forEach(p => {
        const pid = p._id || p.id;
        if (!ids.includes(pid)) return;
        p.shippingScope = shippingScope;
        p.shippingCountries = shippingCountries;
      });

      _selected.clear();
      renderProducts();
      updateBulkBar();
      if (panel) { panel.hidden = true; delete panel.dataset.mode; }
      window.showToast?.(`Updated ${updated} product${updated !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      window.showToast?.(err.message || 'Update failed', 'error');
    } finally {
      if (actBtn) { actBtn.disabled = false; actBtn.textContent = 'Apply to selected'; }
    }
    return;
  }

  // ── Stock mode ────────────────────────────────────────────────────────
  const input    = document.getElementById('vp-bulk-edit-value');
  const value    = input?.value?.trim();
  if (!value) return;

  const fieldVal = parseInt(value, 10);
  if (isNaN(fieldVal) || fieldVal < 0) {
    window.showToast?.('Invalid stock value', 'error');
    return;
  }

  const msg = `Set stock to ${fieldVal} for ${n} product${n > 1 ? 's' : ''}?`;
  const confirmed = await window.confirmAction?.(msg);
  if (!confirmed) return;

  if (actBtn) { actBtn.disabled = true; actBtn.textContent = 'Applying…'; }

  try {
    const res = await fetch(`${window.API_BASE}/products/bulk`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids, stock: fieldVal }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const updated = data.updated || ids.length;

    _allProducts.forEach(p => {
      const pid = p._id || p.id;
      if (ids.includes(pid)) p.stock = fieldVal;
    });

    _selected.clear();
    renderProducts();
    updateBulkBar();
    if (panel) { panel.hidden = true; delete panel.dataset.mode; }
    window.showToast?.(`Updated ${updated} product${updated !== 1 ? 's' : ''}`);
  } catch (err) {
    console.error(err);
    window.showToast?.(err.message || 'Update failed', 'error');
  } finally {
    if (actBtn) { actBtn.disabled = false; actBtn.textContent = 'Apply to selected'; }
  }
});

/* ── Load ────────────────────────────────────────── */

async function loadVendorProducts() {
  const container = document.getElementById('vendor-products');
  const token = localStorage.getItem('s4l_token');

  if (!container) return;

  if (!token) {
    container.innerHTML = '<p>Not authenticated.</p>';
    return;
  }

  showSkeleton(container);

  try {
    const vendorRes = await fetch(`${window.API_BASE}/vendor/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { vendor } = await vendorRes.json();

    if (!vendor) {
      container.innerHTML = '<p>Create your store first.</p>';
      return;
    }

    if (vendor.status === 'pending') {
      container.innerHTML = `
        <div class="vendor-pending-message">
          <h2>Store Under Review</h2>
          <p>Your store is being reviewed. You'll be able to manage products once approved.</p>
        </div>`;
      return;
    }

    if (vendor.status === 'suspended') {
      container.innerHTML = `
        <div class="vendor-pending-message vendor-suspended-message">
          <h2>Store Suspended</h2>
          <p>Please contact support for assistance.</p>
        </div>`;
      return;
    }

    const res = await fetch(`${window.API_BASE}/vendor/products`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const all  = Array.isArray(data) ? data : [];
    _allProducts = all.filter(p => !p.archived);

    // Merge: localStorage cache + anything the API returns as archived
    const apiArchived  = all.filter(p => p.archived);
    const cached       = _loadArchivedCache();
    const merged       = new Map();
    cached.forEach(p    => merged.set(p._id || p.id, p));
    apiArchived.forEach(p => merged.set(p._id || p.id, p)); // API wins
    // Drop any that came back as non-archived (restored elsewhere)
    const activeIds = new Set(_allProducts.map(p => p._id || p.id));
    _archivedProducts = [...merged.values()].filter(p => !activeIds.has(p._id || p.id));
    _saveArchivedCache();

    document.getElementById('vp-toolbar')?.removeAttribute('hidden');
    bindToolbar();

    renderProducts();
  } catch (err) {
    console.error('Vendor products load error:', err);
    container.innerHTML = `
      <div class="vp-empty">
        <p>Could not load products.</p>
        <button class="btn-retry" onclick="loadVendorProducts()">Try again</button>
      </div>`;
  }
}

/* ── Recover archived product by ID ─────────────── */

document.addEventListener('click', async (e) => {
  if (e.target.id !== 'vp-recover-btn') return;
  const input = document.getElementById('vp-recover-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;

  // Accept full URL (…?id=XXX) or bare ID
  let id = raw;
  try {
    const u = raw.includes('?') ? new URL(raw, location.origin) : null;
    if (u) id = u.searchParams.get('id') || raw;
  } catch {}

  const token = localStorage.getItem('s4l_token');
  if (!token) { window.showToast?.('Not authenticated', 'error'); return; }

  const btn = e.target;
  btn.disabled = true; btn.textContent = 'Fetching…';

  try {
    const res = await fetch(`${window.API_BASE}/vendor/products/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Not found');
    const product = await res.json();

    if (!product.archived) {
      window.showToast?.('That product is not archived', 'error');
      btn.disabled = false; btn.textContent = 'Recover';
      return;
    }

    // Check not already in list
    if (!_archivedProducts.find(p => (p._id || p.id) === id)) {
      _archivedProducts.push(product);
      _saveArchivedCache();
    }
    renderProducts();
    window.showToast?.('Product recovered');
  } catch {
    window.showToast?.('Product not found', 'error');
    btn.disabled = false; btn.textContent = 'Recover';
  }
});

/* ── Duplicate ───────────────────────────────────── */

document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-duplicate')) return;
  const btn = e.target;
  const id  = btn.dataset.id;
  const token = localStorage.getItem('s4l_token');
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const res = await fetch(`${API_BASE}/products/${id}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Duplicate failed', 'error'); return; }
    // Navigate to edit the new copy immediately
    window.location.href = `/account/vendor/edit-product.html?id=${data.product._id}`;
  } catch {
    showToast('Server error — please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Copy';
  }
});

/* ── Archive ─────────────────────────────────────── */

document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-archive')) return;

  const button = e.target;
  const id = button.dataset.id;
  const token = localStorage.getItem('s4l_token');

  if (!token) { window.showToast?.('Not authenticated', 'error'); return; }

  const confirmed = await window.confirmAction?.('Archive this product? It will be hidden from buyers.');
  if (!confirmed) return;

  try {
    button.disabled = true;
    button.textContent = 'Archiving…';

    const res = await fetch(`${window.API_BASE}/products/${id}/archive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('Archive failed');

    const product = _allProducts.find(p => (p._id || p.id) === id);
    if (product) { product.archived = true; _archivedProducts.push(product); }
    _allProducts = _allProducts.filter(p => (p._id || p.id) !== id);
    _saveArchivedCache();
    renderProducts();
    window.showToast?.('Product archived');
  } catch (err) {
    console.error(err);
    button.disabled = false;
    button.textContent = 'Archive';
    window.showToast?.('Archive failed', 'error');
  }
});

/* ── Unarchive ───────────────────────────────────── */

document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-unarchive')) return;

  const button = e.target;
  const id = button.dataset.id;
  const token = localStorage.getItem('s4l_token');

  if (!token) { window.showToast?.('Not authenticated', 'error'); return; }

  const confirmed = await window.confirmAction?.('Restore this product? It will be active and visible to buyers again.');
  if (!confirmed) return;

  try {
    button.disabled = true;
    button.textContent = 'Restoring…';

    const res = await fetch(`${window.API_BASE}/products/${id}/unarchive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('Unarchive failed');

    const restored = _archivedProducts.find(p => (p._id || p.id) === id);
    _archivedProducts = _archivedProducts.filter(p => (p._id || p.id) !== id);
    if (restored) {
      restored.archived = false;
      _allProducts.push(restored);
    }
    _saveArchivedCache();
    renderProducts();
    window.showToast?.('Product restored');
  } catch (err) {
    console.error(err);
    button.disabled = false;
    button.textContent = 'Unarchive';
    window.showToast?.('Restore failed', 'error');
  }
});

/* ── Delete ──────────────────────────────────────── */

document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-delete')) return;

  const button = e.target;
  const id = button.dataset.id;
  const token = localStorage.getItem('s4l_token');

  if (!token) { window.showToast?.('Not authenticated', 'error'); return; }

  const confirmed = await window.confirmAction?.('Move this product to Trash? You can restore it later from the Trash tab.');
  if (!confirmed) return;

  try {
    button.disabled = true;
    button.textContent = 'Deleting…';

    const res = await fetch(`${window.API_BASE}/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');

    _allProducts = _allProducts.filter(p => (p._id || p.id) !== id);
    renderProducts();
    window.showToast?.('Moved to Trash');
  } catch (err) {
    console.error(err);
    button.disabled = false;
    button.textContent = 'Delete';
    window.showToast?.(err.message || 'Delete failed', 'error');
  }
});

/* ── Coming Soon toggle ──────────────────────────── */

document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('btn-coming-soon-toggle')) return;

  const btn   = e.target;
  const id    = btn.dataset.id;
  const token = localStorage.getItem('s4l_token');
  if (!token) return;

  const product = _allProducts.find(p => (p._id || p.id) === id);
  if (!product) return;

  const newVal = !product.comingSoon;

  btn.disabled = true;
  btn.textContent = '…';

  try {
    const res = await fetch(`${window.API_BASE}/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ comingSoon: newVal }),
    });

    if (!res.ok) throw new Error('Failed');

    product.comingSoon = newVal;
    renderProducts();
    window.showToast?.(newVal ? 'Coming Soon enabled' : 'Product unblocked');
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.innerHTML = window.s4lIcon ? window.s4lIcon('clock') : '';
    window.showToast?.('Update failed', 'error');
  }
});

/* ── CSV Import ──────────────────────────────────── */

function showCsvResult(created, updated, skipped, skippedDetails) {
  const existing = document.getElementById('csv-result-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'csv-result-banner';

  const total = created + updated;
  if (skipped === 0 && total > 0) {
    banner.className = 'csv-result success';
    const parts = [];
    if (created) parts.push(`${created} new`);
    if (updated) parts.push(`${updated} updated`);
    banner.textContent = `${parts.join(', ')} product${total !== 1 ? 's' : ''} imported.`;
  } else if (total === 0) {
    banner.className = 'csv-result error';
    banner.textContent = `Import failed — ${skipped} row${skipped !== 1 ? 's' : ''} had errors. Check your CSV and try again.`;
  } else {
    banner.className = 'csv-result partial';
    const parts = [];
    if (created) parts.push(`${created} new`);
    if (updated) parts.push(`${updated} updated`);
    banner.textContent = `${parts.join(', ')} imported, ${skipped} skipped.`;
  }

  // Group skip reasons so "147 skipped" doesn't just dump 147 row numbers —
  // shows what actually went wrong and how many rows hit each cause.
  if (skippedDetails?.length) {
    const byReason = {};
    skippedDetails.forEach(({ row, reason }) => {
      (byReason[reason || 'Unknown error'] = byReason[reason || 'Unknown error'] || []).push(row);
    });
    const detail = document.createElement('div');
    detail.style.cssText = 'font-size:12px;margin-top:6px;font-weight:400';
    detail.innerHTML = Object.entries(byReason)
      .map(([reason, rows]) => `${rows.length}× ${reason} (rows: ${rows.slice(0, 10).join(', ')}${rows.length > 10 ? '…' : ''})`)
      .join('<br>');
    banner.appendChild(detail);
  }

  const header = document.querySelector('.vp-page-header');
  header?.insertAdjacentElement('afterend', banner);
  // Skip/error banners stay up until the next import — they carry
  // information worth reading, unlike a plain success confirmation.
  if (skipped === 0 && total > 0) setTimeout(() => banner.remove(), 8000);
}

function downloadCsvTemplate() {
  const header = 'name,price,comparePrice,shippingCost,stock,category,subcategory,sku,description,image1,image2';
  const example = 'Example Product,19.99,24.99,2.99,100,electronics,mobile,SKU001,Product description here,https://example.com/image1.jpg,';
  const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sell4life-import-template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

const csvBtn   = document.getElementById('btn-import-csv');
const csvInput = document.getElementById('csv-file-input');

if (csvBtn && csvInput) {
  csvBtn.addEventListener('click', () => csvInput.click());

  csvInput.addEventListener('change', async () => {
    const file = csvInput.files?.[0];
    if (!file) return;

    // This button always runs a FULL import (price/stock/shipping cost
    // overwritten on every matched product) — it has no origin-only
    // option, unlike the Tools page's "Import to Products" flow. A
    // confirmation here is the only thing standing between a vendor and
    // accidentally re-flattening their pricing with this quieter path.
    const proceed = await window.s4lConfirm(
      'This will overwrite price, stock, and shipping cost on any matching products.\n\n' +
      'If you only want to update the shipping warehouse without touching pricing, ' +
      'cancel this and use Tools → CSV Converter → "Update shipping origin only" instead.\n\n' +
      'Continue with a full import?'
    );
    if (!proceed) { csvInput.value = ''; return; }

    csvBtn.textContent = 'Importing...';
    csvBtn.disabled = true;

    try {
      const text = await file.text();
      const token = localStorage.getItem('s4l_token');

      const res = await fetch(`${window.API_BASE}/vendor/products/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
          Authorization: `Bearer ${token}`,
        },
        body: text,
      });

      const data = await res.json();

      if (!res.ok) {
        showCsvResult(0, 0, 1, [{ row: '—', reason: data.error || 'Unknown error' }]);
      } else {
        showCsvResult(data.created, data.updated ?? 0, data.skipped, data.skippedDetails || []);
        if (data.created > 0 || data.updated > 0) await loadVendorProducts();
      }
    } catch (err) {
      console.error('CSV import error:', err);
      showCsvResult(0, 0, 1, [{ row: '—', reason: 'Network error' }]);
    } finally {
      csvBtn.textContent = '↑ Import CSV';
      csvBtn.disabled = false;
      csvInput.value = '';
    }
  });
}

/* ── Auto-import from Tools page ─────────────────── */

async function runPendingCsvImport() {
  const csv = sessionStorage.getItem('s4l_pending_csv');
  if (!csv) return;
  sessionStorage.removeItem('s4l_pending_csv');
  // Set by the "Update shipping origin only" checkbox on the Tools page —
  // tells the backend to only $set shippingOriginCountry on matched
  // products, never price/stock/shippingCost, and never create new ones.
  const originOnly = sessionStorage.getItem('s4l_pending_csv_origin_only') === '1';
  sessionStorage.removeItem('s4l_pending_csv_origin_only');

  if (csvBtn) { csvBtn.textContent = 'Importing...'; csvBtn.disabled = true; }

  try {
    const token = localStorage.getItem('s4l_token');
    const res = await fetch(`${window.API_BASE}/vendor/products/import${originOnly ? '?originOnly=1' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv', Authorization: `Bearer ${token}` },
      body: csv,
    });
    const data = await res.json();
    if (!res.ok) {
      showCsvResult(0, 0, 1, [{ row: '—', reason: data.error || 'Unknown error' }]);
    } else {
      showCsvResult(data.created, data.updated ?? 0, data.skipped, data.skippedDetails || []);
      if (data.created > 0 || data.updated > 0) await loadVendorProducts();
    }
  } catch (err) {
    console.error('CSV import error:', err);
    showCsvResult(0, 0, 1, [{ row: '—', reason: 'Network error' }]);
  } finally {
    if (csvBtn) { csvBtn.textContent = '↑ Import CSV'; csvBtn.disabled = false; }
  }
}

/* ── Bulk CJ Image Fetch ─────────────────────────── */

(function initBulkCjImages() {
  const btn     = document.getElementById('btn-bulk-cj-images');
  const overlay = document.getElementById('cj-bulk-overlay');
  const title   = document.getElementById('cj-bulk-title');
  const bar     = document.getElementById('cj-bulk-bar');
  const status  = document.getElementById('cj-bulk-status');
  const counts  = document.getElementById('cj-bulk-counts');
  if (!btn || !overlay) return;

  // Professional+ vendors with CJ credentials only — hidden for everyone else
  btn.hidden = true;
  if (!_isPro) return;
  (async () => {
    try {
      const token = localStorage.getItem('s4l_token');
      const res   = await fetch(`${window.API_BASE}/vendor/supplier/providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : null;
      const cj   = data?.providers?.find(p => p.providerName === 'cjdropshipping');
      if (cj?.configured) {
        btn.hidden   = false;
        btn.disabled = _selected.size === 0;
        btn.title    = _selected.size === 0 ? 'Select products first, then sync them from CJ' : '';
        // Companion button in the sticky selection bar — same action, always in
        // view while selecting (no scrolling back to the page header).
        const bulkBtn = document.getElementById('btn-bulk-cj-sync');
        if (bulkBtn) {
          bulkBtn.hidden = false;
          bulkBtn.addEventListener('click', () => btn.click());
        }

        const shipBtn = document.getElementById('btn-check-uk-shipping');
        if (shipBtn) shipBtn.hidden = false;
      }
    } catch (_) { /* leave hidden */ }
  })();

  btn.addEventListener('click', async () => {
    const token = localStorage.getItem('s4l_token');
    if (!token) return;
    if (_selected.size === 0) return; // selection required — button should be disabled anyway

    btn.disabled = true;
    if (title) title.textContent = 'Syncing from CJ';
    overlay.classList.add('active');
    bar.style.width = '0%';
    status.textContent = 'Starting…';
    counts.textContent = '';

    let total = 0, updated = 0, failed = 0, skipped = 0;
    let imgTotal = 0, vidTotal = 0, varTotal = 0, shipCount = 0;
    const failedNames = [];
    const selectedIds = Array.from(_selected);

    // Cancel support — aborting the fetch closes the stream; the backend
    // notices the disconnect and stops processing remaining products.
    const cancelBtn   = document.getElementById('cj-bulk-cancel');
    const controller  = new AbortController();
    let cancelled     = false;
    if (cancelBtn) {
      cancelBtn.hidden   = false;
      cancelBtn.disabled = false;
      cancelBtn.onclick  = () => {
        cancelled = true;
        cancelBtn.disabled = true;
        controller.abort();
      };
    }

    try {
      const res = await fetch(`${window.API_BASE}/vendor/products/bulk-fetch-cj-images`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedIds.length ? { ids: selectedIds } : {}),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        status.textContent = err.error || 'Request failed';
        return;
      }

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          let msg;
          try { msg = JSON.parse(line); } catch (_) { continue; }

          if (msg.type === 'start') {
            total = msg.total;
            status.textContent = total === 0
              ? (selectedIds.length ? 'No CJ products in your selection.' : 'No CJ products found.')
              : `Syncing ${total}${selectedIds.length ? ' selected' : ''} product${total === 1 ? '' : 's'}…`;

          } else if (msg.type === 'progress') {
            const pct = total > 0 ? Math.round((msg.n / total) * 100) : 0;
            bar.style.width = pct + '%';
            const extras = msg.status === 'updated'
              ? [msg.count + ' images', msg.videos ? msg.videos + ' video' : '', msg.variantsSynced ? msg.variantsSynced + ' variants synced' : '', msg.shipping != null ? '£' + msg.shipping + ' shipping' : ''].filter(Boolean).join(', ')
              : '';
            const label = msg.status === 'fetching'  ? `Fetching: ${msg.name}…`
                        : msg.status === 'updated'   ? `${msg.name} (${extras})`
                        : msg.status === 'failed'    ? `No images: ${msg.name}`
                        : `Skipped: ${msg.name}`;
            status.textContent = `[${msg.n}/${total}] ${label}`;
            if (msg.status === 'updated') {
              updated++;
              imgTotal += msg.count          || 0;
              vidTotal += msg.videos         || 0;
              varTotal += msg.variantsSynced || 0;
              if (msg.shipping != null) shipCount++;
            }
            if (msg.status === 'failed')  { failed++; failedNames.push(msg.name); }
            if (msg.status === 'skipped')  skipped++;
            counts.innerHTML = `Updated: ${updated}  Failed: ${failed}  Skipped: ${skipped}   |   <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.3"/></svg> ${imgTotal} images · <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg> ${vidTotal} videos · <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3a9 8 0 100 16c1.5 0 1.8-1.5.9-2.3-.8-.7-.3-2.2 1-2.2h2A4 4 0 0020 10c0-4-3.6-7-8-7z"/><circle cx="8" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="11" cy="7.3" r=".9" fill="currentColor" stroke="none"/><circle cx="15.2" cy="8.5" r=".9" fill="currentColor" stroke="none"/></svg> ${varTotal} variant images · <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><rect x="2" y="8" width="12" height="8" rx="1"/><path d="M14 11h4l3 3v2h-7z"/><circle cx="6.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/></svg> ${shipCount} shipping quotes`;

          } else if (msg.type === 'done') {
            bar.style.width = '100%';
            status.innerHTML = `Done — ${msg.updated} updated, ${msg.failed} failed, ${msg.skipped} skipped   ·   <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.3"/></svg> ${imgTotal} images · <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg> ${vidTotal} videos · <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3a9 8 0 100 16c1.5 0 1.8-1.5.9-2.3-.8-.7-.3-2.2 1-2.2h2A4 4 0 0020 10c0-4-3.6-7-8-7z"/><circle cx="8" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="11" cy="7.3" r=".9" fill="currentColor" stroke="none"/><circle cx="15.2" cy="8.5" r=".9" fill="currentColor" stroke="none"/></svg> ${varTotal} variant images · <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><rect x="2" y="8" width="12" height="8" rx="1"/><path d="M14 11h4l3 3v2h-7z"/><circle cx="6.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/></svg> ${shipCount} shipping`;
            // Why videos/variant-price-sync/category stayed at 0 across the
            // run, if they did — see browser console for the breakdown.
            if (msg.debug) console.log('[bulk-cj-sync] debug summary:', msg.debug);
            counts.textContent = failedNames.length
              ? 'No CJ match: ' + failedNames.join(' · ')
              : '';
            _selected.clear();
            if (msg.updated > 0) await loadVendorProducts(); else renderProducts();
            updateBulkBar();

          } else if (msg.type === 'error') {
            status.textContent = `Error: ${msg.message}`;
          }
        }
      }
    } catch (err) {
      if (cancelled) {
        status.textContent = `Stopped — ${updated} product${updated !== 1 ? 's' : ''} synced before cancelling`;
        counts.innerHTML = `<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.3"/></svg> ${imgTotal} images · <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg> ${vidTotal} videos · <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3a9 8 0 100 16c1.5 0 1.8-1.5.9-2.3-.8-.7-.3-2.2 1-2.2h2A4 4 0 0020 10c0-4-3.6-7-8-7z"/><circle cx="8" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="11" cy="7.3" r=".9" fill="currentColor" stroke="none"/><circle cx="15.2" cy="8.5" r=".9" fill="currentColor" stroke="none"/></svg> ${varTotal} variant images`;
        if (updated > 0) await loadVendorProducts();
      } else {
        status.textContent = `Network error: ${err.message}`;
      }
    } finally {
      if (cancelBtn) { cancelBtn.hidden = true; cancelBtn.onclick = null; }
      btn.disabled = false;
      // Keep overlay visible so user can read final result; click anywhere to dismiss
      overlay.addEventListener('click', function dismiss(e) {
        if (e.target === overlay) {
          overlay.classList.remove('active');
          overlay.removeEventListener('click', dismiss);
        }
      }, { once: false });
    }
  });
}());

/* ── Bulk Force Re-match Category ───────────────────
   Same endpoint/overlay as bulk CJ sync, with forceCategory:true — unlike a
   routine sync, this OVERWRITES category/subcategory on every selected
   product regardless of what's already set. Explicit, selection-scoped,
   never triggered automatically. */

(function initBulkRematchCategory() {
  // Purely internal — reads each product's own title, no CJ credentials
  // or CJ link required, no external API call. Available to every vendor
  // tier, unlike the CJ-specific bulk actions above.
  const btn     = document.getElementById('btn-bulk-rematch-category');
  const overlay = document.getElementById('cj-bulk-overlay');
  const title   = document.getElementById('cj-bulk-title');
  const bar     = document.getElementById('cj-bulk-bar');
  const status  = document.getElementById('cj-bulk-status');
  const counts  = document.getElementById('cj-bulk-counts');
  if (!btn || !overlay) return;

  btn.hidden   = false;
  btn.disabled = _selected.size === 0;
  btn.title    = _selected.size === 0 ? 'Select products first, then re-match their category' : '';
  const bulkBtn = document.getElementById('btn-bulk-rematch-sync');
  if (bulkBtn) {
    bulkBtn.hidden = false;
    bulkBtn.addEventListener('click', () => btn.click());
  }

  btn.addEventListener('click', async () => {
    const token = localStorage.getItem('s4l_token');
    if (!token) return;
    if (_selected.size === 0) return;
    if (!(await window.s4lConfirm(`Re-derive category/subcategory for ${_selected.size} selected product${_selected.size !== 1 ? 's' : ''} and OVERWRITE what's set now? This cannot be undone.`))) return;

    btn.disabled = true;
    if (title) title.textContent = 'Re-matching Category (AI)';
    overlay.classList.add('active');
    bar.style.width = '0%';
    status.textContent = 'Starting…';
    counts.textContent = '';

    let total = 0, updated = 0, failed = 0, skipped = 0;
    const changes = [];
    const selectedIds = Array.from(_selected);

    const cancelBtn  = document.getElementById('cj-bulk-cancel');
    const controller = new AbortController();
    let cancelled    = false;
    if (cancelBtn) {
      cancelBtn.hidden   = false;
      cancelBtn.disabled = false;
      cancelBtn.onclick  = () => {
        cancelled = true;
        cancelBtn.disabled = true;
        controller.abort();
      };
    }

    try {
      const res = await fetch(`${window.API_BASE}/vendor/products/bulk-rematch-category`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        status.textContent = err.error || 'Request failed';
        return;
      }

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          let msg;
          try { msg = JSON.parse(line); } catch (_) { continue; }

          if (msg.type === 'start') {
            total = msg.total;
            status.textContent = total === 0 ? 'No products in your selection.' : `Re-matching ${total} product${total === 1 ? '' : 's'}…`;

          } else if (msg.type === 'progress') {
            const pct = total > 0 ? Math.round((msg.n / total) * 100) : 0;
            bar.style.width = pct + '%';
            const label = msg.status === 'fetching' ? `Checking: ${msg.name}…`
                        : msg.status === 'updated'  ? `${msg.name} → ${msg.category || '—'}${msg.subcategory ? ' / ' + msg.subcategory : ''}`
                        : msg.status === 'failed'   ? `No confident title match: ${msg.name}`
                        : `Skipped: ${msg.name}`;
            status.textContent = `[${msg.n}/${total}] ${label}`;
            if (msg.status === 'updated') {
              updated++;
              if (msg.category) changes.push(`${msg.name} → ${msg.category}${msg.subcategory ? '/' + msg.subcategory : ''}`);
            }
            if (msg.status === 'failed')  failed++;
            if (msg.status === 'skipped') skipped++;
            counts.textContent = `Updated: ${updated}  Failed: ${failed}  Skipped: ${skipped}`;

          } else if (msg.type === 'done') {
            bar.style.width = '100%';
            status.textContent = `Done — ${msg.updated} updated, ${msg.failed} failed, ${msg.skipped} skipped`;
            counts.innerHTML = changes.length ? changes.map(c => c.replace(/</g, '&lt;')).join('<br>') : '';
            _selected.clear();
            if (msg.updated > 0) await loadVendorProducts(); else renderProducts();
            updateBulkBar();

          } else if (msg.type === 'error') {
            status.textContent = `Error: ${msg.message}`;
          }
        }
      }
    } catch (err) {
      if (cancelled) {
        status.textContent = `Stopped — ${updated} product${updated !== 1 ? 's' : ''} re-matched before cancelling`;
        if (updated > 0) await loadVendorProducts();
      } else {
        status.textContent = `Network error: ${err.message}`;
      }
    } finally {
      if (cancelBtn) { cancelBtn.hidden = true; cancelBtn.onclick = null; }
      btn.disabled = false;
      overlay.addEventListener('click', function dismiss(e) {
        if (e.target === overlay) {
          overlay.classList.remove('active');
          overlay.removeEventListener('click', dismiss);
        }
      }, { once: false });
    }
  });
}());

/* ── Bulk AI-generate listing (title/descriptions/bullets/category from photos) ── */

(function initBulkGenerateListing() {
  // Same "purely internal, any tier" scope as bulk re-match category above —
  // reads each product's own stored title/description/images, no CJ
  // credentials required.
  const btn     = document.getElementById('btn-bulk-generate-listing');
  const overlay = document.getElementById('cj-bulk-overlay');
  const title   = document.getElementById('cj-bulk-title');
  const bar     = document.getElementById('cj-bulk-bar');
  const status  = document.getElementById('cj-bulk-status');
  const counts  = document.getElementById('cj-bulk-counts');
  if (!btn || !overlay) return;

  btn.hidden   = false;
  btn.disabled = _selected.size === 0;
  btn.title    = _selected.size === 0 ? 'Select products first, then generate their listing with AI' : '';
  const bulkBtn = document.getElementById('btn-bulk-generate-listing-sync');
  if (bulkBtn) {
    bulkBtn.hidden = false;
    bulkBtn.addEventListener('click', () => btn.click());
  }

  btn.addEventListener('click', async () => {
    const token = localStorage.getItem('s4l_token');
    if (!token) return;
    if (_selected.size === 0) return;

    const selectedIds = Array.from(_selected);
    const activeCount = _allProducts.filter(p => _selected.has(p._id || p.id) && p.active).length;
    const activeWarning = activeCount > 0 ? ` (${activeCount} of which ${activeCount === 1 ? 'is' : 'are'} already live)` : '';
    if (!(await window.s4lConfirm(`Use AI to write title, descriptions, bullet points and category for ${selectedIds.length} selected product${selectedIds.length !== 1 ? 's' : ''}${activeWarning} and OVERWRITE what's set now? This cannot be undone.`))) return;

    btn.disabled = true;
    if (title) title.textContent = 'Generating Listing (AI)';
    overlay.classList.add('active');
    bar.style.width = '0%';
    status.textContent = 'Starting…';
    counts.textContent = '';

    let total = 0, updated = 0, failed = 0, skipped = 0;
    const changes = [];

    const cancelBtn  = document.getElementById('cj-bulk-cancel');
    const controller = new AbortController();
    let cancelled    = false;
    if (cancelBtn) {
      cancelBtn.hidden   = false;
      cancelBtn.disabled = false;
      cancelBtn.onclick  = () => {
        cancelled = true;
        cancelBtn.disabled = true;
        controller.abort();
      };
    }

    try {
      const res = await fetch(`${window.API_BASE}/vendor/products/bulk-generate-listing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        status.textContent = err.error || 'Request failed';
        return;
      }

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          let msg;
          try { msg = JSON.parse(line); } catch (_) { continue; }

          if (msg.type === 'start') {
            total = msg.total;
            status.textContent = total === 0 ? 'No products in your selection.' : `Generating listings for ${total} product${total === 1 ? '' : 's'}…`;

          } else if (msg.type === 'progress') {
            const pct = total > 0 ? Math.round((msg.n / total) * 100) : 0;
            bar.style.width = pct + '%';
            const label = msg.status === 'fetching' ? `Writing: ${msg.name}…`
                        : msg.status === 'updated'  ? `${msg.name} → ${msg.category || '—'}${msg.subcategory ? ' / ' + msg.subcategory : ''}`
                        : msg.status === 'failed'   ? `Failed: ${msg.name} — ${msg.reason || 'unknown error'}`
                        : `Skipped: ${msg.name}`;
            status.textContent = `[${msg.n}/${total}] ${label}`;
            if (msg.status === 'updated') {
              updated++;
              changes.push({ text: `${msg.name}`, failed: false });
            }
            if (msg.status === 'failed') {
              failed++;
              // Reason only ever lived in this one progress message — without
              // recording it here it's gone the moment the next message
              // overwrites status.textContent, leaving the final summary
              // saying "8 failed" with no way to see why any of them did.
              changes.push({ text: `${msg.name} — ${msg.reason || 'unknown error'}`, failed: true });
            }
            if (msg.status === 'skipped') skipped++;
            counts.textContent = `Updated: ${updated}  Failed: ${failed}  Skipped: ${skipped}`;

          } else if (msg.type === 'done') {
            bar.style.width = '100%';
            status.textContent = `Done — ${msg.updated} updated, ${msg.failed} failed, ${msg.skipped} skipped`;
            counts.innerHTML = changes.length
              ? changes.map(c => `<span style="color:${c.failed ? '#b91c1c' : 'inherit'}">${c.text.replace(/</g, '&lt;')}</span>`).join('<br>')
              : '';
            _selected.clear();
            if (msg.updated > 0) await loadVendorProducts(); else renderProducts();
            updateBulkBar();

          } else if (msg.type === 'error') {
            status.textContent = `Error: ${msg.message}`;
          }
        }
      }
    } catch (err) {
      if (cancelled) {
        status.textContent = `Stopped — ${updated} listing${updated !== 1 ? 's' : ''} generated before cancelling`;
        if (updated > 0) await loadVendorProducts();
      } else {
        status.textContent = `Network error: ${err.message}`;
      }
    } finally {
      if (cancelBtn) { cancelBtn.hidden = true; cancelBtn.onclick = null; }
      btn.disabled = false;
      overlay.addEventListener('click', function dismiss(e) {
        if (e.target === overlay) {
          overlay.classList.remove('active');
          overlay.removeEventListener('click', dismiss);
        }
      }, { once: false });
    }
  });
}());

/* ── Check UK shipping now (on-demand, one vendor) ── */

(function initCheckUkShipping() {
  const btn = document.getElementById('btn-check-uk-shipping');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const token = localStorage.getItem('s4l_token');
    if (!token) return;

    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '⏳ Checking…';

    try {
      const res = await fetch(`${window.API_BASE}/vendor/products/check-cj-shipping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        window.showToast?.(data.error || 'Check failed', 'error');
        return;
      }

      if (data.authFailed > 0 || data.apiDisabled > 0) {
        window.showToast?.('CJ connection problem — check Store Settings → Connect Supplier', 'error');
      } else if (data.unavailable > 0) {
        window.showToast?.(`${data.unavailable} product${data.unavailable !== 1 ? 's have' : ' has'} no UK shipping route`);
      } else if (data.productsChecked === 0) {
        window.showToast?.('No CJ-synced products to check');
      } else {
        window.showToast?.(`All ${data.available} checked product${data.available !== 1 ? 's' : ''} ship to the UK`);
      }

      await loadVendorProducts();
    } catch (err) {
      window.showToast?.('Network error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}());

/* ── Margin hover panel ─────────────────────────────
   Semi-transparent panel shown on hover over a product card — surfaces the
   private numbers the card itself doesn't show (shipping cost, cost price,
   true cost, and estimated profit before/after platform + Stripe fees). One
   shared panel, repositioned per hover rather than one per card. */

let _feeRate = null; // { commissionRate, stripePct, stripeFixed } — fetched once

(async function loadFeeRate() {
  try {
    const token = localStorage.getItem('s4l_token');
    const res = await fetch(`${window.API_BASE}/vendor/fee-rate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) _feeRate = await res.json();
  } catch (_) { /* panel falls back to platform-default estimate below */ }
})();

function findProductById(id) {
  return _allProducts.find(p => (p._id || p.id) === id)
    || _archivedProducts.find(p => (p._id || p.id) === id)
    || _trashedProducts.find(p => (p._id || p.id) === id)
    || null;
}

let _marginPanel = null;
function ensureMarginPanel() {
  if (_marginPanel) return _marginPanel;
  _marginPanel = document.createElement('div');
  _marginPanel.className = 'vp-margin-panel';
  document.body.appendChild(_marginPanel);
  return _marginPanel;
}

function marginPanelHTML(p) {
  const fmt = (n) => fmtSigned(n, p);
  const price = Number(p.price) || 0;
  const cost = Number(p.costPrice) || 0;
  const ship = Number(p.shippingCost) || 0;
  const trueCost = cost + ship;
  // What the buyer actually pays in total — shipping is only a separate
  // checkout line when it's NOT baked into the price.
  const buyerPays = p.shipIncluded ? price : price + ship;
  const rate = _feeRate || { commissionRate: 0.08, stripePct: 0.014, stripeFixed: 0.20 };
  const fees = buyerPays * (rate.commissionRate + rate.stripePct) + rate.stripeFixed;
  const profitBefore = buyerPays - trueCost;
  const profitAfter = profitBefore - fees;
  // Margin% (profit / what buyer pays) vs Markup% (profit / true cost) are
  // different numbers people mix up — show both, since "Markup" is the one
  // the vendor actually types into the "Calculate retail price" tool.
  const marginPct = buyerPays > 0 ? (profitAfter / buyerPays) * 100 : 0;
  const markupPct = trueCost > 0 ? (profitBefore / trueCost) * 100 : 0;
  const sku = (p.variants || []).map(v => v.sku).find(Boolean);
  // Casual/refurbished listings (a used item sold once) often skip Cost
  // Price entirely — it's optional everywhere. Label it honestly rather
  // than implying the full sale price is pure profit when nothing was
  // actually entered.
  const costTracked = cost > 0;
  const profitLabel = costTracked ? 'Profit' : 'Revenue';

  return `
    <div class="vp-margin-row"><span>Price</span><b>${fmt(price)}</b></div>
    ${p.comparePrice ? `<div class="vp-margin-row"><span>Compare price</span><b>${fmt(p.comparePrice)}</b></div>` : ''}
    <div class="vp-margin-row"><span>Shipping</span><b>${fmt(ship)} ${p.shipIncluded ? '(incl.)' : '(separate)'}</b></div>
    <div class="vp-margin-row"><span>Cost price</span><b>${costTracked ? fmt(cost) : '— not set'}</b></div>
    ${costTracked ? `<div class="vp-margin-row"><span>True cost</span><b>${fmt(trueCost)}</b></div>` : ''}
    ${costTracked ? `<div class="vp-margin-row"><span>Markup</span><b class="${markupPct < 0 ? 'vp-margin-neg' : ''}">${markupPct.toFixed(1)}%</b></div>` : ''}
    <div class="vp-margin-divider"></div>
    <div class="vp-margin-row"><span>Buyer pays</span><b>${fmt(buyerPays)}</b></div>
    <div class="vp-margin-row"><span>${profitLabel} before fees</span><b>${fmt(profitBefore)}</b></div>
    ${rate.foundingSeller?.active
      ? `<div class="vp-margin-row"><span>Est. fees</span><b>${fmt(-fees)} <span style="color:#fbbf24">(<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="8" r="5"/><path d="M9 12.5L7 21l5-3 5 3-2-8.5"/></svg> ${(rate.commissionRate * 100).toFixed(1)}% founding rate)</span></b></div>`
      : `<div class="vp-margin-row"><span>Est. fees (${(rate.commissionRate * 100).toFixed(1)}%+${(rate.stripePct * 100).toFixed(1)}%+£${rate.stripeFixed.toFixed(2)})</span><b>${fmt(-fees)}</b></div>`}
    <div class="vp-margin-row vp-margin-total"><span>${profitLabel} after fees</span><b class="${profitAfter < 0 ? 'vp-margin-neg' : ''}">${fmt(profitAfter)}</b></div>
    <div class="vp-margin-row"><span>Margin</span><b class="${marginPct < 0 ? 'vp-margin-neg' : ''}">${marginPct.toFixed(1)}%</b></div>
    <div class="vp-margin-divider"></div>
    ${p.supplier ? `<div class="vp-margin-row"><span>Supplier</span><b>${p.supplier}</b></div>` : ''}
    ${p.shippingOriginCountry ? `<div class="vp-margin-row"><span>Ships from</span><b>${shipsFromLabel(p.shippingOriginCountry)}</b></div>` : ''}
    ${sku ? `<div class="vp-margin-row"><span>SKU</span><b>${sku}</b></div>` : ''}
    <div class="vp-margin-row"><span>Stock</span><b>${p.stock ?? '—'}</b></div>
  `;
}

// Friendly name for a shippingOriginCountry ISO code — falls back to the
// raw code itself for anything not in this short common-warehouse list,
// rather than needing the full S4L_COUNTRIES table just for this.
function shipsFromLabel(code) {
  const names = { CN: 'China', US: 'United States', GB: 'United Kingdom', DE: 'Germany' };
  return names[code] || code;
}

function positionMarginPanel(panel, card) {
  const rect = card.getBoundingClientRect();
  const pw = 224;
  const gap = 10;
  const ph = panel.offsetHeight || 200;

  // Prefer sitting beside the card (right if there's room, else left) so it
  // never covers the thumbnail/title underneath — only falls back to
  // sitting above the card when neither side has enough room.
  const spaceRight = window.innerWidth - rect.right;
  const spaceLeft = rect.left;

  let left, top;
  if (spaceRight >= pw + gap + 8) {
    left = rect.right + gap;
    top = rect.top;
  } else if (spaceLeft >= pw + gap + 8) {
    left = rect.left - pw - gap;
    top = rect.top;
  } else {
    left = rect.left + rect.width / 2 - pw / 2;
    top = rect.top - ph - gap;
  }

  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

let _marginHoverCard = null;

document.addEventListener('mouseover', (e) => {
  const card = e.target.closest('.vendor-product-card, .vp-list-row');
  if (!card || card === _marginHoverCard) return;
  const id = card.dataset.id;
  const p = id && findProductById(id);
  if (!p) return;

  _marginHoverCard = card;
  const panel = ensureMarginPanel();
  panel.innerHTML = marginPanelHTML(p);
  positionMarginPanel(panel, card);
  panel.classList.add('show');
});

document.addEventListener('mouseout', (e) => {
  const card = e.target.closest('.vendor-product-card, .vp-list-row');
  if (!card || card !== _marginHoverCard) return;
  if (card.contains(e.relatedTarget)) return; // moved within the same card
  _marginHoverCard = null;
  _marginPanel?.classList.remove('show');
});

/* ── Start ───────────────────────────────────────── */

loadVendorProducts().then(runPendingCsvImport);
