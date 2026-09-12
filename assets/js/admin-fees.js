const API = window.API_BASE;

const $ = id => document.getElementById(id);

function authFetch(url, opts = {}) {
  const token = localStorage.getItem('s4l_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, credentials: 'include', headers });
}

const pct = v => (v == null ? '' : (Number(v) * 100).toFixed(2).replace(/\.?0+$/, ''));
const dec = v => (v === '' || v == null ? null : Number(v) / 100);
const fmt = v => v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`;

function setStatus(elId, msg, type) {
  const el = $(elId);
  el.textContent = msg;
  el.className = `fee-save-status ${type}`;
  if (type === 'ok') setTimeout(() => { el.textContent = ''; }, 3000);
}

/* ── Load config and populate default/tier fields ── */
async function loadConfig() {
  const res = await authFetch(`${API}/admin/config/fees`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load config');
  const { config } = await res.json();

  $('inp-commission-default').value = pct(config.commissionDefault);
  $('inp-reserve-standard').value   = pct(config.reserveRateStandard);
  $('inp-reserve-trusted').value    = pct(config.reserveRateTrusted);
  $('inp-trusted-months').value     = config.reserveTrustedMonths ?? '';

  const tiers = ['casual', 'refurbished', 'professional', 'enterprise'];
  for (const t of tiers) {
    const v = config.commissionByTier?.[t];
    $(`inp-tier-${t}`).value = v != null ? pct(v) : '';
  }
  return config;
}

/* ── Save platform defaults ── */
$('btn-save-defaults').addEventListener('click', async () => {
  const btn = $('btn-save-defaults');
  btn.disabled = true;
  try {
    const body = {
      commissionDefault:  dec($('inp-commission-default').value),
      reserveRateStandard: dec($('inp-reserve-standard').value),
      reserveRateTrusted:  dec($('inp-reserve-trusted').value),
      reserveTrustedMonths: Number($('inp-trusted-months').value) || undefined,
    };
    const res = await authFetch(`${API}/admin/config/fees`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    setStatus('status-defaults', 'Saved', 'ok');
  } catch (e) {
    setStatus('status-defaults', e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

/* ── Save tier rates ── */
$('btn-save-tiers').addEventListener('click', async () => {
  const btn = $('btn-save-tiers');
  btn.disabled = true;
  try {
    const commissionByTier = {};
    for (const t of ['casual', 'refurbished', 'professional', 'enterprise']) {
      const raw = $(`inp-tier-${t}`).value.trim();
      commissionByTier[t] = raw === '' ? null : Number(raw) / 100;
    }
    const res = await authFetch(`${API}/admin/config/fees`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionByTier }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    setStatus('status-tiers', 'Saved', 'ok');
    await loadVendors();
  } catch (e) {
    setStatus('status-tiers', e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

/* ── Founding Seller program ── */
const TIER_LIST = ['casual', 'refurbished', 'professional', 'enterprise'];

async function loadFoundingConfig() {
  const res = await authFetch(`${API}/admin/config/founding-seller`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load founding seller config');
  const { foundingSeller } = await res.json();

  $('inp-founding-cap').value = foundingSeller?.cap ?? '';
  $('inp-founding-rate').value = foundingSeller?.rate != null ? pct(foundingSeller.rate) : '';
  for (const t of TIER_LIST) {
    $(`inp-founding-${t}`).value = foundingSeller?.freeSalesByTier?.[t] ?? '';
  }
  const cap = foundingSeller?.cap ?? 0;
  const claimed = foundingSeller?.claimed ?? 0;
  $('founding-counter').textContent = `${claimed}/${cap} spots claimed`;
}

$('btn-save-founding').addEventListener('click', async () => {
  const btn = $('btn-save-founding');
  btn.disabled = true;
  try {
    const freeSalesByTier = {};
    for (const t of TIER_LIST) {
      const raw = $(`inp-founding-${t}`).value.trim();
      if (raw !== '') freeSalesByTier[t] = Number(raw);
    }
    const body = {
      cap: $('inp-founding-cap').value.trim() === '' ? undefined : Number($('inp-founding-cap').value),
      rate: $('inp-founding-rate').value.trim() === '' ? undefined : dec($('inp-founding-rate').value),
      freeSalesByTier,
    };
    const res = await authFetch(`${API}/admin/config/founding-seller`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    setStatus('status-founding', 'Saved', 'ok');
    await loadFoundingConfig();
  } catch (e) {
    setStatus('status-founding', e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

/* ── Vendor table ── */
let allVendors = [];

async function loadVendors() {
  const res = await authFetch(`${API}/admin/config/vendors`, { credentials: 'include' });
  if (!res.ok) return;
  const { vendors } = await res.json();
  allVendors = vendors;
  renderVendors(vendors);
}

function renderVendors(vendors) {
  const tbody = $('vendor-rate-table');
  if (!vendors.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="fee-loading">No vendors found.</td></tr>';
    return;
  }

  tbody.innerHTML = vendors.map(v => {
    const source = v.commissionOverride != null ? 'override' : (v.type ? 'tier' : 'default');
    const sourceLabel = v.commissionOverride != null ? 'individual override' : `${v.type || 'casual'} tier rate`;
    const overrideVal = v.commissionOverride != null ? pct(v.commissionOverride) : '';
    const fs = v.foundingSeller;

    // While a Founding Seller's free window is still active, their real
    // current rate is their own snapshotted founding rate (not necessarily
    // 0% — a later "wave" could run at a smaller discount) — show that
    // instead of the normal tier rate, with the normal rate kept visible as
    // a small aside so it's not confusing.
    const rateCell = fs?.active
      ? `${fs.rate === 0 ? 'Free (0%)' : fmt(fs.rate)} <span class="rate-source" style="color:#854d0e">founding rate, normally ${fmt(v.normalEffectiveRate)}</span>`
      : `${fmt(v.effectiveRate)} <span class="rate-source ${source}">${sourceLabel}</span>`;

    return `<tr data-id="${v._id}">
      <td>${v.storeName || v.storeSlug || '—'}</td>
      <td><span class="tier-badge ${v.type || 'casual'}">${v.type || 'casual'}</span></td>
      <td>${rateCell}</td>
      <td>
        ${fs
          ? `<span class="founding-badge">${fs.active ? 'Founding' : 'Founding (used up)'}</span><span class="founding-used">used ${fs.freeSalesUsed}/${fs.freeSalesLimit}</span>`
          : '<span class="founding-none">—</span>'}
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:6px;">
          <input class="vendor-rate-input" type="number" min="0" max="100" step="0.1"
            value="${overrideVal}" placeholder="—" data-id="${v._id}">
          <span style="font-size:13px;color:#6b7280;">%</span>
        </div>
      </td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn-vendor-save" data-id="${v._id}">Save</button>
          ${v.commissionOverride != null
            ? `<button class="btn-vendor-clear" data-id="${v._id}">Clear</button>`
            : ''}
          <span class="vendor-status-cell" id="vstatus-${v._id}"></span>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-vendor-save').forEach(btn => {
    btn.addEventListener('click', () => saveVendorRate(btn.dataset.id, false));
  });
  tbody.querySelectorAll('.btn-vendor-clear').forEach(btn => {
    btn.addEventListener('click', () => saveVendorRate(btn.dataset.id, true));
  });
}

