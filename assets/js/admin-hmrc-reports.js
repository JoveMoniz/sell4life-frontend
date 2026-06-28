// ======================================================
// ADMIN — HMRC REPORTS
// ======================================================

const API = window.API_BASE;

function authFetch(url, opts = {}) {
  const token = localStorage.getItem('s4l_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, credentials: 'include', headers });
}

function fmt(n) { return '£' + Number(n || 0).toFixed(2); }

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ======================================================
   YEAR SELECT
====================================================== */
const yearSelect = document.getElementById('hmrc-year');
const currentYear = new Date().getFullYear();
for (let y = currentYear; y >= currentYear - 4; y--) {
  const opt = document.createElement('option');
  opt.value = y;
  opt.textContent = y;
  yearSelect.appendChild(opt);
}
yearSelect.value = currentYear;

/* ======================================================
   LOAD REPORT
====================================================== */
async function loadReport(year) {
  const summary = document.getElementById('hmrc-summary');
  const tbody   = document.getElementById('hmrc-tbody');

  summary.innerHTML = '<div class="hmrc-empty">Loading…</div>';
  tbody.innerHTML   = '<tr><td colspan="8" class="hmrc-empty">Loading…</td></tr>';

  try {
    const res = await authFetch(`${API}/admin/vendors/hmrc-report?year=${year}`);
    if (res.status === 401) { window.location.href = '/account/admin/signin.html'; return; }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      tbody.innerHTML = `<tr><td colspan="8" class="hmrc-empty" style="color:#b91c1c">${esc(err.error || 'Failed to load')}</td></tr>`;
      return;
    }
    const data = await res.json();
    render(data);
  } catch (err) {
    console.error('HMRC report load error:', err);
    tbody.innerHTML = '<tr><td colspan="8" class="hmrc-empty" style="color:#b91c1c">Failed to load report.</td></tr>';
  }
}

/* ======================================================
   RENDER
====================================================== */
function render(data) {
  const { vendors, summary, year } = data;

  // Summary cards
  document.getElementById('hmrc-summary').innerHTML = `
    <div class="hmrc-card">
      <div class="hmrc-card-label">Threshold Crossed</div>
      <div class="hmrc-card-value amber">${summary.total}</div>
    </div>
    <div class="hmrc-card">
      <div class="hmrc-card-label">Tax Info Complete</div>
      <div class="hmrc-card-value green">${summary.completed}</div>
    </div>
    <div class="hmrc-card">
      <div class="hmrc-card-label">Still Incomplete</div>
      <div class="hmrc-card-value red">${summary.incomplete}</div>
    </div>`;

  // Table rows
  const tbody = document.getElementById('hmrc-tbody');
  if (!vendors.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="hmrc-empty">No vendors have crossed the reporting threshold in ${year}.</td></tr>`;
    return;
  }

  const TAX_TYPE_LABEL = { ni: 'NI Number', utr: 'UTR', other: 'Other' };

  tbody.innerHTML = vendors.map(v => {
    const submittedDate = v.taxInfoCompletedAt
      ? new Date(v.taxInfoCompletedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';
    const statusBadge = v.taxInfoCompleted
      ? '<span class="status-badge completed">Completed</span>'
      : '<span class="status-badge incomplete">Incomplete</span>';
    const idType = v.taxIdType ? (TAX_TYPE_LABEL[v.taxIdType] || esc(v.taxIdType)) : '—';

    return `<tr>
      <td><a href="/account/admin/vendors.html?id=${esc(v._id)}" style="color:#0b6b6a;font-weight:600">${esc(v.storeName)}</a></td>
      <td style="color:#6b7280;font-size:12px">${esc(v.email || '—')}</td>
      <td class="hmrc-num">${v.transactionCount}</td>
      <td class="hmrc-num">${fmt(v.grossPayoutTotal)}</td>
      <td>${statusBadge}</td>
      <td style="font-size:12px;color:#6b7280">${submittedDate}</td>
      <td style="font-family:monospace;font-size:12px">${esc(v.maskedTaxId || '—')}</td>
      <td style="font-size:12px;color:#6b7280">${idType}</td>
    </tr>`;
  }).join('');
}

/* ======================================================
   CSV EXPORT
====================================================== */
document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const year = yearSelect.value;
  const btn  = document.getElementById('btn-export-csv');
  btn.disabled = true;
  btn.textContent = 'Exporting…';
  try {
    const token = localStorage.getItem('s4l_token');
    const res = await fetch(`${API}/admin/vendors/hmrc-export?year=${year}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Export failed');
      return;
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `hmrc-report-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export error:', err);
    alert('Export failed — check console.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Export CSV';
  }
});

/* ======================================================
   YEAR CHANGE
====================================================== */
yearSelect.addEventListener('change', () => loadReport(yearSelect.value));

/* ======================================================
   INIT
====================================================== */
loadReport(currentYear);
