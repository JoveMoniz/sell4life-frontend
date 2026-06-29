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
  { key: 'attr2value',         label: 'Variant Attribute 2 — Column', required: false, isAttr: true, attrNameKey: 'attr2name', attrDefault: '' },
  { key: 'attr3value',         label: 'Variant Attribute 3 — Column', required: false, isAttr: true, attrNameKey: 'attr3name', attrDefault: '' },
  { key: 'costPrice',          label: 'Cost Price',           required: false },
  { key: 'price',              label: 'Retail Price (£)',     required: false },
  { key: 'comparePrice',       label: 'Compare Price',        required: false },
  { key: 'shippingCost',       label: 'Shipping Cost',        required: false },
  { key: 'stock',              label: 'Stock / Qty',          required: false },
  { key: 'category',           label: 'Category',             required: false },
  { key: 'subcategory',        label: 'Subcategory',          required: false },
  { key: 'sku',                label: 'SKU',                  required: false },
  { key: 'supplierVariantRef', label: 'Supplier Variant ID',  required: false },
  { key: 'supplierName',       label: 'Supplier Name',        required: false },
  { key: 'description',        label: 'Description',          required: false },
  { key: 'image1',             label: 'Image 1 URL',          required: false },
  { key: 'image2',             label: 'Image 2 URL',          required: false },
];

const AUTO_HINTS = {
  name:               ['name','product name','title','product title','item name','item','product'],
  price:              ['price','sale price','unit price','selling price','retail','retail price'],
  costPrice:          ['cost','cost price','item cost','unit cost','purchase price','buy price','supplier price','wholesale'],
  comparePrice:       ['compare price','compare at price','original price','was','rrp','msrp','was price'],
  shippingCost:       ['shipping','shipping cost','delivery','postage','freight','ship cost'],
  stock:              ['stock','quantity','qty','inventory','available','units'],
  category:           ['category','cat','type','product type','department'],
  subcategory:        ['subcategory','sub category','sub-category','subtype','subcategory'],
  sku:                ['sku','product code','item code','barcode','upc','isbn','ref','product id'],
  description:        ['description','desc','details','product description','body','notes','overview','long description'],
  image1:             ['image','image1','image 1','image url','photo','picture','img','main image','thumbnail'],
  attr1value:         ['variant','variation','option','color','colour','specification','spec'],
  image2:             ['image2','image 2','photo2','picture2','secondary image','image url 2'],
  supplierVariantRef: ['variant id','variant ref','supplier variant ref','supplier variant id','vid','variantid','supplier id'],
  supplierName:       ['supplier','supplier name','vendor name','brand'],
};

/* ── State ───────────────────────────────────────── */

let _wb               = null;
let _headers          = [];
let _rows             = [];
let _mapping          = {};
let _attrNames        = { attr1name: 'Colour', attr2name: '', attr3name: '' };
let _stripSuffix      = false;
let _shippingCosts    = {};    // rowIndex → { cost, currency, etaDays } | null
let _perRowMarkup     = [];    // rowIndex → number | null (null = use global)
let _selectedRows     = new Set(); // rowIndex → included in export/import
let _destCountry      = 'GB';
let _autoFetch        = false;
let _providerConfigured = false;
let _providerName     = null;

