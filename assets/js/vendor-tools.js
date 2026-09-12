/* ======================================================
   SELL4LIFE — VENDOR TOOLS  (Image Converter)
====================================================== */

const HEIC_CDN = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';

let _fmt     = 'image/jpeg';
let _quality = 0.85;

/* ── HEIC loader (lazy) ────────────────────────────── */

async function loadHeic2Any() {
  if (window.heic2any) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = HEIC_CDN;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load HEIC library'));
    document.head.appendChild(s);
  });
}

/* ── Helpers ─────────────────────────────────────── */

function fmtExt(mime) {
  return { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }[mime] || 'jpg';
}

function fmtSize(bytes) {
  if (bytes < 1024)         return bytes + ' B';
  if (bytes < 1024 * 1024)  return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function baseName(file) {
  return file.name.replace(/\.[^.]+$/, '');
}

function isHeic(file) {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.heic$|\.heif$/i.test(file.name)
  );
}

/* ── Convert single file ─────────────────────────── */

async function convertFile(file) {
  let blob = file;

  if (isHeic(file)) {
    await loadHeic2Any();
    const result = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 1 });
    blob = Array.isArray(result) ? result[0] : result;
  }

  const blobUrl = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = blobUrl; });

  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');

  if (_fmt !== 'image/png') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(blobUrl);

  return new Promise((res) => canvas.toBlob(res, _fmt, _quality));
}

/* ── Process a batch of files ────────────────────── */

async function processFiles(files) {
  const results = document.getElementById('tool-results');
  const clearBtn = document.getElementById('tool-clear-all');
  if (!results) return;

  if (clearBtn) clearBtn.style.display = '';

  for (const file of files) {
    const card = document.createElement('div');
    card.className = 'tool-rc';
    card.innerHTML = `
      <div class="tool-rc-pending">
        <span class="vp-bulk-spinner"></span>
        <span class="tool-rc-fname">${file.name}</span>
      </div>`;
    results.prepend(card);

    try {
      const outBlob  = await convertFile(file);
      const outUrl   = URL.createObjectURL(outBlob);
      const outName  = `${baseName(file)}.${fmtExt(_fmt)}`;
      const saved    = file.size - outBlob.size;
      const savedPct = Math.round((saved / file.size) * 100);

      card.innerHTML = `
        <img src="${outUrl}" class="tool-rc-img" alt="" />
        <div class="tool-rc-info">
          <div class="tool-rc-fname">${outName}</div>
          <div class="tool-rc-meta">
            <span class="tool-rc-orig">${fmtSize(file.size)}</span>
            <span class="tool-rc-arrow">→</span>
            <span class="tool-rc-new">${fmtSize(outBlob.size)}</span>
            ${saved > 0 ? `<span class="tool-rc-saved">−${savedPct}%</span>` : ''}
          </div>
          <a href="${outUrl}" download="${outName}" class="tool-rc-dl">↓ Download</a>
        </div>`;
    } catch (err) {
      console.error('Conversion error:', err);
      card.innerHTML = `
        <div class="tool-rc-pending">
          <span class="tool-rc-fname">${file.name}</span>
          <span class="tool-rc-err">Could not convert — format may not be supported</span>
        </div>`;
    }
  }
}

/* ── Drop zone ───────────────────────────────────── */

function bindDropZone() {
  const zone  = document.getElementById('tool-drop-zone');
  const input = document.getElementById('tool-file-input');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = [...e.dataTransfer.files].filter(
      (f) => f.type.startsWith('image/') || /\.heic$|\.heif$/i.test(f.name)
    );
    if (files.length) processFiles(files);
  });

  input.addEventListener('change', () => {
    const files = [...input.files];
    if (files.length) { processFiles(files); input.value = ''; }
  });
}

/* ── Format + quality controls ───────────────────── */

function bindOptions() {
  document.querySelectorAll('.tool-fmt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-fmt-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      _fmt = btn.dataset.fmt;
      const qWrap = document.getElementById('tool-quality-wrap');
      if (qWrap) qWrap.style.display = _fmt === 'image/png' ? 'none' : '';
    });
  });

  const slider = document.getElementById('tool-quality');
  const label  = document.getElementById('tool-quality-val');
  slider?.addEventListener('input', () => {
    _quality = parseInt(slider.value, 10) / 100;
    if (label) label.textContent = slider.value;
  });
}

/* ── Clear all ───────────────────────────────────── */

function bindClear() {
  document.getElementById('tool-clear-all')?.addEventListener('click', () => {
    const results = document.getElementById('tool-results');
    if (results) results.innerHTML = '';
    document.getElementById('tool-clear-all').style.display = 'none';
  });
}

/* ── Init ────────────────────────────────────────── */

bindDropZone();
bindOptions();
bindClear();

/* ══════════════════════════════════════════════════
   SPREADSHEET → CSV CONVERTER
══════════════════════════════════════════════════ */

const XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

async function loadXLSX() {
  if (window.XLSX) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_CDN;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load XLSX library'));
    document.head.appendChild(s);
  });
}

/* ── Field definitions ───────────────────────────── */

const S4L_FIELDS = [
  { key: 'name',               label: 'Product Name',         required: true  },
  { key: 'attr1value',         label: 'Variant Attribute 1 — Column', required: false, isAttr: true, attrNameKey: 'attr1name', attrDefault: 'Colour' },
  { key: 'attr2value',         label: 'Variant Attribute 2 — Column', required: false, isAttr: true, attrNameKey: 'attr2name', attrDefault: 'Size' },
  { key: 'attr3value',         label: 'Variant Attribute 3 — Column', required: false, isAttr: true, attrNameKey: 'attr3name', attrDefault: 'Model' },
  { key: 'costPrice',          label: 'Cost Price',           required: false },
  { key: 'price',              label: 'Retail Price (£)',     required: false },
  { key: 'comparePrice',       label: 'Compare Price',        required: false },
  { key: 'shippingCost',       label: 'Shipping Cost',        required: false },
  { key: 'shippingFrom',       label: 'Shipping From (warehouse)', required: false },
  { key: 'weightG',           label: 'SKU Weight (g)',        required: false },
  { key: 'stock',              label: 'Stock / Qty',          required: false },
  { key: 'category',           label: 'Category',             required: false },
  { key: 'subcategory',        label: 'Subcategory',          required: false },
  { key: 'sku',                label: 'SKU',                  required: false },
  { key: 'supplierVariantRef', label: 'Supplier Variant ID',  required: false },
  { key: 'supplierUrl',        label: 'Supplier Product URL', required: false },
  { key: 'supplierName',       label: 'Supplier Name',        required: false },
  { key: 'description',        label: 'Description',          required: false },
  { key: 'image1',             label: 'Variant Image URL',    required: false },
  { key: 'image2',             label: 'Image 2 URL',          required: false },
  { key: 'productImages',      label: 'Product Images (all, comma-separated)', required: false },
];