async function saveVendorRate(vendorId, clear) {
  const row      = document.querySelector(`tr[data-id="${vendorId}"]`);
  const input    = row?.querySelector('.vendor-rate-input');
  const statusEl = $(`vstatus-${vendorId}`);

  const override = clear ? null : (input?.value.trim() === '' ? null : Number(input.value) / 100);

  try {
    const res = await authFetch(`${API}/admin/config/vendor/${vendorId}/commission`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commissionOverride: override }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');

    statusEl.textContent = 'Saved';
    statusEl.className = 'vendor-status-cell ok';
    setTimeout(() => { statusEl.textContent = ''; }, 2500);

    // Update local data and re-render
    const idx = allVendors.findIndex(v => String(v._id) === String(vendorId));
    if (idx !== -1) {
      allVendors[idx].commissionOverride = data.vendor.commissionOverride;
      // Recalc effective rate
      const v = allVendors[idx];
      v.effectiveRate = v.commissionOverride != null ? v.commissionOverride : v.effectiveRate;
    }
    await loadVendors();
  } catch (e) {
    if (statusEl) {
      statusEl.textContent = e.message;
      statusEl.className = 'vendor-status-cell err';
    }
  }
}

/* ── Search filter ── */
$('vendor-search').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  const filtered = q
    ? allVendors.filter(v =>
        (v.storeName || '').toLowerCase().includes(q) ||
        (v.type || '').toLowerCase().includes(q)
      )
    : allVendors;
  renderVendors(filtered);
});

/* ── Init ── */
(async () => {
  try {
    await loadConfig();
  } catch {
    setStatus('status-defaults', 'Failed to load config', 'err');
  }
  try {
    await loadFoundingConfig();
  } catch {
    setStatus('status-founding', 'Failed to load config', 'err');
  }
  await loadVendors();
})();
