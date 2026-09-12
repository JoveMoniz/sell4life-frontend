(async function () {
  const API  = window.API_BASE;
  const root = document.getElementById('msg-root');
  const tok  = localStorage.getItem('s4l_token');

  const params        = new URLSearchParams(window.location.search);
  let   activeConvoId = params.get('id') || null;
  const convoCache    = {};

  function fmt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function initial(name) {
    return (name || '?').charAt(0).toUpperCase();
  }

  async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, ...(opts.headers || {}) },
    });
    return res;
  }

  // ── Render conversation list (each row owns a collapsible thread slot) ──
  function renderList(convos) {
    if (!convos.length) return '<p class="msg-empty">No messages yet. Visit a product page and click "Ask Seller" to get started.</p>';
    return `<ul class="msg-list">${convos.map(c => {
      const unread = (c.unreadBuyer || 0) > 0;
      return `<li class="msg-list-row" data-id="${c._id}">
        <div class="msg-list-item${unread ? ' unread' : ''}${c._id === activeConvoId ? ' active' : ''}" data-id="${c._id}">
          <div class="msg-list-avatar">${initial(c.vendorName)}</div>
          <div class="msg-list-body">
            <div class="msg-list-product">${c.productName || 'Product'}</div>
            <div class="msg-list-meta">${c.vendorName || 'Seller'} · ${fmt(c.lastMessageAt)}</div>
          </div>
          ${unread ? '<div class="msg-unread-dot"></div>' : ''}
          <div class="msg-list-chevron">&#9662;</div>
        </div>
        <div class="msg-thread-slot" id="slot-${c._id}"></div>
      </li>`;
    }).join('')}</ul>`;
  }

  // ── Offer card (buyer view: my role is always 'buyer') ───────
  const OFFER_STATUS_LABEL = {
    pending: 'Pending', accepted: 'Accepted <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg>', rejected: 'Rejected',
    countered: 'Countered', expired: 'Expired', completed: 'Purchased <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg>',
  };

  function renderOfferCard(m, mine) {
    const label = OFFER_STATUS_LABEL[m.offerStatus] || m.offerStatus;
    let actions = '';
    if (m.offerStatus === 'pending' && m.senderRole === 'vendor') {
      // Seller sent this (initial ask or a counter) — buyer may respond
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
    } else if (m.offerStatus === 'accepted') {
      actions = `<button type="button" class="msg-offer-btn buy-now" data-action="buy-now">Buy Now — £${m.offerAmount.toFixed(2)}</button>`;
    }
    return `<div class="msg-offer-card ${mine ? 'mine' : 'theirs'}" data-offer-msg-id="${m._id}">
      <div class="msg-offer-amount">£${m.offerAmount.toFixed(2)}</div>
      <div class="msg-offer-status status-${m.offerStatus}">${label}</div>
      ${actions}
      <div class="msg-bubble-time">${fmt(m.createdAt)}</div>
    </div>`;
  }

  // ── Render thread ───────────────────────────────────────────
  function renderThread(convo, myId) {
    const bubbles = convo.messages.map(m => {
      const mine = String(m.sender) === myId || m.senderRole === 'buyer';
      if (m.type === 'offer') {
        return `<div class="msg-bubble-wrap ${mine ? 'mine' : 'theirs'}">${renderOfferCard(m, mine)}</div>`;
      }
      return `<div class="msg-bubble-wrap ${mine ? 'mine' : 'theirs'}">
        <div class="msg-bubble">${m.body.replace(/</g, '&lt;')}</div>
        <div class="msg-bubble-time">${fmt(m.createdAt)}</div>
      </div>`;
    }).join('');

    return `<div class="msg-thread">
      <div class="msg-thread-header">
        <div>
          <div class="msg-thread-title">${convo.productName || 'Product'}</div>
          <div class="msg-thread-subtitle">Seller: ${convo.vendorName || 'Seller'} &nbsp;·&nbsp;
            <a href="/product/?slug=${convo.productSlug || ''}" style="color:#0b6b6a;font-size:12px">View product →</a>
          </div>
        </div>
        <button class="msg-thread-back" id="msg-back-${convo._id}">Close <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="msg-bubbles" id="msg-bubbles-${convo._id}">${bubbles}</div>
      <form class="msg-reply-form" id="msg-reply-form-${convo._id}">
        <textarea class="msg-reply-input" id="msg-reply-input-${convo._id}" placeholder="Type a reply…" maxlength="2000" rows="1"></textarea>
        <button type="submit" class="msg-reply-send">Send</button>
      </form>
    </div>`;
  }

  function scrollBubbles(convoId) {
    const el = document.getElementById(`msg-bubbles-${convoId}`);
    if (el) el.scrollTop = el.scrollHeight;
  }

  function closeSlot(convoId) {
    const slot = document.getElementById(`slot-${convoId}`);
    if (slot) slot.innerHTML = '';
    root.querySelectorAll('.msg-list-item').forEach(li => li.classList.remove('active'));
    if (activeConvoId === convoId) {
      activeConvoId = null;
      history.replaceState(null, '', window.location.pathname);
    }
  }

  async function openSlot(convoId) {
    // Collapse any other open thread first
    root.querySelectorAll('.msg-thread-slot').forEach(s => { if (s.id !== `slot-${convoId}`) s.innerHTML = ''; });

    const res = await apiFetch(`/messages/${convoId}`);
    if (!res.ok) return;
    const { conversation } = await res.json();
    convoCache[convoId] = conversation;
    apiFetch(`/messages/${convoId}/read`, { method: 'PATCH' }).catch(() => {});

    activeConvoId = convoId;
    history.replaceState(null, '', `?id=${convoId}`);

    const slot = document.getElementById(`slot-${convoId}`);
    if (slot) slot.innerHTML = renderThread(conversation, myId);

    root.querySelectorAll('.msg-list-item').forEach(li => li.classList.toggle('active', li.dataset.id === convoId));

    wireThread(conversation);
    scrollBubbles(convoId);

    slot?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  let myId = '';
  try {
    myId = JSON.parse(atob(tok.split('.')[1])).id || '';
  } catch { /* ignore */ }

  // ── Main render ─────────────────────────────────────────────
  async function render() {
    root.innerHTML = '<p class="msg-empty">Loading…</p>';

    const listRes = await apiFetch('/messages?view=buyer');
    if (!listRes.ok) { root.innerHTML = '<p class="msg-error">Could not load messages.</p>'; return; }
    const { conversations } = await listRes.json();

    root.innerHTML = `<div class="msg-page" style="padding:0">${renderList(conversations)}</div>`;

    root.querySelectorAll('.msg-list-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        if (activeConvoId === id) closeSlot(id);
        else openSlot(id);
      });
    });

    if (activeConvoId && conversations.some(c => c._id === activeConvoId)) {
      openSlot(activeConvoId);
    }
  }

  function wireThread(convo) {
    document.getElementById(`msg-back-${convo._id}`)?.addEventListener('click', () => closeSlot(convo._id));

    const bubblesEl = document.getElementById(`msg-bubbles-${convo._id}`);
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

      if (action === 'buy-now') {
        const offerMsg = convo.messages.find(m => String(m._id) === String(msgId));
        if (!offerMsg) return;
        localStorage.setItem('buyNowItem', JSON.stringify({
          productId: convo.product, name: convo.productName,
          price: offerMsg.offerAmount, quantity: 1,
          offerMessageId: offerMsg._id,
        }));
        localStorage.setItem('buyNow', 'true');
        window.setButtonLoading?.(btn, true, 'Redirecting…');
        window.location.href = '/cart/checkout.html';
        return;
      }

      let payload = { action };
      if (action === 'counter-send') {
        const input = document.getElementById(`counter-input-${msgId}`);
        const amount = Number(input?.value);
        if (!Number.isFinite(amount) || amount <= 0) { window.showToast?.('Enter a valid counter amount', 'error'); return; }
        payload = { action: 'counter', amount };
      }

      window.setButtonLoading?.(btn, true);
      try {
        const res = await apiFetch(`/messages/${convo._id}/offer/${msgId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to respond to offer.');
        openSlot(convo._id); // re-renders this card, replacing the button
      } catch (err) {
        window.showToast?.(err.message, 'error');
        window.setButtonLoading?.(btn, false);
      }
    });

    const form  = document.getElementById(`msg-reply-form-${convo._id}`);
    const input = document.getElementById(`msg-reply-input-${convo._id}`);
    if (!form || !input) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const btn = form.querySelector('button[type="submit"]');
      window.setButtonLoading?.(btn, true);
      try {
        const res = await apiFetch(`/messages/${convo._id}/reply`, {
          method: 'POST',
          body: JSON.stringify({ body: text }),
        });
        if (!res.ok) throw new Error();
        const { conversation: updated } = await res.json();
        input.value = '';
        const bubbles = document.getElementById(`msg-bubbles-${convo._id}`);
        if (bubbles) {
          const last = updated.messages[updated.messages.length - 1];
          const div = document.createElement('div');
          div.className = 'msg-bubble-wrap mine';
          div.innerHTML = `<div class="msg-bubble">${last.body.replace(/</g, '&lt;')}</div><div class="msg-bubble-time">${fmt(last.createdAt)}</div>`;
          bubbles.appendChild(div);
          scrollBubbles(convo._id);
        }
      } catch { /* ignore */ } finally {
        window.setButtonLoading?.(btn, false);
        input.focus();
      }
    });
  }

  render();
})();
