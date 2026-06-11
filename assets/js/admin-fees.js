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
    tbody.innerHTML = '<tr><td colspan="5" class="fee-loading">No vendors found.</td></tr>';
    return;
  }

  tbody.innerHTML = vendors.map(v => {
    const source = v.commissionOverride != null ? 'override' : (v.type ? 'tier' : 'default');
    const sourceLabel = v.commissionOverride != null ? 'individual override' : `${v.type || 'casual'} tier rate`;
    const overrideVal = v.commissionOverride != null ? pct(v.commissionOverride) : '';

    return `<tr data-id="${v._id}">
      <td>${v.storeName || v.storeSlug || '—'}</td>
      <td><span class="tier-badge ${v.type || 'casual'}">${v.type || 'casual'}</span></td>
      <td>
        ${fmt(v.effectiveRate)}
        <span class="rate-source ${source}">${sourceLabel}</span>
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
  await loadVendors();
})();
