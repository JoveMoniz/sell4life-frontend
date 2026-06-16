// ======================================================
// VENDOR PAYOUTS — v3
// ======================================================

const API = window.API_BASE;

const PERIOD_LABELS = {
  all: 'All Time', today: 'Today', week: 'This Week',
  month: 'This Month', rolling12: 'Last 12 Months', year: 'Year to Date',
};
const PERIOD_SUBLABELS = {
  all: 'all time', today: 'today', week: 'this week',
  month: 'this month', rolling12: 'last 12 months', year: 'year to date',
};

function authFetch(url, opts = {}) {
  const token = localStorage.getItem('s4l_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, credentials: 'include', headers });
}

function fmt(n) { return '£' + Number(n || 0).toFixed(2); }

async function load(period = 'all') {
  const wrap = document.getElementById('payouts-wrap');
  if (!wrap) return;
  const url = period && period !== 'all'
    ? `${API}/vendor/payouts?period=${encodeURIComponent(period)}`
    : `${API}/vendor/payouts`;
  try {
    const res = await authFetch(url);
    if (res.status === 401) { window.location.href = '/account/signin.html'; return; }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      wrap.innerHTML = `<p style="color:#b91c1c">${err.error || 'Failed to load payouts.'}</p>`;
      return;
    }
    const data = await res.json();
    render(data, wrap);
  } catch (err) {
    console.error('Payouts load error:', err);
    if (wrap) wrap.innerHTML = '<p style="color:#b91c1c">Failed to load payouts.</p>';
  }
}

function buildScheduleSection(schedule) {
  if (!schedule || !schedule.length) return '';
  const rows = schedule.map(r => {
    const label = new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#fff;border-radius:6px;border:1px solid #fef3c7;font-size:0.88rem;margin-bottom:4px">'
      + '<span style="color:#374151;font-weight:500">' + label + '</span>'
      + '<span style="color:#059669;font-weight:700">+' + fmt(r.amount) + '</span>'
      + '</div>';
  }).join('');
  return '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:24px">'
    + '<div style="font-size:0.9rem;font-weight:700;color:#92400e;margin-bottom:4px">Upcoming Reserve Releases</div>'
    + '<p style="font-size:0.78rem;color:#b45309;margin:0 0 12px">Your 10% reserve releases automatically — here\'s exactly when each amount becomes available:</p>'
    + rows
    + '</div>';
}