const AUTO_HINTS = {
  name:               ['name','product name','title','product title','item name','item','product'],
  price:              ['price','sale price','unit price','selling price','retail','retail price'],
  costPrice:          ['cost','cost price','item cost','unit cost','purchase price','buy price','supplier price','wholesale','product base price','product base price ($)'],
  comparePrice:       ['compare price','compare at price','original price','was','rrp','msrp','was price'],
  shippingCost:       ['shipping','shipping cost','delivery','postage','freight','ship cost','shipping fee','shipping fee ($)'],
  shippingFrom:       ['shipping from','ship from','warehouse','ships from','origin warehouse','origin country','warehouse location'],
  stock:              ['stock','quantity','qty','inventory','available','units'],
  category:           ['category','cat','type','product type','department'],
  subcategory:        ['subcategory','sub category','sub-category','subtype','subcategory'],
  sku:                ['sku','product code','item code','barcode','upc','isbn','ref','product id'],
  description:        ['description','desc','details','product description','body','notes','overview','long description','specification'],
  image1:             ['product image','sku image','image','image1','image 1','image url','photo','picture','img','thumbnail','sku picture','variant image','variant picture'],
  attr1value:         ['variant','variation','option','color','colour','specification','spec'],
  image2:             ['image2','image 2','photo2','picture2','secondary image','image url 2'],
  productImages:      ['product main picture','main picture','product photos','product images','all images','gallery','main images','product image url'],
  supplierVariantRef: ['variant id','variant ref','supplier variant ref','supplier variant id','vid','variantid','supplier id'],
  supplierUrl:        ['product url','product link','supplier url','supplier link','source url','source link','item url','listing url','pid url'],
  supplierName:       ['supplier','supplier name','vendor name','brand'],
  weightG:            ['sku weight (g)','weight (g)','weight','product weight','item weight','sku weight'],
};

/* ── State ───────────────────────────────────────── */

let _wb               = null;
let _headers          = [];
let _rows             = [];
let _mapping          = {};
let _attrNames        = { attr1name: 'Colour', attr2name: 'Size', attr3name: 'Model' };
let _stripSuffix      = false;
let _splitAttr        = false;
let _shippingCosts    = {};    // rowIndex → { cost, currency, etaDays } | null
let _perRowMarkup     = [];    // rowIndex → number | null (null = use global)
let _priceBands       = [{ min: null, max: null, markup: null }]; // [{min, max, markup}] — True Cost £ ranges, first match wins
let _selectedRows     = new Set(); // rowIndex → included in export/import
let _destCountry      = 'GB';
let _autoFetch        = false;
let _providerConfigured = false;
let _providerName     = null;

function stripTrailingCode(name) {
  return String(name).replace(/\s+\d{3,8}$/, '').trim();
}

// Estimated CJPacket UK shipping cost from product weight in grams.
function cjUkShippingFromWeight(weightG) {
  const w = parseFloat(weightG) || 0;
  if (w <= 0)    return 0;
  if (w <= 100)  return 3.50;
  if (w <= 200)  return 4.50;
  if (w <= 300)  return 5.50;
  if (w <= 500)  return 7.00;
  if (w <= 750)  return 9.00;
  if (w <= 1000) return 11.00;
  if (w <= 2000) return 16.00;
  return 22.00;
}

