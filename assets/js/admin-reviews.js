/* admin-reviews.js — Reviews & Ratings management page */
const API   = window.API_BASE;
const token = () => localStorage.getItem('token') || '';

/* ── toast helper ────────────────────────────────────────── */
function toast(msg, ok = true) {
  const el = document.getElementById('arv-toast');
  el.textContent = msg;
  el.style.background = ok ? '#0b6b6a' : '#c0392b';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── star HTML ───────────────────────────────────────────── */
function starsHTML(n) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="s4l-star ${i < n ? 'filled' : ''}" style="font-size:13px">★</span>`
  ).join('');
}

/* ── load settings ───────────────────────────────────────── */
async function loadSettings() {
  try {
    const res  = await fetch(`${API}/admin/config/reviews`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const data = await res.json();

    const toggle = document.getElementById('arv-enabled-toggle');
    const minInp = document.getElementById('arv-min-input');
    const statusTxt = document.getElementById('arv-status-text');

    toggle.checked = data.reviewsEnabled;
    minInp.value   = data.reviewsMinCount ?? 3;
    statusTxt.textContent = data.reviewsEnabled ? 'On' : 'Off';
    statusTxt.className   = `arv-status-text ${data.reviewsEnabled ? 'on' : ''}`;
  } catch {
    toast('Failed to load settings', false);
  }
}

/* ── save settings ───────────────────────────────────────── */
async function saveSettings() {
  const enabled  = document.getElementById('arv-enabled-toggle').checked;
  const minCount = Number(document.getElementById('arv-min-input').value);

  try {
    const res = await fetch(`${API}/admin/config/reviews`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ reviewsEnabled: enabled, reviewsMinCount: minCount }),
    });
    if (!res.ok) throw new Error();

    const statusTxt = document.getElementById('arv-status-text');
    statusTxt.textContent = enabled ? 'On' : 'Off';
    statusTxt.className   = `arv-status-text ${enabled ? 'on' : ''}`;
    toast('Settings saved');
  } catch {
    toast('Failed to save settings', false);
  }
}

/* ── load reviews list ───────────────────────────────────── */
let _activeStatus = '';
let _activePage   = 1;

async function loadReviews() {
  const list = document.getElementById('arv-list');
  list.innerHTML = '<p style="color:#9ca3af;font-size:14px;text-align:center;padding:24px 0">Loading…</p>';

  const qs = new URLSearchParams({ page: _activePage, limit: 20 });
  if (_activeStatus) qs.set('status', _activeStatus);

  try {
    const res  = await fetch(`${API}/reviews/admin/list?${qs}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const data = await res.json();

    if (!data.reviews?.length) {
      list.innerHTML = '<p style="color:#9ca3af;font-size:14px;text-align:center;padding:24px 0">No reviews found.</p>';
      document.getElementById('arv-pagination').innerHTML = '';
      return;
    }

    list.innerHTML = data.reviews.map(r => {
      const productName = r.productId?.name || 'Unknown product';
      const productLink = r.productId?._id
        ? `<a href="/product/product.html?id=${r.productId._id}" target="_blank" style="color:#0b6b6a">${productName}</a>`
        : productName;

      return `
        <div class="arv-row" data-id="${r._id}">
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <span class="s4l-stars">${starsHTML(r.rating)}</span>
          </div>
          <div class="arv-row-info">
            <p class="arv-row-product">${productLink}</p>
            <p class="arv-row-author">${r.buyerName || 'Buyer'}${r.verified ? ' <span style="font-size:10px;color:#059669">✓ Verified</span>' : ''}</p>
            ${r.title ? `<p class="arv-row-title">"${r.title}"</p>` : ''}
            ${r.body  ? `<p class="arv-row-body">${r.body}</p>` : ''}
            <p style="font-size:11px;color:#9ca3af;margin:4px 0 0">${new Date(r.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</p>
          </div>
          <div class="arv-row-actions">
            <span class="arv-status-pill ${r.status}">${r.status}</span>
            ${r.status !== 'approved'
              ? `<button class="arv-btn arv-btn-approve" data-id="${r._id}" data-action="approved">Approve</button>` : ''}
            ${r.status !== 'rejected'
              ? `<button class="arv-btn arv-btn-reject" data-id="${r._id}" data-action="rejected">Reject</button>` : ''}
            <button class="arv-btn arv-btn-delete" data-id="${r._id}" data-action="delete">Delete</button>
          </div>
        </div>`;
    }).join('');

    // Pagination
    const pg = document.getElementById('arv-pagination');
    if (data.pages > 1) {
      pg.innerHTML = Array.from({ length: data.pages }, (_, i) => i + 1).map(n =>
        `<button class="arv-filter-btn ${n === _activePage ? 'active' : ''}" data-page="${n}">${n}</button>`
      ).join('');
    } else {
      pg.innerHTML = '';
    }
  } catch {
    list.innerHTML = '<p style="color:#c0392b;font-size:14px;text-align:center;padding:24px 0">Failed to load reviews.</p>';
  }
}

/* ── event delegation ────────────────────────────────────── */
document.getElementById('arv-list').addEventListener('click', async e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const id     = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'delete') {
    if (!confirm('Delete this review?')) return;
    try {
      await fetch(`${API}/reviews/admin/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      toast('Review deleted');
      loadReviews();
    } catch { toast('Delete failed', false); }
    return;
  }

  try {
    await fetch(`${API}/reviews/admin/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status: action }),
    });
    toast(`Review ${action}`);
    loadReviews();
  } catch { toast('Update failed', false); }
});

document.getElementById('arv-pagination').addEventListener('click', e => {
  const btn = e.target.closest('[data-page]');
  if (!btn) return;
  _activePage = Number(btn.dataset.page);
  loadReviews();
});

document.getElementById('arv-save-btn').addEventListener('click', saveSettings);

document.getElementById('arv-enabled-toggle').addEventListener('change', e => {
  const statusTxt = document.getElementById('arv-status-text');
  statusTxt.textContent = e.target.checked ? 'On' : 'Off';
  statusTxt.className   = `arv-status-text ${e.target.checked ? 'on' : ''}`;
});

document.querySelectorAll('.arv-filter-btn[data-status]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.arv-filter-btn[data-status]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _activeStatus = btn.dataset.status;
    _activePage   = 1;
    loadReviews();
  });
});

/* ── init ────────────────────────────────────────────────── */
loadSettings();
loadReviews();
