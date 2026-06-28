/* ======================================================
   SELL4LIFE — VENDOR PRODUCTS
====================================================== */

const IMAGE_BASE = '/assets/images/products/';
const TIER_RANK_VP = { casual: 1, refurbished: 2, professional: 3, enterprise: 4 };
const _isPro = (TIER_RANK_VP[localStorage.getItem('s4l_vendorType')] || 1) >= 3;

let _allProducts = [];
let _archivedProducts = [];
let _trashedProducts = [];
let _currentView = 'grid';
let _currentStatus = 'all';
let _currentSort = 'newest';
let _searchQuery = '';
const _selected = new Set();

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
  if (stock === 0) return { cls: 'vp-stock-zero', label: '⚠ Out of stock' };
  if (stock <= 5)  return { cls: 'vp-stock-low',  label: `⚠ Low: ${stock}` };
  return { cls: '', label: `Stock: ${stock}` };
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
        ${p.comingSoon ? '<span class="vp-badge vp-badge-coming-soon">🕐 Coming Soon</span>' : ''}
        ${p.supplierUrl ? `<a href="${p.supplierUrl}" target="_blank" rel="noopener" class="vp-supplier-link" title="Open supplier listing" draggable="false">🔗</a>` : ''}
      </div>

      <div class="vp-card-body">
        <h3 class="vp-name">${p.name || 'Unnamed product'}</h3>

        ${p.category ? `<div class="product-cat">${fmt(p.category)}${p.subcategory ? ' / ' + fmt(p.subcategory) : ''}</div>` : ''}

        <div class="vp-price-row">
          <span class="price">£${Number(p.price || 0).toFixed(2)}</span>
          ${p.comparePrice ? `<span class="vp-compare">£${Number(p.comparePrice).toFixed(2)}</span>` : ''}
        </div>

        <div class="stock ${cls}">${label}</div>
      </div>

      <div class="vendor-product-actions">
        <a href="/account/vendor/edit-product.html?id=${id}" class="btn-edit" draggable="false">Edit</a>
        <a href="/product/product.html?id=${id}" class="btn-view-store" target="_blank" rel="noopener" draggable="false">View</a>
        ${_isPro ? `<button class="btn-duplicate" data-id="${id}" title="Duplicate as draft">Copy</button>` : ''}
        ${p.archived
          ? `<button class="btn-unarchive" data-id="${id}">Unarchive</button>`
          : `<button class="btn-coming-soon-toggle${p.comingSoon ? ' is-coming-soon' : ''}" data-id="${id}" title="${p.comingSoon ? 'Click to unblock — Coming Soon is ON' : 'Click to enable Coming Soon'}">🕐</button>
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
      ${p.supplierUrl ? `<a href="${p.supplierUrl}" target="_blank" rel="noopener" class="vp-supplier-link vp-supplier-link-list" title="Open supplier listing" draggable="false">🔗</a>` : ''}

      <div class="vp-list-info">
        <div class="vp-list-name">${p.name || 'Unnamed product'}</div>
        ${p.category ? `<div class="product-cat">${fmt(p.category)}${p.subcategory ? ' / ' + fmt(p.subcategory) : ''}</div>` : ''}
        ${p.sku ? `<div class="vp-list-sku">SKU: ${p.sku}</div>` : ''}
      </div>

      <span class="vp-badge ${active ? 'vp-badge-active' : 'vp-badge-draft'}">${active ? 'Active' : 'Draft'}</span>
      ${p.comingSoon ? '<span class="vp-badge vp-badge-coming-soon">🕐 Coming Soon</span>' : ''}

      <div class="vp-list-price">
        <span class="price">£${Number(p.price || 0).toFixed(2)}</span>
        ${p.comparePrice ? `<span class="vp-compare">£${Number(p.comparePrice).toFixed(2)}</span>` : ''}
      </div>

      <div class="stock ${cls}">${label}</div>

      <div class="vp-list-actions">
        <a href="/account/vendor/edit-product.html?id=${id}" class="btn-edit" draggable="false">Edit</a>
        <a href="/product/product.html?id=${id}" class="btn-view-store" target="_blank" rel="noopener" draggable="false">View</a>
        ${_isPro ? `<button class="btn-duplicate" data-id="${id}" title="Duplicate as draft">Copy</button>` : ''}
        ${p.archived
          ? `<button class="btn-unarchive" data-id="${id}">Unarchive</button>`
          : `<button class="btn-coming-soon-toggle${p.comingSoon ? ' is-coming-soon' : ''}" data-id="${id}" title="${p.comingSoon ? 'Disable Coming Soon' : 'Enable Coming Soon'}">🕐 ${p.comingSoon ? 'Unblock' : 'Coming Soon'}</button>
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
  const bulkComingSoon = document.getElementById('btn-bulk-coming-soon');
  const bulkArchive    = document.getElementById('btn-bulk-archive');
  const bulkUnarchive  = document.getElementById('btn-bulk-unarchive');
  const bulkDelete     = document.getElementById('btn-bulk-delete');
  const bulkRestoreTr  = document.getElementById('btn-bulk-restore-trash');
  const bulkEmptyTrash = document.getElementById('btn-bulk-empty-trash');
  if (bulkPrice)      bulkPrice.hidden      = isTrashMode;
  if (bulkStock)      bulkStock.hidden      = isTrashMode;
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

    const msg = _searchQuery || _currentStatus !== 'all'
      ? 'No products match your filters.'
      : 'No products yet.';
    container.innerHTML = `
      <div class="vp-empty">
        <p>${msg}</p>
        ${!_searchQuery && _currentStatus === 'all'
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

function bindToolbar() {
  const search = document.getElementById('vp-search');
  if (search) {
    search.addEventListener('input', e => {
      _searchQuery = e.target.value.trim();
      renderProducts();
    });
  }

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

  document.querySelectorAll('.vp-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.vp-view-btn').forEach(b => b.classList.remove('active'));
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

function updateBulkBar() {
  const bar   = document.getElementById('vp-bulk-bar');
  const count = document.getElementById('vp-bulk-count');
  const selAll = document.getElementById('vp-select-all');
  if (!bar) return;
  bar.hidden = _selected.size === 0;
  if (count) count.textContent = `${_selected.size} selected`;
  if (selAll) {
    const vis = visibleIds();
    selAll.checked = vis.length > 0 && vis.every(id => _selected.has(id));
    selAll.indeterminate = !selAll.checked && _selected.size > 0;
  }

  // Coming Soon bulk button reflects whether the current selection is
  // already all Coming Soon — so clicking it does the obvious opposite.
  const bulkComingSoonBtn = document.getElementById('btn-bulk-coming-soon');
  if (bulkComingSoonBtn && _selected.size > 0) {
    const selectedProducts = [..._selected].map(id => _allProducts.find(p => (p._id || p.id) === id)).filter(Boolean);
    const allAlreadyComingSoon = selectedProducts.length > 0 && selectedProducts.every(p => p.comingSoon);
    bulkComingSoonBtn.textContent = allAlreadyComingSoon ? '✓ Unblock' : '🕐 Coming Soon';
    bulkComingSoonBtn.dataset.target = allAlreadyComingSoon ? 'false' : 'true';
  }
}

function toggleSelect(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  const cb   = card?.querySelector('.vp-select-cb');
  if (_selected.has(id)) {
    _selected.delete(id);
    card?.classList.remove('vp-selected');
    if (cb) cb.checked = false;
  } else {
    _selected.add(id);
    card?.classList.add('vp-selected');
    if (cb) cb.checked = true;
  }
  updateBulkBar();
}

// Click anywhere on card to select (ignore action buttons/links)
document.addEventListener('click', (e) => {
  if (e.target.closest('.vendor-product-actions, .vp-list-actions, a, button')) return;
  const card = e.target.closest('.vendor-product-card, .vp-list-row');
  if (!card) return;
  toggleSelect(card.dataset.id);
});

// Checkbox still works independently
document.addEventListener('change', (e) => {
  if (!e.target.classList.contains('vp-select-cb')) return;
  toggleSelect(e.target.dataset.id);
});

document.getElementById('vp-select-all')?.addEventListener('change', (e) => {
  visibleIds().forEach(id => {
    if (e.target.checked) _selected.add(id);
    else _selected.delete(id);
    const card = document.querySelector(`[data-id="${id}"]`);
    const cb   = card?.querySelector('.vp-select-cb');
    card?.classList.toggle('vp-selected', e.target.checked);
    if (cb) cb.checked = e.target.checked;
  });
  updateBulkBar();
});

document.getElementById('btn-bulk-clear')?.addEventListener('click', () => {
  _selected.clear();
  document.querySelectorAll('.vp-select-cb').forEach(cb => cb.checked = false);
  document.querySelectorAll('.vp-selected').forEach(el => el.classList.remove('vp-selected'));
  updateBulkBar();
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

  const bar = document.getElementById('vp-bulk-bar');
  if (bar) bar.querySelector('.vp-bulk-actions').innerHTML = `<span class="vp-bulk-spinner"></span><span style="font-size:0.85rem;color:#6b7280">Processing…</span>`;

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

document.getElementById('btn-bulk-price')?.addEventListener('click', () => {
  const panel = document.getElementById('vp-bulk-edit-panel');
  const label = document.getElementById('vp-bulk-edit-label');
  const input = document.getElementById('vp-bulk-edit-value');
  if (label) label.textContent = 'Set price (£)';
  if (input) { input.type = 'number'; input.value = ''; }
  if (panel) panel.hidden = false;
  if (input) input.focus();
  if (panel) panel.dataset.mode = 'price';
});

document.getElementById('btn-bulk-stock')?.addEventListener('click', () => {
  const panel = document.getElementById('vp-bulk-edit-panel');
  const label = document.getElementById('vp-bulk-edit-label');
  const input = document.getElementById('vp-bulk-edit-value');
  if (label) label.textContent = 'Set stock (qty)';
  if (input) { input.type = 'number'; input.value = ''; input.step = '1'; }
  if (panel) panel.hidden = false;
  if (input) input.focus();
  if (panel) panel.dataset.mode = 'stock';
});

document.getElementById('btn-bulk-edit-cancel')?.addEventListener('click', () => {
  const panel = document.getElementById('vp-bulk-edit-panel');
  if (panel) { panel.hidden = true; delete panel.dataset.mode; }
});

document.getElementById('btn-bulk-edit-apply')?.addEventListener('click', async () => {
  const panel = document.getElementById('vp-bulk-edit-panel');
  const input = document.getElementById('vp-bulk-edit-value');
  const mode = panel?.dataset.mode;
  const value = input?.value?.trim();

  if (!mode || !value) return;
  if (_selected.size === 0) { window.showToast?.('No products selected', 'error'); return; }

  const token = localStorage.getItem('s4l_token');
  const ids = [..._selected];
  const n = ids.length;
  const field = mode === 'price' ? 'price' : 'stock';
  const fieldVal = mode === 'price' ? parseFloat(value) : parseInt(value, 10);

  if (isNaN(fieldVal) || fieldVal < 0) {
    window.showToast?.(`Invalid ${field}`, 'error');
    return;
  }

  const msg = `Update ${field} to ${fieldVal} for ${n} product${n > 1 ? 's' : ''}?`;
  const confirmed = await window.confirmAction?.(msg);
  if (!confirmed) return;

  const actBtn = document.getElementById('btn-bulk-edit-apply');
  if (actBtn) { actBtn.disabled = true; actBtn.textContent = 'Applying…'; }

  try {
    const body = { ids };
    if (mode === 'price') body.price = fieldVal;
    else body.stock = fieldVal;

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
      if (ids.includes(pid)) {
        if (mode === 'price') p.price = fieldVal;
        else p.stock = fieldVal;
      }
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
    window.showToast?.('Product recovered ✓');
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
    window.showToast?.(newVal ? '🕐 Coming Soon enabled' : '✓ Product unblocked');
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    btn.textContent = '🕐';
    window.showToast?.('Update failed', 'error');
  }
});

/* ── CSV Import ──────────────────────────────────── */

function showCsvResult(created, skipped, skippedDetails) {
  const existing = document.getElementById('csv-result-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'csv-result-banner';

  if (skipped === 0) {
    banner.className = 'csv-result success';
    banner.textContent = `✓ ${created} product${created !== 1 ? 's' : ''} imported successfully.`;
  } else if (created === 0) {
    banner.className = 'csv-result error';
    banner.textContent = `Import failed — ${skipped} row${skipped !== 1 ? 's' : ''} had errors. Check your CSV and try again.`;
  } else {
    banner.className = 'csv-result partial';
    banner.textContent = `${created} imported, ${skipped} skipped (errors on rows: ${skippedDetails.map(s => s.row).join(', ')}).`;
  }

  const header = document.querySelector('.vp-page-header');
  header?.insertAdjacentElement('afterend', banner);
  setTimeout(() => banner.remove(), 8000);
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
        showCsvResult(0, 1, [{ row: '—', reason: data.error || 'Unknown error' }]);
      } else {
        showCsvResult(data.created, data.skipped, data.skippedDetails || []);
        if (data.created > 0) await loadVendorProducts();
      }
    } catch (err) {
      console.error('CSV import error:', err);
      showCsvResult(0, 1, [{ row: '—', reason: 'Network error' }]);
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

  if (csvBtn) { csvBtn.textContent = 'Importing...'; csvBtn.disabled = true; }

  try {
    const token = localStorage.getItem('s4l_token');
    const res = await fetch(`${window.API_BASE}/vendor/products/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv', Authorization: `Bearer ${token}` },
      body: csv,
    });
    const data = await res.json();
    if (!res.ok) {
      showCsvResult(0, 1, [{ row: '—', reason: data.error || 'Unknown error' }]);
    } else {
      showCsvResult(data.created, data.skipped, data.skippedDetails || []);
      if (data.created > 0) await loadVendorProducts();
    }
  } catch (err) {
    console.error('CSV import error:', err);
    showCsvResult(0, 1, [{ row: '—', reason: 'Network error' }]);
  } finally {
    if (csvBtn) { csvBtn.textContent = '↑ Import CSV'; csvBtn.disabled = false; }
  }
}

/* ── Start ───────────────────────────────────────── */

loadVendorProducts().then(runPendingCsvImport);
