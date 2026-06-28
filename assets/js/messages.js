(async function () {
  const API  = window.API_BASE;
  const root = document.getElementById('msg-root');
  const tok  = localStorage.getItem('s4l_token');

  const params       = new URLSearchParams(window.location.search);
  let   activeConvoId = params.get('id') || null;

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

  // ── Render conversation list ────────────────────────────────
  function renderList(convos) {
    if (!convos.length) return '<p class="msg-empty">No messages yet. Visit a product page and click "Ask Seller" to get started.</p>';
    return `<ul class="msg-list">${convos.map(c => {
      const unread = (c.unreadBuyer || 0) > 0;
      return `<li class="msg-list-item${unread ? ' unread' : ''}${c._id === activeConvoId ? ' active' : ''}" data-id="${c._id}">
        <div class="msg-list-avatar">${initial(c.vendorName)}</div>
        <div class="msg-list-body">
          <div class="msg-list-product">${c.productName || 'Product'}</div>
          <div class="msg-list-meta">${c.vendorName || 'Seller'} · ${fmt(c.lastMessageAt)}</div>
        </div>
        ${unread ? '<div class="msg-unread-dot"></div>' : ''}
      </li>`;
    }).join('')}</ul>`;
  }

  // ── Render thread ───────────────────────────────────────────
  function renderThread(convo, myId) {
    const bubbles = convo.messages.map(m => {
      const mine = String(m.sender) === myId || m.senderRole === 'buyer';
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
        <button class="msg-thread-back" id="msg-back">← Back</button>
      </div>
      <div class="msg-bubbles" id="msg-bubbles">${bubbles}</div>
      <form class="msg-reply-form" id="msg-reply-form">
        <textarea class="msg-reply-input" id="msg-reply-input" placeholder="Type a reply…" maxlength="2000" rows="1"></textarea>
        <button type="submit" class="msg-reply-send">Send</button>
      </form>
    </div>`;
  }

  // ── Main render ─────────────────────────────────────────────
  async function render() {
    root.innerHTML = '<p class="msg-empty">Loading…</p>';

    const listRes = await apiFetch('/messages?view=buyer');
    if (!listRes.ok) { root.innerHTML = '<p class="msg-error">Could not load messages.</p>'; return; }
    const { conversations } = await listRes.json();

    let threadHTML = '';
    let myId = '';
    let activeConvo = null;

    if (activeConvoId) {
      const tRes = await apiFetch(`/messages/${activeConvoId}`);
      if (tRes.ok) {
        const d = await tRes.json();
        activeConvo = d.conversation;
        // mark read
        apiFetch(`/messages/${activeConvoId}/read`, { method: 'PATCH' }).catch(() => {});
      }
    }

    // get my id from token payload (base64 decode)
    try {
      myId = JSON.parse(atob(tok.split('.')[1])).id || '';
    } catch { /* ignore */ }

    root.innerHTML = `
      <div class="msg-page" style="padding:0">
        <div id="msg-list-wrap">${renderList(conversations)}</div>
        <div id="msg-thread-wrap">${activeConvo ? renderThread(activeConvo, myId) : ''}</div>
      </div>`;

    // List item click
    root.querySelectorAll('.msg-list-item').forEach(el => {
      el.addEventListener('click', async () => {
        activeConvoId = el.dataset.id;
        history.replaceState(null, '', `?id=${activeConvoId}`);
        const res = await apiFetch(`/messages/${activeConvoId}`);
        if (!res.ok) return;
        const { conversation } = await res.json();
        apiFetch(`/messages/${activeConvoId}/read`, { method: 'PATCH' }).catch(() => {});
        document.getElementById('msg-thread-wrap').innerHTML = renderThread(conversation, myId);
        root.querySelectorAll('.msg-list-item').forEach(li => li.classList.toggle('active', li.dataset.id === activeConvoId));
        wireThread(conversation);
        scrollBubbles();
      });
    });

    if (activeConvo) { wireThread(activeConvo); scrollBubbles(); }
  }

  function scrollBubbles() {
    const el = document.getElementById('msg-bubbles');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function wireThread(convo) {
    document.getElementById('msg-back')?.addEventListener('click', () => {
      activeConvoId = null;
      history.replaceState(null, '', window.location.pathname);
      document.getElementById('msg-thread-wrap').innerHTML = '';
      root.querySelectorAll('.msg-list-item').forEach(li => li.classList.remove('active'));
    });

    const form  = document.getElementById('msg-reply-form');
    const input = document.getElementById('msg-reply-input');
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
        const bubbles = document.getElementById('msg-bubbles');
        if (bubbles) {
          const last = updated.messages[updated.messages.length - 1];
          const div = document.createElement('div');
          div.className = 'msg-bubble-wrap mine';
          div.innerHTML = `<div class="msg-bubble">${last.body.replace(/</g, '&lt;')}</div><div class="msg-bubble-time">${fmt(last.createdAt)}</div>`;
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