function stripTrailingCode(name) {
  return String(name).replace(/\s+\d{3,8}$/, '').trim();
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

// Returns shipping in source currency for a given row (fetched or from mapped column).
function getRowShipping(rowIndex) {
  const fetched = _shippingCosts[rowIndex];
  if (fetched != null) return fetched.cost;
  const col = _mapping['shippingCost'];
  if (col && _rows[rowIndex]) {
    const v = parseFloat(String(_rows[rowIndex][col]).replace(/[^0-9.-]/g, ''));
    if (!isNaN(v)) return v;
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
  return (trueCost * (1 + markup / 100)).toFixed(2);
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

  const statusEl = document.getElementById('csv-shipping-status');
  if (statusEl) { statusEl.style.display = ''; statusEl.textContent = 'Fetching shipping costs…'; }

  const items = _rows
    .map((row, i) => ({ supplierVariantRef: String(row[col] ?? '').trim(), rowIndex: i }))
    .filter(x => x.supplierVariantRef);

  if (!items.length) {
    if (statusEl) statusEl.textContent = 'No variant IDs found in the mapped column.';
    return;
  }

  try {
    const token = localStorage.getItem('s4l_token');
    if (!token) { if (statusEl) statusEl.textContent = 'Not authenticated.'; return; }

    const CHUNK = 30;
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
}

function togglePriceCalc() {
  const hasCost  = !!_mapping['costPrice'];
  const hasPrice = !!_mapping['price'];
  const wrap = document.getElementById('csv-price-calc');
  if (wrap) wrap.style.display = (hasCost || hasPrice) ? '' : 'none';
  updateAutofetchVisibility();
  updateCalcExample();
}

/* ── Load sheet from workbook ────────────────────── */

function loadSheet(sheetName) {
  if (!_wb) return;
  const ws  = _wb.Sheets[sheetName];
  const raw = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let headerRow = 0;
  while (headerRow < raw.length && raw[headerRow].every(c => c === '')) headerRow++;
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
  _selectedRows  = new Set(_rows.map((_, i) => i));
  _mapping = autoDetect(_headers);
  renderMapper();
  renderPreview();
  showActions();
  const titleOpts = document.getElementById('csv-title-opts');
  if (titleOpts) titleOpts.style.display = '';
  checkProviderStatus();
}

/* ── Parse uploaded file ─────────────────────────── */

async function parseFile(file) {
  await loadXLSX();
  const buf = await file.arrayBuffer();
  _wb = window.XLSX.read(buf, { type: 'array' });

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

  inner.innerHTML = S4L_FIELDS.map(({ key, label, required, isAttr, attrNameKey, attrDefault }) => `
    <div class="csv-map-row">
      <label class="csv-map-label">
        ${label}${required ? '<span class="csv-required-mark"> *</span>' : ''}
      </label>
      ${isAttr ? `
        <input type="text" class="csv-map-select csv-attr-name-input" data-attr-key="${attrNameKey}"
          placeholder="Attribute name, e.g. ${attrDefault || 'Model'}" value="${_attrNames[attrNameKey] || ''}"
          style="margin-bottom:4px" />
      ` : ''}
      <select class="csv-map-select" data-key="${key}">
        ${opts}
      </select>
      <span class="csv-map-preview" id="csv-mp-${key}"></span>
    </div>
  `).join('');

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

  inner.querySelectorAll('.csv-attr-name-input').forEach(input => {
    const attrKey = input.dataset.attrKey;
    input.addEventListener('input', () => {
      _attrNames[attrKey] = input.value.trim();
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

  const mapped = S4L_FIELDS.filter(f => _mapping[f.key]);
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
      } else {
        val = raw;
      }
      return `<td>${escCsv(val)}</td>`;
    }).join('');

    if (useTrueCost) {
      const costRaw  = parseFloat(String(row[_mapping['costPrice']] ?? '').replace(/[^0-9.-]/g, '')) || 0;
      const shipUSD  = getRowShipping(i);
      const hasShip  = _shippingCosts[i] != null;
      const trueCost = ((costRaw + shipUSD) * rate).toFixed(2);
      cells += `<td>£${(costRaw * rate).toFixed(2)}</td>`
             + `<td>${hasShip ? `£${(shipUSD * rate).toFixed(2)}` : '<span style="color:#9ca3af">—</span>'}</td>`
             + `<td>£${trueCost}</td>`
             + `<td><input type="number" class="csv-row-markup" data-row="${i}" min="0" max="999" value="${markup}" style="width:60px;border:1px solid #d1d5db;border-radius:4px;padding:2px 4px;font-size:12px" /></td>`;
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
}

function updateSelectedCount() {
  const label = document.getElementById('csv-row-count');
  if (!label) return;
  const total    = _rows.length;
  const selected = _selectedRows.size;
  label.textContent = selected === total ? `${total} rows` : `${selected} of ${total} rows selected`;
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
  'price', 'comparePrice', 'costPrice', 'shippingCost', 'stock',
  'category', 'subcategory', 'sku', 'supplierVariantRef', 'supplierName',
  'description', 'image1', 'image2',
];

function getOutputValue(row, key, rowIndex = 0) {
  if (key === 'attr1name') return _mapping.attr1value ? (_attrNames.attr1name || '') : '';
  if (key === 'attr2name') return _mapping.attr2value ? (_attrNames.attr2name || '') : '';
  if (key === 'attr3name') return _mapping.attr3value ? (_attrNames.attr3name || '') : '';

  const col    = _mapping[key];
  const raw    = col ? String(row[col] ?? '') : '';
  const markup = _perRowMarkup[rowIndex] != null ? _perRowMarkup[rowIndex] : getMarkup();

  if (key === 'price') {
    if (_mapping['costPrice']) {
      const costRaw = String(row[_mapping['costPrice']] ?? '');
      return applyPriceCalc(costRaw, getRowShipping(rowIndex), markup) || '';
    }
    return applyPriceCalc(raw, 0, markup) || raw;
  }

  if (key === 'shippingCost') {
    const fetched = _shippingCosts[rowIndex];
    if (fetched != null) return (fetched.cost * getCurrencyRate()).toFixed(2);
    return raw;
  }

  if (key === 'name' && _stripSuffix) return raw ? stripTrailingCode(raw) : '';
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
  _attrNames        = { attr1name: 'Colour', attr2name: '', attr3name: '' };
  _stripSuffix      = false;
  _shippingCosts    = {};
  _perRowMarkup     = [];
  _selectedRows     = new Set();
  _autoFetch        = false;
  _providerConfigured = false;
  _providerName     = null;

  const stripBox = document.getElementById('csv-strip-suffix');
  if (stripBox) stripBox.checked = false;
  const fetchBox = document.getElementById('csv-autofetch');
  if (fetchBox) fetchBox.checked = false;

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

  document.getElementById('csv-select-all-btn')?.addEventListener('click', () => {
    _rows.forEach((_, i) => _selectedRows.add(i));
    renderPreview();
  });
  document.getElementById('csv-deselect-all-btn')?.addEventListener('click', () => {
    _selectedRows.clear();
    renderPreview();
  });

  const importHandler = (e) => {
    e.preventDefault();
    const err = validateFields();
    if (err) { window.showToast?.(err, 'error'); return; }
    showImportSummary(() => {
      sessionStorage.setItem('s4l_pending_csv', generateCSV());
      window.location.href = '/account/vendor/products.html';
    });
  };
  document.querySelector('.csv-go-import')?.addEventListener('click', importHandler);
  document.querySelector('.csv-go-import-top')?.addEventListener('click', importHandler);
}

bindCsvDropZone();
bindPriceCalc();
bindTitleOpts();
