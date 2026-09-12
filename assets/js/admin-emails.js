const API = window.API_BASE;

const $ = id => document.getElementById(id);

function authFetch(url, opts = {}) {
  const token = localStorage.getItem('s4l_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, credentials: 'include', headers });
}

// Names get stored however someone typed them at signup ("ADRIANA DE
// OLIVEIRA BARBOSA", "jovelino vaz moniz") — title-case for display so the
// search results don't look inconsistent next to normally-cased names.
function titleCase(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function setStatus(elId, msg, type) {
  const el = $(elId);
  el.textContent = msg;
  el.className = `fee-save-status ${type}`;
  if (type === 'ok') setTimeout(() => { el.textContent = ''; }, 3000);
}

/* ── Config ── */
async function loadConfig() {
  const res = await authFetch(`${API}/admin/config/marketing-emails`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load config');
  const { marketingEmails } = await res.json();

  $('inp-invite-enabled').checked = !!marketingEmails.sellerInviteEnabled;
  $('inp-invite-delay').value = marketingEmails.sellerInviteDelayDays ?? '';
  $('inp-invite-country').value = marketingEmails.sellerInviteCountry ?? '';
}

$('btn-save-config').addEventListener('click', async () => {
  const btn = $('btn-save-config');
  btn.disabled = true;
  try {
    const body = {
      sellerInviteEnabled: $('inp-invite-enabled').checked,
      sellerInviteDelayDays: Number($('inp-invite-delay').value) || 0,
      sellerInviteCountry: $('inp-invite-country').value.trim(),
    };
    const res = await authFetch(`${API}/admin/config/marketing-emails`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    setStatus('status-config', 'Saved', 'ok');
    await loadStats();
  } catch (e) {
    setStatus('status-config', e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

/* ── Stats ── */
async function loadStats() {
  const res = await authFetch(`${API}/admin/config/marketing-emails/stats`, { credentials: 'include' });
  if (!res.ok) return;
  const s = await res.json();
  $('stat-total').textContent = s.totalUsers;
  $('stat-eligible').textContent = s.eligibleCountryUsers;
  $('stat-invited').textContent = s.invited;
  $('stat-pending').textContent = s.pending;
  $('stat-welcomes').textContent = s.totalWelcomeSent;
  $('stat-invites').textContent = s.totalInviteSent;
}

/* ── Log ── */
function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadLog() {
  const tbody = $('log-table');
  const res = await authFetch(`${API}/admin/config/marketing-emails/log?limit=100`, { credentials: 'include' });
  if (!res.ok) {
    tbody.innerHTML = '<tr><td colspan="4" class="fee-loading">Failed to load</td></tr>';
    return;
  }
  const { logs } = await res.json();
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="fee-loading">No sends yet.</td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(l => `<tr>
    <td><span class="me-type-badge ${l.type}">${l.type === 'welcome' ? 'Welcome' : 'Seller Invite'}</span></td>
    <td>${l.to}</td>
    <td>${l.userName || '—'}</td>
    <td>${fmtDate(l.createdAt)}</td>
  </tr>`).join('');
}

/* ── Backfill ── */
$('btn-backfill').addEventListener('click', async () => {
  if (!confirm('This sends real welcome + seller-invite emails immediately to every pending user matching the country filter. Continue?')) return;

  const btn = $('btn-backfill');
  btn.disabled = true;
  setStatus('status-backfill', 'Sending…', '');
  try {
    const res = await authFetch(`${API}/admin/users/backfill-welcome`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Backfill failed');
    setStatus('status-backfill', `Done — ${data.welcomed} welcomed, ${data.invited} invited, ${data.skippedAlreadyVendor} already vendors`, 'ok');
    await Promise.all([loadStats(), loadLog()]);
  } catch (e) {
    setStatus('status-backfill', e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

$('btn-backfill-log').addEventListener('click', async () => {
  const btn = $('btn-backfill-log');
  btn.disabled = true;
  setStatus('status-backfill-log', 'Working…', '');
  try {
    const res = await authFetch(`${API}/admin/users/backfill-email-log`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Backfill failed');
    setStatus('status-backfill-log', `Done — ${data.logEntriesCreated} log entries created`, 'ok');
    await Promise.all([loadStats(), loadLog()]);
  } catch (e) {
    setStatus('status-backfill-log', e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

/* ── Send to specific recipients ── */
let sendSearchTimer = null;
let sendSearchController = null;
let sendSearchWasEmpty = true;

async function runSendSearch(q) {
  const resultsEl = $('send-search-results');
  if (sendSearchController) sendSearchController.abort();
  sendSearchController = new AbortController();
  try {
    const res = await authFetch(`${API}/admin/users?q=${encodeURIComponent(q)}`, { credentials: 'include', signal: sendSearchController.signal });
    if (!res.ok) return;
    const { users } = await res.json();
    if (!users.length) {
      resultsEl.innerHTML = '<div style="padding:10px;font-size:13px;color:#6b7280">No matches</div>';
      resultsEl.hidden = false;
      return;
    }
    const sorted = users.slice().sort((a, b) =>
      (a.name || a.username || a.email).localeCompare(b.name || b.username || b.email, undefined, { sensitivity: 'base' })
    );
    resultsEl.innerHTML = sorted.slice(0, 8).map(u => {
      const sub = u.vendor ? `${u.accountType} · ${u.vendor.storeName}` : u.accountType;
      return `<div class="send-search-row" data-email="${u.email}" style="padding:8px 10px;font-size:13px;cursor:pointer;border-bottom:1px solid #f3f4f6;overflow-wrap:break-word">
        <div style="font-weight:600">${titleCase(u.name) || u.username || '(no name)'}</div>
        <div style="color:#6b7280">${u.email} — ${sub}</div>
      </div>`;
    }).join('');
    resultsEl.hidden = false;
  } catch (err) {
    if (err.name !== 'AbortError') { /* ignore search errors */ }
  }
}

$('inp-send-search').addEventListener('input', () => {
  const q = $('inp-send-search').value.trim();
  clearTimeout(sendSearchTimer);
  const resultsEl = $('send-search-results');
  if (!q) {
    if (sendSearchController) sendSearchController.abort();
    resultsEl.hidden = true;
    resultsEl.innerHTML = '';
    sendSearchWasEmpty = true;
    return;
  }
  // Fire immediately on the first character of a new search (otherwise a
  // fast typist cancels every debounce timer before it fires, and nothing
  // shows until they pause — which lands at a different character count
  // depending on typing rhythm, not the query itself). Debounce afterward.
  if (sendSearchWasEmpty) {
    sendSearchWasEmpty = false;
    runSendSearch(q);
  } else {
    sendSearchTimer = setTimeout(() => runSendSearch(q), 300);
  }
});

$('send-search-results').addEventListener('click', (e) => {
  const row = e.target.closest('.send-search-row');
  if (!row) return;
  $('inp-send-email').value = row.dataset.email;
  $('inp-send-search').value = row.dataset.email;
  $('send-search-results').hidden = true;
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#field-send-email')) $('send-search-results').hidden = true;
});

$('sel-send-mode').addEventListener('change', () => {
  const isTier = $('sel-send-mode').value === 'tier';
  $('field-send-email').hidden = isTier;
  $('field-send-tier').hidden = !isTier;
});

$('btn-send-custom').addEventListener('click', async () => {
  const template = $('sel-send-template').value;
  const mode = $('sel-send-mode').value;
  const templateLabel = template === 'welcome' ? 'Welcome' : 'Seller Invite';

  let body = { template, mode };
  let confirmMsg;
  if (mode === 'individual') {
    const email = $('inp-send-email').value.trim();
    if (!email) { setStatus('status-send-custom', 'Enter an email address', 'err'); return; }
    body.email = email;
    confirmMsg = `Send the ${templateLabel} email to ${email}?`;
  } else {
    const tier = $('sel-send-tier').value;
    body.tier = tier;
    confirmMsg = `Send the ${templateLabel} email to every ${tier} vendor? This cannot be undone.`;
  }
  if (!confirm(confirmMsg)) return;

  const btn = $('btn-send-custom');
  btn.disabled = true;
  setStatus('status-send-custom', 'Sending…', '');
  try {
    const res = await authFetch(`${API}/admin/users/send-custom-email`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Send failed');
    setStatus('status-send-custom', `Sent to ${data.sent}/${data.totalRecipients}`, 'ok');
    $('inp-send-email').value = '';
    $('inp-send-search').value = '';
    $('send-search-results').hidden = true;
    $('send-search-results').innerHTML = '';
    sendSearchWasEmpty = true;
    await Promise.all([loadStats(), loadLog()]);
  } catch (e) {
    setStatus('status-send-custom', e.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

/* ── Email templates ── */
function tplFieldSet(key) {
  const root = document.querySelector(`.me-tpl-fields[data-key="${key}"]`);
  return {
    subject: root.querySelector('.me-tpl-subject'),
    heading: root.querySelector('.me-tpl-heading'),
    body: root.querySelector('.me-tpl-body'),
    ctaText: root.querySelector('.me-tpl-cta-text'),
    ctaUrl: root.querySelector('.me-tpl-cta-url'),
  };
}

async function loadTemplates() {
  const res = await authFetch(`${API}/admin/config/email-templates`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load templates');
  const { templates } = await res.json();
  for (const key of ['welcome', 'seller_invite']) {
    const f = tplFieldSet(key);
    const t = templates[key];
    f.subject.value = t.subject;
    f.heading.value = t.heading;
    f.body.value = t.body;
    f.ctaText.value = t.ctaText || '';
    f.ctaUrl.value = t.ctaUrl || '';
  }
}

document.querySelectorAll('.btn-tpl-save').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.key;
    const f = tplFieldSet(key);
    btn.disabled = true;
    try {
      const body = {
        subject: f.subject.value,
        heading: f.heading.value,
        body: f.body.value,
        ctaText: f.ctaText.value,
        ctaUrl: f.ctaUrl.value,
      };
      const res = await authFetch(`${API}/admin/config/email-templates/${key}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setStatus(`status-tpl-${key}`, 'Saved', 'ok');
    } catch (e) {
      setStatus(`status-tpl-${key}`, e.message, 'err');
    } finally {
      btn.disabled = false;
    }
  });
});

document.querySelectorAll('.btn-tpl-preview').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.key;
    const f = tplFieldSet(key);
    const previewEl = $(`preview-${key}`);
    btn.disabled = true;
    try {
      const res = await authFetch(`${API}/admin/config/email-templates/${key}/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: f.subject.value,
          heading: f.heading.value,
          body: f.body.value,
          ctaText: f.ctaText.value,
          ctaUrl: f.ctaUrl.value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      previewEl.innerHTML = `<div style="font-size:11px;color:#6b7280;margin-bottom:8px">Subject: <strong>${data.subject}</strong></div>${data.html}`;
      previewEl.hidden = false;
    } catch (e) {
      setStatus(`status-tpl-${key}`, e.message, 'err');
    } finally {
      btn.disabled = false;
    }
  });
});

/* ── Init ── */
(async () => {
  try {
    await loadConfig();
  } catch {
    setStatus('status-config', 'Failed to load config', 'err');
  }
  try {
    await loadTemplates();
  } catch {
    setStatus('status-tpl-welcome', 'Failed to load templates', 'err');
  }
  await Promise.all([loadStats(), loadLog()]);
})();