function render(data, wrap) {
  const b = data;
  const payouts = data.payouts || [];
  const period = data.period || 'all';
  const ps = data.periodStats;
  const subLabel = PERIOD_SUBLABELS[period] || 'all time';

  const holdDays = data.holdDays || 30;
  const holdLabel = holdDays < 1/24
    ? `${Math.round(holdDays * 24 * 60)} minute${Math.round(holdDays * 24 * 60) !== 1 ? 's' : ''}`
    : holdDays < 1
    ? `${Math.round(holdDays * 24)} hour${Math.round(holdDays * 24) !== 1 ? 's' : ''}`
    : `${holdDays} day${holdDays !== 1 ? 's' : ''}`;
  const nextDate = data.nextClearanceDate
    ? new Date(data.nextClearanceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const holdNote = b.pendingBalance === 0 && nextDate
    ? `<p style="font-size:12px;color:#6b7280;margin:8px 0 0">
        Funds are held for ${holdLabel} after delivery. Next release: <strong>${nextDate}</strong>.
       </p>`
    : b.pendingBalance === 0
    ? `<p style="font-size:12px;color:#6b7280;margin:8px 0 0">
        No delivered orders yet. Funds are released ${holdLabel} after delivery.
       </p>`
    : '';

  const requestSection = data.hasPendingRequest
    ? `<div class="payout-pending-note">
        You have a payout request pending. Once processed by admin it will appear in the history below.
       </div>`
    : `<div class="payout-request-box">
        <h3>Request a Payout</h3>
        <p style="font-size:13px;color:#374151;margin:0 0 12px">
          Available balance: <strong>${fmt(b.pendingBalance)}</strong>
          ${b.pendingBalance > 0 && b.pendingBalance < data.minimumPayout
            ? `<span style="color:#9ca3af;margin-left:6px">(minimum ${fmt(data.minimumPayout)})</span>`
            : ''}
        </p>
        <button type="button" class="payout-request-btn" id="request-btn"
          ${b.pendingBalance < data.minimumPayout ? 'disabled' : ''}>
          Request ${fmt(b.pendingBalance)}
        </button>
        ${holdNote}
        <div class="payout-msg" id="payout-msg"></div>
       </div>`;

  const historyRows = payouts.length
    ? payouts.map(p => {
        const date = new Date(p.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const paidDate = p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        return `<tr>
          <td>${date}</td>
          <td><strong>${fmt(p.amount)}</strong></td>
          <td><span class="payout-status ${p.status}">${p.status}</span></td>
          <td>${paidDate}</td>
          <td style="font-size:11px;color:#6b7280">${p.reference || '—'}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="5" class="payout-empty">No payout history yet.</td></tr>`;

  // Net sales + commission are period-sensitive; stripe fees + reserve are always all-time totals
  const netSalesVal   = ps ? ps.netAfterFees   : b.netAfterFeesAllTime;
  const commissionVal = ps ? ps.commissionPaid : b.commissionAllTime;

  wrap.innerHTML = `
    <div class="payout-cards">
      <div class="payout-card">
        <div class="payout-card-label">Available</div>
        <div class="payout-card-value highlight">${fmt(b.pendingBalance)}</div>
        <div class="payout-card-sub">ready to request</div>
      </div>
      <div class="payout-card">
        <div class="payout-card-label">Net Sales</div>
        <div class="payout-card-value">${fmt(netSalesVal)}</div>
        <div class="payout-card-sub">${subLabel}, after commission</div>
      </div>
      <div class="payout-card">
        <div class="payout-card-label">Shipping Collected</div>
        <div class="payout-card-value">${fmt(b.shippingAllTime || 0)}</div>
        <div class="payout-card-sub">all time, passes through to you</div>
      </div>
      <div class="payout-card">
        <div class="payout-card-label">Total Paid Out</div>
        <div class="payout-card-value">${fmt(b.totalPaidOut)}</div>
        <div class="payout-card-sub">received so far</div>
      </div>
      <div class="payout-card">
        <div class="payout-card-label">Commission Paid</div>
        <div class="payout-card-value negative">${fmt(commissionVal)}</div>
        <div class="payout-card-sub">platform fee, ${subLabel}</div>
      </div>
      ${b.vendorType === 'casual' ? `
      <div class="payout-card">
        <div class="payout-card-label">Your Rate</div>
        <div class="payout-card-value">${Math.round((b.commissionRate || 0.08) * 100)}%</div>
        <div class="payout-card-sub">current platform fee</div>
      </div>` : ''}
      <div class="payout-card">
        <div class="payout-card-label">Stripe Fees</div>
        <div class="payout-card-value" style="color:#1d4ed8">${fmt(b.totalStripeFees)}</div>
        <div class="payout-card-sub">all time, covered by platform</div>
      </div>
      <div class="payout-card">
        <div class="payout-card-label">In Reserve</div>
        <div class="payout-card-value" style="color:#f59e0b">${fmt(b.reservedBalance)}</div>
        <div class="payout-card-sub">current total · releases at 90 days</div>
      </div>
      ${b.vendorType === 'casual' ? `
      <div class="payout-card">
        <div class="payout-card-label">Reserve Rate</div>
        <div class="payout-card-value">${Math.round((b.reserveRate || 0.10) * 100)}%</div>
        <div class="payout-card-sub">current reserve hold${b.trustedSeller ? ' · ✓ Trusted' : ''}</div>
      </div>` : ''}
    </div>

    ${requestSection}

    ${buildScheduleSection(b.reserveSchedule)}

    <div class="payout-history-title">Payout History</div>
    <table class="payout-table">
      <thead>
        <tr>
          <th>Requested</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Paid On</th>
          <th>Reference</th>
        </tr>
      </thead>
      <tbody>${historyRows}</tbody>
    </table>
  `;

  const btn = document.getElementById('request-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (!await showConfirm(`Request a payout of ${fmt(b.pendingBalance)}?`)) return;
      btn.disabled = true;
      btn.textContent = 'Requesting…';
      const msgEl = document.getElementById('payout-msg');
      try {
        const res = await authFetch(`${API}/vendor/payouts/request`, { method: 'POST' });
        const json = await res.json();
        if (!res.ok) {
          msgEl.textContent = json.error || 'Request failed.';
          msgEl.className = 'payout-msg error';
          btn.disabled = false;
          btn.textContent = `Request ${fmt(b.pendingBalance)}`;
        } else {
          msgEl.textContent = 'Payout request submitted. Admin will process it shortly.';
          msgEl.className = 'payout-msg success';
          const activePeriod = document.querySelector('.period-btn.active')?.dataset.period || 'all';
          setTimeout(() => load(activePeriod), 1500);
        }
      } catch {
        msgEl.textContent = 'Network error.';
        msgEl.className = 'payout-msg error';
        btn.disabled = false;
        btn.textContent = `Request ${fmt(b.pendingBalance)}`;
      }
    });
  }
}

// Wire up period filter buttons (module is deferred — DOM already ready)
const _filter = document.getElementById('payout-period-filter');
if (_filter) {
  _filter.addEventListener('click', e => {
    const btn = e.target.closest('.period-btn');
    if (!btn) return;
    _filter.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    load(btn.dataset.period);
  });
}

load();
