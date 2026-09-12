(async function () {
  const API  = window.API_BASE;
  const root = document.getElementById('vendor-msg-root');
  const tok  = localStorage.getItem('s4l_token');

  const params        = new URLSearchParams(window.location.search);
  let   activeConvoId = params.get('id') || null;

  function fmt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function initial(name) { return (name || '?').charAt(0).toUpperCase(); }

  async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, ...(opts.headers || {}) },
    });
    return res;
  }

  function renderList(convos) {
    if (!convos.length) return '<p class="msg-empty">No messages from buyers yet.</p>';
    return `<ul class="msg-list">${convos.map(c => {
      const unread = (c.unreadVendor || 0) > 0;
      return `<li class="msg-list-item${unread ? ' unread' : ''}${c._id === activeConvoId ? ' active' : ''}" data-id="${c._id}">
        <div class="msg-list-avatar">${initial(c.buyerName)}</div>
        <div class="msg-list-body">
          <div class="msg-list-product">${c.productName || 'Product'}</div>
          <div class="msg-list-meta">${c.buyerName || 'Buyer'} · ${fmt(c.lastMessageAt)}</div>
        </div>
        ${unread ? '<div class="msg-unread-dot"></div>' : ''}
      </li>`;
    }).join('')}</ul>`;
  }

  // ── Offer card (vendor view: my role is always 'vendor') ─────
  const OFFER_STATUS_LABEL = {
    pending: 'Pending', accepted: 'Accepted <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg>', rejected: 'Rejected',
    countered: 'Countered', expired: 'Expired', completed: 'Purchased <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg>',
  };

  function renderOfferCard(m, mine) {
    const label = OFFER_STATUS_LABEL[m.offerStatus] || m.offerStatus;
    let actions = '';
    if (m.offerStatus === 'pending' && m.senderRole === 'buyer') {
      // Buyer sent this (initial ask or a counter) — vendor may respond
      actions = `
        <div class="msg-offer-actions" data-msg-id="${m._id}">
          <button type="button" class="msg-offer-btn accept" data-action="accept">Accept</button>
          <button type="button" class="msg-offer-btn reject" data-action="reject">Reject</button>
          <button type="button" class="msg-offer-btn counter" data-action="counter-open">Counter</button>
        </div>
        <div class="msg-offer-counter-row" id="counter-row-${m._id}" style="display:none">
          <input type="number" class="msg-offer-counter-input" id="counter-input-${m._id}" min="0.01" step="0.01" placeholder="Your counter (£)" />
          <button type="button" class="msg-offer-btn counter" data-action="counter-send">Send</button>
        </div>`;
    }
    return `<div class="msg-offer-card ${mine ? 'mine' : 'theirs'}" data-offer-msg-id="${m._id}">
      <div class="msg-offer-amount">£${m.offerAmount.toFixed(2)}</div>
      <div class="msg-offer-status status-${m.offerStatus}">${label}</div>
      ${actions}
      <div class="msg-bubble-time">${fmt(m.createdAt)}</div>
    </div>`;
  }

  function renderThread(convo, myId) {
    const bubbles = convo.messages.map(m => {
      const mine = m.senderRole === 'vendor';
      if (m.type === 'offer') {
        return `<div class="msg-bubble-wrap ${mine ? 'mine' : 'theirs'}">${renderOfferCard(m, mine)}</div>`;
      }
      return `<div class="msg-bubble-wrap ${mine ? 'mine' : 'theirs'}">
        <div class="msg-bubble">${m.body.replace(/</g, '&lt;')}</div>
        <div class="msg-bubble-time">${m.senderRole === 'buyer' ? (convo.buyerName || 'Buyer') : 'You'} · ${fmt(m.createdAt)}</div>
      </div>`;
    }).join('');

    return `<div class="msg-thread">
      <div class="msg-thread-header">
        <div>
          <div class="msg-thread-title">${convo.productName || 'Product'}</div>
          <div class="msg-thread-subtitle">From: ${convo.buyerName || 'Buyer'} &nbsp;·&nbsp;
            <a href="/product/?slug=${convo.productSlug || ''}" style="color:#0b6b6a;font-size:12px">View product →</a>
          </div>
        </div>
        <button class="msg-thread-back" id="vmsg-back">← Back</button>
      </div>
      <div class="msg-bubbles" id="vmsg-bubbles">${bubbles}</div>
      <form class="msg-reply-form" id="vmsg-reply-form">
        <textarea class="msg-reply-input" id="vmsg-reply-input" placeholder="Reply to buyer…" maxlength="2000" rows="1"></textarea>
        <button type="submit" class="msg-reply-send">Send</button>
      </form>
    </div>`;
  }

  async function render() {
    root.innerHTML = '<p class="msg-empty">Loading…</p>';

    const listRes = await apiFetch('/messages?view=vendor');
    if (!listRes.ok) { root.innerHTML = '<p class="msg-error">Could not load messages.</p>'; return; }
    const { conversations } = await listRes.json();

    let activeConvo = null;
    if (activeConvoId) {
      const tRes = await apiFetch(`/messages/${activeConvoId}`);
      if (tRes.ok) {
        const d = await tRes.json();
        activeConvo = d.conversation;
        apiFetch(`/messages/${activeConvoId}/read`, { method: 'PATCH' }).catch(() => {});
      }
    }

    let myId = '';
    try { myId = JSON.parse(atob(tok.split('.')[1])).id || ''; } catch { /* ignore */ }

    root.innerHTML = `
      <div class="vendor-msg-split">
        <div class="vendor-msg-list-col" id="vmsg-list-wrap">${renderList(conversations)}</div>
        <div class="vendor-msg-thread-col" id="vmsg-thread-wrap">${activeConvo ? renderThread(activeConvo, myId) : '<p class="msg-empty" style="padding:40px 0">Select a conversation to read and reply.</p>'}</div>
      </div>`;

    root.querySelectorAll('.msg-list-item').forEach(el => {
      el.addEventListener('click', async () => {
        activeConvoId = el.dataset.id;
        history.replaceState(null, '', `?id=${activeConvoId}`);
        const res = await apiFetch(`/messages/${activeConvoId}`);
        if (!res.ok) return;
        const { conversation } = await res.json();
        apiFetch(`/messages/${activeConvoId}/read`, { method: 'PATCH' }).catch(() => {});
        document.getElementById('vmsg-thread-wrap').innerHTML = renderThread(conversation, myId);
        root.querySelectorAll('.msg-list-item').forEach(li => li.classList.toggle('active', li.dataset.id === activeConvoId));
        wireThread(conversation);
        scrollBubbles();
      });
    });

    if (activeConvo) { wireThread(activeConvo); scrollBubbles(); }
  }

  function scrollBubbles() {
    const el = document.getElementById('vmsg-bubbles');
    if (el) el.scrollTop = el.scrollHeight;
  }

  async function reloadThread(convoId) {
    const res = await apiFetch(`/messages/${convoId}`);
    if (!res.ok) return;
    const { conversation } = await res.json();
    let myId = '';
    try { myId = JSON.parse(atob(tok.split('.')[1])).id || ''; } catch { /* ignore */ }
    document.getElementById('vmsg-thread-wrap').innerHTML = renderThread(conversation, myId);
    wireThread(conversation);
    scrollBubbles();
  }

  function wireThread(convo) {
    document.getElementById('vmsg-back')?.addEventListener('click', () => {
      activeConvoId = null;
      history.replaceState(null, '', window.location.pathname);
      document.getElementById('vmsg-thread-wrap').innerHTML = '<p class="msg-empty" style="padding:40px 0">Select a conversation to read and reply.</p>';
      root.querySelectorAll('.msg-list-item').forEach(li => li.classList.remove('active'));
    });

    const bubblesEl = document.getElementById('vmsg-bubbles');
    bubblesEl?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.msg-offer-btn');
      if (!btn) return;
      const action = btn.dataset.action;
      const card = btn.closest('.msg-offer-card');
      const msgId = card?.dataset.offerMsgId;

      if (action === 'counter-open') {
        const row = document.getElementById(`counter-row-${msgId}`);
        if (row) row.style.display = row.style.display === 'none' ? 'flex' : 'none';
        return;
      }

      let payload = { action };
      if (action === 'counter-send') {
        const input = document.getElementById(`counter-input-${msgId}`);
        const amount = Number(input?.value);
        if (!Number.isFinite(amount) || amount <= 0) { window.showToast?.('Enter a valid counter amount', 'error'); return; }
        payload = { action: 'counter', amount };
      }

      btn.disabled = true;
      try {
        const res = await apiFetch(`/messages/${convo._id}/offer/${msgId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to respond to offer.');
        reloadThread(convo._id);
      } catch (err) {
        window.showToast?.(err.message, 'error');
        btn.disabled = false;
      }
    });

    const form  = document.getElementById('vmsg-reply-form');
    const input = document.getElementById('vmsg-reply-input');
    if (!form || !input) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const res = await apiFetch(`/messages/${convo._id}/reply`, {
          method: 'POST',
          body: JSON.stringify({ body: text }),
        });
        if (!res.ok) throw new Error();
        const { conversation: updated } = await res.json();
        input.value = '';
        const bubbles = document.getElementById('vmsg-bubbles');
        if (bubbles) {
          const last = updated.messages[updated.messages.length - 1];
          const div = document.createElement('div');
          div.className = 'msg-bubble-wrap mine';
          div.innerHTML = `<div class="msg-bubble">${last.body.replace(/</g, '&lt;')}</div><div class="msg-bubble-time">You · ${fmt(last.createdAt)}</div>`;
          bubbles.appendChild(div);
          scrollBubbles();
        }
      } catch { /* ignore */ } finally {
        btn.disabled = false;
        input.focus();
      }
    });
  }

  render();
})();