// Accepts either an ISO code already or common raw text CJ's own export
// uses ("China", "United Kingdom", etc.) — same normalization the backend
// import route applies, so a vendor uploading the generated CSV or a raw
// CJ export both end up with the same clean value. Unrecognized text is
// left blank rather than guessed — product.js's 'CN' default covers it.
function normalizeShippingOrigin(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  if (['CN', 'CHINA'].includes(s)) return 'CN';
  if (['US', 'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(s)) return 'US';
  if (['GB', 'UK', 'UNITED KINGDOM', 'BRITAIN', 'GREAT BRITAIN'].includes(s)) return 'GB';
  if (['DE', 'GERMANY'].includes(s)) return 'DE';
  return /^[A-Z]{2}$/.test(s) ? s : '';
}

/* ── Auto-detect column mapping ──────────────────── */

function autoDetect(headers) {
  const lower = headers.map(h => String(h).toLowerCase().trim());
  const map = {};
  S4L_FIELDS.forEach(({ key }) => {
    for (const hint of (AUTO_HINTS[key] || [])) {
      const i = lower.indexOf(hint);
      if (i !== -1) { map[key] = headers[i]; break; }
    }
  });
  return map;
}

/* ── Price / True Cost calculator ───────────────── */

function getCurrencyRate() {
  const sel = document.getElementById('csv-currency');
  if (!sel) return 1;
  if (sel.value === 'custom') {
    return parseFloat(document.getElementById('csv-custom-rate')?.value) || 1;
  }
  return parseFloat(sel.value) || 1;
}

function getMarkup() {
  return parseFloat(document.getElementById('csv-markup')?.value) || 0;
}

// Flat £ delta and/or round-to-.99, applied after markup/currency — same
// relationship as the ± Adjust bulk tool on the My Products page.
function applyPriceAdjustment(price) {
  const amount  = parseFloat(document.getElementById('csv-adjust-amount')?.value) || 0;
  const round99 = document.getElementById('csv-round99')?.checked;
  let p = price + amount;
  if (p < 0.01) p = 0.01;
  if (round99) p = Math.floor(p) + 0.99;
  return Math.round(p * 100) / 100;
}

// Returns shipping in source currency for a given row (fetched → mapped column → weight estimate).
function getRowShipping(rowIndex) {
  const fetched = _shippingCosts[rowIndex];
  if (fetched != null) return fetched.cost;
  const col = _mapping['shippingCost'];
  if (col && _rows[rowIndex]) {
    const v = parseFloat(String(_rows[rowIndex][col]).replace(/[^0-9.-]/g, ''));
    if (!isNaN(v) && v > 0) return v;
  }
  const wCol = _mapping['weightG'];
  if (wCol && _rows[rowIndex]) {
    const wg = parseFloat(String(_rows[rowIndex][wCol]).replace(/[^0-9.-]/g, ''));
    if (!isNaN(wg) && wg > 0) return cjUkShippingFromWeight(wg);
  }
  return 0;
}

// Retail price = (itemCost + shippingUSD) × rate × (1 + markup/100).
// If costPrice is not the basis, shippingUSD defaults to 0 (simple markup mode).
function applyPriceCalc(rawCostVal, shippingUSD = 0, markupOverride = null) {
  const cost = parseFloat(String(rawCostVal).replace(/[^0-9.-]/g, ''));
  if (isNaN(cost) || cost === 0) return '';
  const rate    = getCurrencyRate();
  const markup  = markupOverride !== null ? markupOverride : getMarkup();
  const trueCost = (cost + (parseFloat(shippingUSD) || 0)) * rate;
  return applyPriceAdjustment(trueCost * (1 + markup / 100)).toFixed(2);
}

/* ── Markup by price band ────────────────────────── */

// True Cost in £ for a given row — same basis as the preview table's
// "True Cost" column (item cost + shipping, converted at the chosen rate).
function trueCostForRow(rowIndex) {
  const costCol = _mapping['costPrice'];
  if (!costCol || !_rows[rowIndex]) return NaN;
  const cost = parseFloat(String(_rows[rowIndex][costCol]).replace(/[^0-9.-]/g, ''));
  if (isNaN(cost) || cost === 0) return NaN;
  return (cost + getRowShipping(rowIndex)) * getCurrencyRate();
}

function renderBandRows() {
  const wrap = document.getElementById('csv-band-rows');
  if (!wrap) return;
  wrap.innerHTML = _priceBands.map((b, i) => `
    <div class="csv-band-row" data-idx="${i}" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:0.85rem">
      <span>&pound;</span>
      <input type="number" class="csv-band-min" min="0" step="0.01" placeholder="0" value="${b.min ?? ''}" style="width:64px" />
      <span>&ndash;</span>
      <input type="number" class="csv-band-max" min="0" step="0.01" placeholder="and up" value="${b.max ?? ''}" style="width:72px" />
      <span>&rarr; markup</span>
      <input type="number" class="csv-band-markup" min="0" step="1" placeholder="%" value="${b.markup ?? ''}" style="width:64px" />
      <span>%</span>
      <button type="button" class="csv-band-remove" data-idx="${i}" title="Remove this band"
        style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;line-height:1;padding:0 4px">&times;</button>
    </div>
  `).join('');

  wrap.querySelectorAll('.csv-band-min, .csv-band-max, .csv-band-markup').forEach((inp) => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.closest('.csv-band-row').dataset.idx, 10);
      const val = inp.value === '' ? null : parseFloat(inp.value);
      if (inp.classList.contains('csv-band-min'))    _priceBands[idx].min    = val;
      if (inp.classList.contains('csv-band-max'))    _priceBands[idx].max    = val;
      if (inp.classList.contains('csv-band-markup')) _priceBands[idx].markup = val;
    });
  });

  wrap.querySelectorAll('.csv-band-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      _priceBands.splice(idx, 1);
      if (!_priceBands.length) _priceBands.push({ min: null, max: null, markup: null });
      renderBandRows();
    });
  });
}

function applyPriceBands() {
  const bands = _priceBands
    .filter((b) => b.markup != null && !isNaN(b.markup))
    .map((b) => ({ min: b.min ?? -Infinity, max: b.max ?? Infinity, markup: b.markup }));
  const msg = document.getElementById('csv-band-msg');
  if (!bands.length) {
    if (msg) msg.textContent = 'Add at least one band with a markup % first.';
    return;
  }

  let matched = 0;
  _rows.forEach((row, i) => {
    const cost = trueCostForRow(i);
    if (isNaN(cost)) return; // no cost recorded for this row — leave on the flat markup
    const band = bands.find((b) => cost >= b.min && cost <= b.max);
    if (band) { _perRowMarkup[i] = band.markup; matched++; }
  });

  if (msg) msg.textContent = `Applied to ${matched} of ${_rows.length} rows.`;
  renderPreview();
}

function updateCalcExample() {
  const el = document.getElementById('csv-calc-example');
  if (!el) return;
  const useTrueCost = !!_mapping['costPrice'];
  const col = _mapping[useTrueCost ? 'costPrice' : 'price'];
  if (!col || !_rows.length) { el.textContent = ''; return; }
  const sample = _rows[0][col];
  const raw    = parseFloat(String(sample).replace(/[^0-9.-]/g, ''));
  if (isNaN(raw)) { el.textContent = ''; return; }
  const rate   = getCurrencyRate();
  const markup = getMarkup();
  const ship   = getRowShipping(0);
  const result = applyPriceCalc(sample, ship);
  if (useTrueCost) {
    const trueCost = ((raw + ship) * rate).toFixed(2);
    el.innerHTML = `e.g. cost <span class="csv-calc-from">${raw}</span>`
      + (ship ? ` + ship <span class="csv-calc-from">${ship.toFixed(2)}</span>` : '')
      + ` × ${rate} = <span class="csv-calc-from">£${trueCost}</span>`
      + (markup ? ` × ${(1 + markup / 100).toFixed(2)}` : '')
      + ` → <span class="csv-calc-to">£${result}</span>`;
  } else {
    const parts = [];
    if (rate !== 1) parts.push(`× ${rate} (rate)`);
    if (markup)     parts.push(`× ${(1 + markup / 100).toFixed(2)} (markup)`);
    el.innerHTML = `e.g. <span class="csv-calc-from">${raw}</span> → <span class="csv-calc-to">£${result}</span>${parts.length ? ` <span class="csv-calc-steps">(${parts.join(' ')})</span>` : ''}`;
  }
}

/* ── Provider status ─────────────────────────────── */

