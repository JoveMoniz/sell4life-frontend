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

  function renderThread(convo, myId) {
    const bubbles = convo.messages.map(m => {
      const mine = m.senderRole === 'vendor';
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

  function wireThread(convo) {
    document.getElementById('vmsg-back')?.addEventListener('click', () => {
      activeConvoId = null;
      history.replaceState(null, '', window.location.pathname);
      document.getElementById('vmsg-thread-wrap').innerHTML = '<p class="msg-empty" style="padding:40px 0">Select a conversation to read and reply.</p>';
      root.querySelectorAll('.msg-list-item').forEach(li => li.classList.remove('active'));
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