async function checkProviderStatus() {
  try {
    const token = localStorage.getItem('s4l_token');
    if (!token) return;
    const res = await fetch(`${window.API_BASE}/vendor/supplier/providers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { providers } = await res.json();
    const configured = providers?.find(p => p.configured);
    _providerConfigured = !!configured;
    _providerName = configured?.providerName ?? null;
  } catch { /* no-op */ }
  updateAutofetchVisibility();
}

function updateAutofetchVisibility() {
  const hasSVR   = !!_mapping['supplierVariantRef'];
  const show     = hasSVR && _providerConfigured;
  const destWrap = document.getElementById('csv-dest-wrap');
  const fetchWrap = document.getElementById('csv-autofetch-wrap');
  const fetchBox  = document.getElementById('csv-autofetch');
  if (destWrap)  destWrap.style.display  = show ? '' : 'none';
  if (fetchWrap) fetchWrap.style.display = show ? '' : 'none';
  if (!show && fetchBox) { fetchBox.checked = false; _autoFetch = false; }
}

/* ── Shipping fetch ──────────────────────────────── */

async function fetchShippingCosts() {
  const col = _mapping['supplierVariantRef'];
  if (!col || !_providerName) return;
  const originCol = _mapping['shippingFrom'];

  const statusEl = document.getElementById('csv-shipping-status');
  if (statusEl) { statusEl.style.display = ''; statusEl.textContent = 'Fetching shipping costs…'; }

  const items = _rows
    .map((row, i) => {
      const item = { supplierVariantRef: String(row[col] ?? '').trim(), rowIndex: i };
      // When mapped, quote from the product's real warehouse (e.g. CJ's
      // "Shipping From" column) instead of always assuming China.
      if (originCol) {
        const origin = normalizeShippingOrigin(row[originCol]);
        if (origin) item.startCountryCode = origin;
      }
      return item;
    })
    .filter(x => x.supplierVariantRef);

  if (!items.length) {
    if (statusEl) statusEl.textContent = 'No variant IDs found in the mapped column.';
    return;
  }

  try {
    const token = localStorage.getItem('s4l_token');
    if (!token) { if (statusEl) statusEl.textContent = 'Not authenticated.'; return; }

    const CHUNK = 10; // CJ rate limit: 1 req/sec × 10 items = ~11s per chunk, safe under Render 30s timeout
    let found = 0;
    for (let i = 0; i < items.length; i += CHUNK) {
      const chunk = items.slice(i, i + CHUNK);
      if (statusEl) statusEl.textContent = `Fetching shipping costs… ${Math.min(i + CHUNK, items.length)}/${items.length}`;
      const res = await fetch(`${window.API_BASE}/vendor/supplier/shipping-lookup`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ items: chunk, destinationCountry: _destCountry, providerName: _providerName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (statusEl) statusEl.textContent = `Fetch failed: ${err.error || res.status}`;
        return;
      }
      const { results } = await res.json();
      for (const { rowIndex, result } of (results || [])) {
        _shippingCosts[rowIndex] = result;
        if (result != null) found++;
      }
    }

    if (statusEl) {
      statusEl.textContent = `Shipping fetched: ${found}/${items.length} items`
        + (found < items.length ? ` (${items.length - found} not found — price uses item cost only)` : '');
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = `Fetch error: ${err.message}`;
  }

  updateCalcExample();
  renderPreview();
}

/* ── Price calc UI bindings ──────────────────────── */

function bindPriceCalc() {
  document.getElementById('csv-currency')?.addEventListener('change', (e) => {
    const wrap = document.getElementById('csv-custom-rate-wrap');
    if (wrap) wrap.style.display = e.target.value === 'custom' ? '' : 'none';
    updateCalcExample();
    renderPreview();
  });
  document.getElementById('csv-custom-rate')?.addEventListener('input', () => { updateCalcExample(); renderPreview(); });
  document.getElementById('csv-markup')?.addEventListener('input', () => {
    _perRowMarkup = [];
    updateCalcExample();
    renderPreview();
  });
  document.getElementById('csv-adjust-amount')?.addEventListener('input', () => {
    updateCalcExample();
    renderPreview();
  });
  document.getElementById('csv-round99')?.addEventListener('change', () => {
    updateCalcExample();
    renderPreview();
  });
  document.getElementById('csv-dest-country')?.addEventListener('change', (e) => {
    _destCountry = e.target.value;
    if (_autoFetch) { _shippingCosts = {}; fetchShippingCosts(); }
  });
  document.getElementById('csv-autofetch')?.addEventListener('change', (e) => {
    _autoFetch = e.target.checked;
    if (_autoFetch) {
      _shippingCosts = {};
      fetchShippingCosts();
    } else {
      _shippingCosts = {};
      const statusEl = document.getElementById('csv-shipping-status');
      if (statusEl) statusEl.style.display = 'none';
      renderPreview();
    }
  });

  renderBandRows();
  document.getElementById('csv-band-add')?.addEventListener('click', () => {
    _priceBands.push({ min: null, max: null, markup: null });
    renderBandRows();
  });
  document.getElementById('csv-band-apply')?.addEventListener('click', applyPriceBands);
}

function togglePriceCalc() {
  const hasCost  = !!_mapping['costPrice'];
  const hasPrice = !!_mapping['price'];
  const wrap = document.getElementById('csv-price-calc');
  if (wrap) wrap.style.display = (hasCost || hasPrice) ? '' : 'none';
  // Price bands need a real cost basis to compute True Cost against —
  // meaningless if only a flat "price" column is mapped.
  const bandsWrap = document.getElementById('csv-price-bands');
  if (bandsWrap) bandsWrap.style.display = hasCost ? '' : 'none';
  updateAutofetchVisibility();
  updateCalcExample();
}

/* ── Load sheet from workbook ────────────────────── */

function loadSheet(sheetName) {
  if (!_wb) return;
  const ws  = _wb.Sheets[sheetName];
  const raw = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Skip not just fully-blank rows but sparse "notice" rows too — CJ's
  // current export prepends a one-cell disclaimer ("Inventory columns are
  // filtered by...") before the real header row, which used to be row 1.
  // A genuine header row has many populated columns; anything with fewer
  // than 3 isn't it.
  const MIN_HEADER_CELLS = 3;
  let headerRow = 0;
  while (headerRow < raw.length && raw[headerRow].filter(c => c !== '').length < MIN_HEADER_CELLS) headerRow++;
  if (headerRow >= raw.length) { _headers = []; _rows = []; return; }

  _headers = raw[headerRow].map(h => String(h).trim()).filter(Boolean);
  _rows = raw.slice(headerRow + 1)
    .filter(r => r.some(c => c !== ''))
    .map(r => {
      const obj = {};
      _headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : ''; });
      return obj;
    });

  _shippingCosts = {};
  _perRowMarkup  = [];
  _priceBands    = [{ min: null, max: null, markup: null }];
  _selectedRows  = new Set(_rows.map((_, i) => i));
  _mapping = autoDetect(_headers);
  renderMapper();
  renderPreview();
  renderBandRows();
  showActions();
  const titleOpts = document.getElementById('csv-title-opts');
  if (titleOpts) titleOpts.style.display = '';
  checkProviderStatus();
}

/* ── Parse uploaded file ─────────────────────────── */

// Counts occurrences of each candidate delimiter on the header line and
// picks the most frequent one — more reliable than XLSX's own built-in
// CSV/TSV/PSV/SSV auto-detection, which can misfire on exports (CJ's
// included) that use semicolons and can miscount when a text field
// elsewhere in the file happens to contain commas.
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) { bestCount = count; best = d; }
  }
  return best;
}

async function parseFile(file) {
  await loadXLSX();

  // True CSV/TSV text files get their delimiter sniffed explicitly rather
  // than handed to XLSX's own auto-detection as a raw byte array — real
  // .xlsx/.xls/.ods spreadsheets are unaffected, they're parsed as binary.
  const isPlainText = /\.(csv|tsv|txt)$/i.test(file.name) || file.type === 'text/csv';
  if (isPlainText) {
    const text = await file.text();
    const delimiter = detectDelimiter(text);
    _wb = window.XLSX.read(text, { type: 'string', FS: delimiter });
  } else {
    const buf = await file.arrayBuffer();
    _wb = window.XLSX.read(buf, { type: 'array' });
  }

  const sheetNames = _wb.SheetNames;
  document.getElementById('csv-info-bar').style.display = '';
  document.getElementById('csv-file-name').textContent  = file.name;

  const sheetLabel  = document.getElementById('csv-sheet-label');
  const sheetSelect = document.getElementById('csv-sheet-select');
  if (sheetNames.length > 1) {
    sheetLabel.style.display = '';
    sheetSelect.innerHTML = sheetNames.map(n => `<option value="${n}">${n}</option>`).join('');
    sheetSelect.onchange = () => loadSheet(sheetSelect.value);
  } else {
    sheetLabel.style.display = 'none';
  }

  loadSheet(sheetNames[0]);
}

/* ── Render column mapper ────────────────────────── */

function renderMapper() {
  const grid  = document.getElementById('csv-mapper');
  const inner = document.getElementById('csv-mapper-grid');
  if (!grid || !inner) return;

  const opts = ['', ..._headers].map(h =>
    `<option value="${h}">${h || '— Skip —'}</option>`
  ).join('');

  const ATTR_NAMES = ['Colour','Size','Model','Material','Style','Type','Pattern','Print','Design','Finish','Fabric','Brand','Fit','Cut','Neckline','Sleeve','Leg Style','Length','Width','Height','Depth','Weight','Volume','Capacity','Pack Size','Quantity','Bundle','Compatibility','Platform','Storage','Memory','Wattage','Voltage','Connectivity','Scent','Fragrance','Flavour','Taste','Gender','Age Group','Shoe Size','Ring Size','Waist','Chest','Edition','Version','Generation','Series','Certification'];

  inner.innerHTML = S4L_FIELDS.map(({ key, label, required, isAttr, attrNameKey, attrDefault }) => {
    const sep = key === 'costPrice' ? '<div class="csv-group-sep"></div>' : '';
    if (isAttr) {
      const attrNum = key === 'attr1value' ? 1 : key === 'attr2value' ? 2 : 3;
      const cur = _attrNames[attrNameKey] || attrDefault || '';
      const hasCustom = cur && !ATTR_NAMES.includes(cur);
      const nameOpts = ATTR_NAMES.map(n => `<option value="${n}"${n === cur ? ' selected' : ''}>${n}</option>`).join('');
      return `${sep}<div class="csv-map-row csv-map-row-attr">
        <label class="csv-attr-lbl">Attr ${attrNum}</label>
        <select class="csv-map-select csv-attr-name-input csv-attr-name-sel" data-attr-key="${attrNameKey}">
          ${nameOpts}${hasCustom ? `<option value="${cur}" selected>${cur}</option>` : ''}
        </select>
        <select class="csv-map-select" data-key="${key}">${opts}</select>
        <span class="csv-map-preview" id="csv-mp-${key}"></span>
      </div>`;
    }
    return `${sep}<div class="csv-map-row">
      <label class="csv-map-label">${label}${required ? '<span class="csv-required-mark"> *</span>' : ''}</label>
      <select class="csv-map-select" data-key="${key}">${opts}</select>
      <span class="csv-map-preview" id="csv-mp-${key}"></span>
    </div>`;
  }).join('');

  inner.querySelectorAll('.csv-map-select[data-key]').forEach(sel => {
    const key = sel.dataset.key;
    if (_mapping[key]) sel.value = _mapping[key];
    sel.addEventListener('change', () => {
      _mapping[key] = sel.value;
      updateMapPreview(key);
      if (key === 'price' || key === 'costPrice') togglePriceCalc();
      if (key === 'supplierVariantRef') {
        _shippingCosts = {};
        updateAutofetchVisibility();
        if (_autoFetch) fetchShippingCosts();
      }
      renderPreview();
    });
    updateMapPreview(key);
  });

  inner.querySelectorAll('.csv-attr-name-input').forEach(sel => {
    const attrKey = sel.dataset.attrKey;
    sel.addEventListener('change', () => {
      _attrNames[attrKey] = sel.value;
      renderPreview();
    });
  });

  grid.style.display = '';
  togglePriceCalc();
}

function updateMapPreview(key) {
  const el = document.getElementById(`csv-mp-${key}`);
  if (!el) return;
  const col    = _mapping[key];
  const sample = col && _rows.length ? String(_rows[0][col] || '').slice(0, 40) : '';
  el.textContent = sample ? `e.g. ${sample}` : '';
}

/* ── Render preview table ────────────────────────── */

function renderPreview() {
  const wrap  = document.getElementById('csv-preview');
  const table = document.getElementById('csv-preview-table');
  const label = document.getElementById('csv-row-count');
  if (!wrap || !table) return;

  const mapped = S4L_FIELDS.filter(f => _mapping[f.key] ||
    (f.key === 'attr2value' && _splitAttr && _mapping['attr1value'] && !_mapping['attr2value']));
  if (!mapped.length) { wrap.style.display = 'none'; return; }

  const useTrueCost  = !!_mapping['costPrice'];
  const globalMarkup = getMarkup();
  const rate         = getCurrencyRate();

  // In True Cost mode hide the costPrice column from the regular cells — it appears in the breakdown
  const displayFields = useTrueCost ? mapped.filter(f => f.key !== 'costPrice') : mapped;

  const allChecked = _rows.every((_, i) => _selectedRows.has(i));
  let headerHtml = `<th style="width:32px"><input type="checkbox" id="csv-select-all" ${allChecked ? 'checked' : ''} title="Select / deselect all" /></th>`;
  headerHtml += displayFields.map(f =>
    `<th>${f.isAttr && _attrNames[f.attrNameKey] ? _attrNames[f.attrNameKey] : f.label}</th>`
  ).join('');
  if (useTrueCost) {
    headerHtml += '<th>Item Cost</th><th>Shipping</th><th>True Cost</th><th style="min-width:80px">Markup %</th>';
  }

  const tbody = _rows.map((row, i) => {
    const markup  = _perRowMarkup[i] != null ? _perRowMarkup[i] : globalMarkup;
    const checked = _selectedRows.has(i);
    const rowStyle = checked ? '' : 'style="opacity:0.35"';

    let cells = `<td><input type="checkbox" class="csv-row-select" data-row="${i}" ${checked ? 'checked' : ''} /></td>`;
    cells += displayFields.map(f => {
      const raw = String(row[_mapping[f.key]] ?? '');
      let val;
      if (f.key === 'price') {
        const costRaw = useTrueCost ? String(row[_mapping['costPrice']] ?? '') : raw;
        val = applyPriceCalc(costRaw, useTrueCost ? getRowShipping(i) : 0, markup) || raw;
      } else if (f.key === 'name' && _stripSuffix) {
        val = stripTrailingCode(raw);
      } else if (_splitAttr && f.key === 'attr1value' && raw.includes('/')) {
        val = raw.split('/')[0].trim();
      } else if (_splitAttr && f.key === 'attr2value' && !_mapping['attr2value'] && _mapping['attr1value']) {
        const raw1 = String(row[_mapping['attr1value']] ?? '');
        val = raw1.includes('/') ? raw1.split('/').slice(1).join('/').trim() : '';
      } else {
        val = raw;
      }
      return `<td>${escCsv(val)}</td>`;
    }).join('');

    if (useTrueCost) {
      const costRaw  = parseFloat(String(row[_mapping['costPrice']] ?? '').replace(/[^0-9.-]/g, '')) || 0;
      const shipUSD  = getRowShipping(i);
      const hasShip  = shipUSD > 0;
      const trueCost = ((costRaw + shipUSD) * rate).toFixed(2);
      cells += `<td>£${(costRaw * rate).toFixed(2)}</td>`
             + `<td>${hasShip ? `£${(shipUSD * rate).toFixed(2)}` : '<span style="color:#9ca3af">—</span>'}</td>`
             + `<td>£${trueCost}</td>`
             + `<td><input type="number" class="csv-row-markup" data-row="${i}" min="0" max="999" value="${markup}" /></td>`;
    }

    return `<tr ${rowStyle}>${cells}</tr>`;
  }).join('');

  table.innerHTML = `<thead><tr>${headerHtml}</tr></thead><tbody>${tbody}</tbody>`;

  // Select-all checkbox
  table.querySelector('#csv-select-all')?.addEventListener('change', e => {
    if (e.target.checked) {
      _rows.forEach((_, i) => _selectedRows.add(i));
    } else {
      _selectedRows.clear();
    }
    const scroll = table.closest('.csv-preview-scroll');
    const prevTop = scroll?.scrollTop || 0;
    renderPreview();
    if (scroll) scroll.scrollTop = prevTop;
    updateSelectedCount();
  });

  // Per-row checkboxes
  table.querySelectorAll('.csv-row-select').forEach(cb => {
    cb.addEventListener('change', () => {
      const ri = parseInt(cb.dataset.row, 10);
      if (cb.checked) { _selectedRows.add(ri); } else { _selectedRows.delete(ri); }
      const tr = cb.closest('tr');
      if (tr) tr.style.opacity = cb.checked ? '' : '0.35';
      updateSelectedCount();
    });
  });

  if (useTrueCost) {
    const scroll = table.closest('.csv-preview-scroll');
    table.querySelectorAll('.csv-row-markup').forEach(inp => {
      inp.addEventListener('change', () => {
        const ri = parseInt(inp.dataset.row, 10);
        _perRowMarkup[ri] = parseFloat(inp.value) || 0;
        const prevTop = scroll?.scrollTop || 0;
        renderPreview();
        if (scroll) scroll.scrollTop = prevTop;
      });
    });
  }

  updateSelectedCount();
  wrap.style.display = '';
  bindScrollButtons();
}

/* ── Horizontal scroll buttons for preview table ─────── */

let _scrollBtnsBound = false;

function updateScrollButtons() {
  const scroll = document.querySelector('.csv-preview-scroll');
  const left   = document.getElementById('csv-scroll-left');
  const right  = document.getElementById('csv-scroll-right');
  if (!scroll || !left || !right) return;

  const overflowing = scroll.scrollWidth > scroll.clientWidth + 1;
  if (!overflowing) {
    left.style.display  = 'none';
    right.style.display = 'none';
    return;
  }

  const rect      = scroll.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const visibleTop    = Math.max(rect.top, 0);
  const visibleBottom = Math.min(rect.bottom, viewportH);

  if (visibleBottom <= visibleTop) {
    left.style.display  = 'none';
    right.style.display = 'none';
    return;
  }

  left.style.top     = `${visibleTop}px`;
  left.style.height  = `${visibleBottom - visibleTop}px`;
  right.style.top    = `${visibleTop}px`;
  right.style.height = `${visibleBottom - visibleTop}px`;
  left.style.left    = `${rect.left}px`;
  right.style.left   = `${rect.right - 40}px`;

  left.style.display  = scroll.scrollLeft > 4 ? '' : 'none';
  right.style.display = scroll.scrollLeft < scroll.scrollWidth - scroll.clientWidth - 4 ? '' : 'none';
}

function bindScrollButtons() {
  const scroll = document.querySelector('.csv-preview-scroll');
  const left   = document.getElementById('csv-scroll-left');
  const right  = document.getElementById('csv-scroll-right');
  if (!scroll || !left || !right) return;

  updateScrollButtons();

  if (_scrollBtnsBound) return;
  _scrollBtnsBound = true;

  left.addEventListener('click', () => scroll.scrollBy({ left: -240, behavior: 'smooth' }));
  right.addEventListener('click', () => scroll.scrollBy({ left: 240, behavior: 'smooth' }));
  scroll.addEventListener('scroll', updateScrollButtons);
  window.addEventListener('scroll', updateScrollButtons, { passive: true });
  window.addEventListener('resize', updateScrollButtons);
}

function updateSelectedCount() {
  const label = document.getElementById('csv-row-count');
  const total    = _rows.length;
  const selected = _selectedRows.size;
  if (label) label.textContent = selected === total ? `${total} rows` : `${selected} of ${total} rows selected`;

  const toggleBtn = document.getElementById('csv-select-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = (selected === total && total > 0) ? 'Deselect All' : 'Select All';
}

/* ── Show actions ────────────────────────────────── */

function showActions() {
  updateSelectedCount();
  document.getElementById('csv-actions').style.display     = '';
  document.getElementById('csv-actions-top').style.display = '';
}

/* ── Helpers ─────────────────────────────────────── */

function escCsv(val) {
  const s = String(val).replace(/"/g, '""');
  return /[,"\n\r]/.test(s) ? `"${s}"` : s;
}

/* ── CSV output ──────────────────────────────────── */

const CSV_OUTPUT_FIELDS = [
  'name', 'attr1name', 'attr1value', 'attr2name', 'attr2value', 'attr3name', 'attr3value',
  'price', 'comparePrice', 'costPrice', 'shippingCost', 'shippingOriginCountry', 'markupPct', 'shipIncluded', 'stock',
  'category', 'subcategory', 'sku', 'supplierVariantRef', 'supplierUrl', 'supplierName',
  'description',
  'image1','image2','image3','image4','image5','image6','image7','image8','image9','image10',
  'image11','image12','image13','image14','image15','image16','image17','image18','image19','image20',
];

function getOutputValue(row, key, rowIndex = 0) {
  if (key === 'attr1name') return _mapping.attr1value ? (_attrNames.attr1name || '') : '';
  if (key === 'attr2name') {
    const hasAttr2 = _mapping.attr2value || (_splitAttr && _mapping.attr1value);
    return hasAttr2 ? (_attrNames.attr2name || '') : '';
  }
  if (key === 'attr3name') return _mapping.attr3value ? (_attrNames.attr3name || '') : '';

  const col    = _mapping[key];
  const raw    = col ? String(row[col] ?? '') : '';
  const markup = _perRowMarkup[rowIndex] != null ? _perRowMarkup[rowIndex] : getMarkup();

  if (key === 'price') {
    if (_mapping['costPrice']) {
      const costUsd = parseFloat(String(row[_mapping['costPrice']] ?? ''));
      if (isNaN(costUsd) || costUsd <= 0) return '';
      const rate    = getCurrencyRate();
      const costGbp = Math.round(costUsd * rate * 100) / 100;
      const shipUsd = getRowShipping(rowIndex);
      const shipGbp = shipUsd > 0 ? Math.round(shipUsd * rate * 100) / 100 : 0;
      const mu      = _perRowMarkup[rowIndex] != null ? _perRowMarkup[rowIndex] : getMarkup();
      return applyPriceAdjustment((costGbp + shipGbp) * (1 + mu / 100)).toFixed(2);
    }
    return applyPriceCalc(raw, 0, markup) || raw;
  }

  if (key === 'costPrice') {
    const cost = parseFloat(raw);
    if (!isNaN(cost) && cost > 0) return (cost * getCurrencyRate()).toFixed(2);
    return raw;
  }

  if (key === 'shippingCost') {
    const ship = getRowShipping(rowIndex);
    if (ship > 0) return (ship * getCurrencyRate()).toFixed(2);
    return raw;
  }

  if (key === 'shippingOriginCountry') {
    // Mapped from the 'shippingFrom' input field, not a same-named output
    // column — 'raw'/'col' above are keyed off 'shippingOriginCountry'
    // itself, which nothing maps to directly.
    const originCol = _mapping['shippingFrom'];
    return originCol ? normalizeShippingOrigin(row[originCol]) : '';
  }

  if (key === 'markupPct') {
    const mu = _perRowMarkup[rowIndex] != null ? _perRowMarkup[rowIndex] : getMarkup();
    return mu >= 0 ? String(mu) : '';
  }

  if (key === 'shipIncluded') {
    return (!!_mapping['costPrice'] && getRowShipping(rowIndex) > 0) ? 'true' : 'false';
  }

  if (key === 'name' && _stripSuffix) return raw ? stripTrailingCode(raw) : '';

  // image2–image20: if no explicit column mapped, pull from productImages comma-separated column
  const _imgN = /^image(\d+)$/.exec(key);
  if (_imgN && parseInt(_imgN[1], 10) >= 2 && !_mapping[key] && _mapping['productImages']) {
    const piVal = String(row[_mapping['productImages']] ?? '').trim();
    const urls  = piVal.split(/[,;]+/).map(u => u.trim()).filter(Boolean);
    return urls[parseInt(_imgN[1], 10) - 2] || '';
  }

  if (_splitAttr) {
    if (key === 'attr1value' && raw.includes('/')) return raw.split('/')[0].trim();
    if (key === 'attr2value' && !col && _mapping['attr1value']) {
      const raw1 = String(row[_mapping['attr1value']] ?? '');
      return raw1.includes('/') ? raw1.split('/').slice(1).join('/').trim() : '';
    }
  }

  return raw;
}

function generateCSV() {
  const header   = CSV_OUTPUT_FIELDS.join(',');
  const dataRows = _rows
    .map((row, i) => ({ row, i }))
    .filter(({ i }) => _selectedRows.has(i))
    .map(({ row, i }) => CSV_OUTPUT_FIELDS.map(key => escCsv(getOutputValue(row, key, i))).join(','));
  return [header, ...dataRows].join('\n');
}

function validateFields() {
  const required = S4L_FIELDS.filter(f => f.required && !_mapping[f.key]);
  if (required.length) return `Map required fields first: ${required.map(f => f.label).join(', ')}`;
  if (!_mapping['price'] && !_mapping['costPrice']) {
    return 'Map either "Retail Price" or "Cost Price" — at least one is needed to set a price';
  }
  return null;
}

function downloadCSV() {
  const err = validateFields();
  if (err) { window.showToast?.(err, 'error'); return; }
  const csv  = generateCSV();
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'sell4life-import.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Import summary modal ────────────────────────── */

function showImportSummary(onConfirm) {
  const useTrueCost    = !!_mapping['costPrice'];
  const selectedRows   = _rows.filter((_, i) => _selectedRows.has(i));
  const totalRows      = selectedRows.length;
  const fetched        = selectedRows.filter((_, i) => {
    const origIndex = _rows.indexOf(selectedRows[i]);
    return _shippingCosts[origIndex] != null;
  }).length;

  let body = `<p style="margin:0 0 12px"><strong>${totalRows} rows</strong> ready to import${_selectedRows.size < _rows.length ? ` <span style="color:#6b7280;font-size:12px">(${_rows.length - totalRows} deselected)</span>` : ''}.</p>`;
  if (useTrueCost) {
    body += `<p style="margin:0 0 8px;color:#374151">Retail price is calculated from cost price using the True Cost formula.</p>`;
  }
  if (_autoFetch && _providerConfigured) {
    body += `<p style="margin:0 0 8px;color:#374151">Shipping costs fetched for <strong>${fetched}/${totalRows}</strong> items.</p>`;
    if (fetched < totalRows) {
      body += `<p style="margin:0 0 8px;color:#6b7280;font-size:13px">${totalRows - fetched} items have no shipping cost — price calculated from item cost only.</p>`;
    }
  }

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:420px;width:90%;box-shadow:0 20px 40px rgba(0,0,0,.2)">
      <h3 style="margin:0 0 16px;font-size:1.1rem">Ready to Import</h3>
      ${body}
      <div style="display:flex;gap:12px;margin-top:20px;justify-content:flex-end">
        <button id="import-cancel" style="padding:8px 18px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:14px">Cancel</button>
        <button id="import-confirm" style="padding:8px 18px;border:none;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;font-size:14px;font-weight:600">Import Now</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#import-cancel').onclick  = () => modal.remove();
  modal.querySelector('#import-confirm').onclick = () => { modal.remove(); onConfirm(); };
}

/* ── Reset ───────────────────────────────────────── */

function resetCsv() {
  _wb = null; _headers = []; _rows = []; _mapping = {};
  _attrNames        = { attr1name: 'Colour', attr2name: 'Size', attr3name: 'Model' };
  _stripSuffix      = false;
  _splitAttr        = false;
  _shippingCosts    = {};
  _perRowMarkup     = [];
  _priceBands       = [{ min: null, max: null, markup: null }];
  _selectedRows     = new Set();
  _autoFetch        = false;
  _providerConfigured = false;
  _providerName     = null;
  renderBandRows();

  const stripBox = document.getElementById('csv-strip-suffix');
  if (stripBox) stripBox.checked = false;
  const splitBox = document.getElementById('csv-split-attr');
  if (splitBox) splitBox.checked = false;
  const fetchBox = document.getElementById('csv-autofetch');
  if (fetchBox) fetchBox.checked = false;
  const adjustInput = document.getElementById('csv-adjust-amount');
  if (adjustInput) adjustInput.value = '';
  const round99Box = document.getElementById('csv-round99');
  if (round99Box) round99Box.checked = false;

  document.getElementById('csv-info-bar').style.display       = 'none';
  document.getElementById('csv-title-opts').style.display     = 'none';
  document.getElementById('csv-mapper').style.display         = 'none';
  document.getElementById('csv-price-calc').style.display     = 'none';
  document.getElementById('csv-preview').style.display        = 'none';
  document.getElementById('csv-actions').style.display        = 'none';
  document.getElementById('csv-actions-top').style.display    = 'none';
  document.getElementById('csv-dest-wrap').style.display      = 'none';
  document.getElementById('csv-autofetch-wrap').style.display = 'none';
  document.getElementById('csv-shipping-status').style.display = 'none';
  document.getElementById('csv-mapper-grid').innerHTML        = '';
  document.getElementById('csv-preview-table').innerHTML      = '';
  document.getElementById('csv-file-input').value             = '';
}

function bindTitleOpts() {
  document.getElementById('csv-strip-suffix')?.addEventListener('change', (e) => {
    _stripSuffix = e.target.checked;
    renderPreview();
  });
  document.getElementById('csv-split-attr')?.addEventListener('change', (e) => {
    _splitAttr = e.target.checked;
    renderPreview();
  });
}

/* ── Bind CSV drop zone ──────────────────────────── */

function bindCsvDropZone() {
  const zone  = document.getElementById('csv-drop-zone');
  const input = document.getElementById('csv-file-input');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file).catch(err => window.showToast?.(err.message, 'error'));
  });
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) parseFile(file).catch(err => window.showToast?.(err.message, 'error'));
  });

  document.getElementById('csv-download-btn')?.addEventListener('click', downloadCSV);
  document.getElementById('csv-reset-btn')?.addEventListener('click', resetCsv);
  document.getElementById('csv-download-btn-top')?.addEventListener('click', downloadCSV);
  document.getElementById('csv-reset-btn-top')?.addEventListener('click', resetCsv);

  document.getElementById('csv-select-toggle-btn')?.addEventListener('click', () => {
    if (_selectedRows.size === _rows.length) {
      _selectedRows.clear();
    } else {
      _rows.forEach((_, i) => _selectedRows.add(i));
    }
    renderPreview();
  });

  // Top and bottom action bars each have their own "Update shipping
  // origin only" checkbox (long preview tables make the bottom one a
  // long scroll away) — keep them mirrored so ticking either one always
  // reflects the same real state, regardless of which "Import to
  // Products" link ends up being used.
  const originOnlyCbs = document.querySelectorAll('.csv-origin-only-cb');
  originOnlyCbs.forEach(cb => {
    cb.addEventListener('change', () => {
      originOnlyCbs.forEach(other => { other.checked = cb.checked; });
    });
  });

  const importHandler = (e) => {
    e.preventDefault();
    const err = validateFields();
    if (err) { window.showToast?.(err, 'error'); return; }
    showImportSummary(() => {
      sessionStorage.setItem('s4l_pending_csv', generateCSV());
      // Backfill mode — see the checkbox label. Read at click time; the
      // mirrored checkboxes above mean it doesn't matter which one the
      // vendor actually ticked.
      const isOriginOnly = Array.from(originOnlyCbs).some(cb => cb.checked);
      // TEMP DIAGNOSTIC — remove once the origin-only flag is confirmed
      // reaching the backend. Shows exactly what this code sees, right
      // when Import is clicked, independent of any caching question.
      alert('DEBUG: checkboxes found=' + originOnlyCbs.length + ', origin-only=' + isOriginOnly + ', script version marker=20260911a');
      if (isOriginOnly) {
        sessionStorage.setItem('s4l_pending_csv_origin_only', '1');
      } else {
        sessionStorage.removeItem('s4l_pending_csv_origin_only');
      }
      window.location.href = '/account/vendor/products.html';
    });
  };
  document.querySelector('.csv-go-import')?.addEventListener('click', importHandler);
  document.querySelector('.csv-go-import-top')?.addEventListener('click', importHandler);
}

bindCsvDropZone();
bindPriceCalc();
bindTitleOpts();
