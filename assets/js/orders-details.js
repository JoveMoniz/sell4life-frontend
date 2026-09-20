// =====================================================
// Order Details — per-item return support
// =====================================================

console.log('orders-details.js running');

const API = window.API_BASE;

// Set once per page load (right after the order loads, before any price
// renders) from order.displayCurrency* — for a converted order this is the
// REAL charged currency (see backend/backend/utils/chargeCurrency.js), not
// just a display estimate. Defaults to GBP/1 so nothing breaks before the
// order has loaded or for a pre-existing GBP order.
let orderCurrencySymbol = '£';
let orderCurrencyRate = 1;

function fmtOrder(gbpAmount) {
  return `${orderCurrencySymbol}${(Number(gbpAmount) * orderCurrencyRate).toFixed(2)}`;
}

/* ======================================================
   AUTH FETCH
====================================================== */
function authFetch(url, opts = {}) {
  const token = localStorage.getItem('s4l_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, credentials: 'include', headers });
}

/* ======================================================
   BADGE HELPERS
====================================================== */
// Badge rendering itself lives in the shared order-status.js
// (window.s4lReturnBadge/s4lRefundBadge) so buyer/vendor/admin all show
// the exact same colors for the same status.
function returnBadge(status) {
  return window.s4lReturnBadge ? window.s4lReturnBadge(status) : '';
}

function refundBadge(status) {
  return window.s4lRefundBadge ? window.s4lRefundBadge(status) : '';
}

function canRequestReturn(item) {
  return (
    item.status === 'Delivered' &&
    !['requested', 'approved', 'partially_returned', 'returned'].includes(item.returnStatus)
  );
}

function canReview(item) {
  return item.status === 'Delivered' && !!item.productId;
}

function canRequestCancel(item) {
  return ['Pending', 'Processing'].includes(item.status);
}

function formatHistoryStatus(status) {
  const check = window.s4lIcon ? window.s4lIcon('check') : '';
  const close = window.s4lIcon ? window.s4lIcon('close') : '';
  const money = window.s4lIcon ? window.s4lIcon('money') : '';
  const map = {
    'Cancel Requested': 'Cancel requested',
    'Return Requested': 'Return requested',
    'Return Approved':  `Return approved ${check}`,
    'Return Rejected':  `Return rejected ${close}`,
    Returned:           'Item returned',
    Cancelled:          'Order cancelled',
    Refunded:           `Refund issued ${money}`,
  };
  return map[status] || status;
}

/* ======================================================
   BUILD ITEM HTML
====================================================== */
function buildItemHTML(item) {
  const qty   = Number(item.quantity ?? 1);
  const price = Number(item.price ?? 0);
  const line  = qty * price;
  const img   = typeof item.image === 'string'
    ? item.image
    : '/assets/images/products/sell4life-placeholder.png';

  const returnedQty  = Number(item.returnQuantity || 0);
  const refundedQty  = Number(item.refundedQuantity || 0);
  const requestedQty = Number(item.returnRequestedQuantity || 0);

  const badges = [
    returnBadge(item.returnStatus),
    refundBadge(item.refundStatus),
  ].filter(Boolean).join(' ');

  const quantityDetail = [
    requestedQty  > 0 ? `${requestedQty} requested`  : '',
    returnedQty   > 0 ? `${returnedQty} returned`    : '',
    refundedQty   > 0 ? `${refundedQty} refunded`    : '',
  ].filter(Boolean).join(' · ');

  const contactSellerBtn = item.productId ? `
    <button class="btn-contact-seller" data-product-id="${item.productId}"
      data-product-name="${(item.name || 'this product').replace(/"/g, '&quot;')}">
      <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M4 5h16v11H8l-4 4V5z"/></svg> Contact Seller
    </button>` : '';

  const cancelBtn = canRequestCancel(item) ? `
    <button class="btn-cancel-item" data-item-id="${item._id}"
      style="font-size:0.8rem;padding:4px 10px;cursor:pointer;background:#fee2e2;border:1px solid #fca5a5;border-radius:4px;color:#b91c1c">
      Cancel this item
    </button>` : '';

  const returnForm = canRequestReturn(item) ? `
    <button class="btn-show-return-form" data-item-id="${item._id}"
      style="font-size:0.8rem;padding:4px 10px;cursor:pointer">
      Return this item
    </button>
    <div class="item-return-form" id="return-form-${item._id}" style="display:none;margin-top:10px;padding:10px;border:1px solid #e5e7eb;border-radius:6px">
      <label style="display:block;margin-bottom:6px;font-size:0.85rem">
        Quantity to return:
        <select class="return-qty-sel" style="margin-left:6px">
          ${Array.from({ length: qty }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
        </select>
      </label>
      <label style="display:block;margin-bottom:8px;font-size:0.85rem">
        Why are you returning this?
        <select class="return-category-sel" style="display:block;width:100%;margin-top:4px;padding:6px;border:1px solid #d1d5db;border-radius:4px;box-sizing:border-box">
          <option value="">Select a reason…</option>
          <option value="change_of_mind">I changed my mind</option>
          <option value="faulty_damaged_wrong_misdescribed">Item is faulty, damaged, wrong, or not as described</option>
        </select>
      </label>
      <label style="display:block;margin-bottom:8px;font-size:0.85rem">
        Additional details (optional):
        <input class="return-reason-inp" type="text" placeholder="e.g. wrong size"
          style="display:block;width:100%;margin-top:4px;padding:6px;border:1px solid #d1d5db;border-radius:4px;box-sizing:border-box" />
      </label>
      <div style="display:flex;gap:8px">
        <button class="btn-submit-return" data-item-id="${item._id}"
          style="padding:6px 14px;background:#111;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem">
          Submit Request
        </button>
        <button class="btn-cancel-return-form" data-item-id="${item._id}"
          style="padding:6px 14px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:0.85rem">
          Cancel
        </button>
      </div>
    </div>
  ` : '';

  const reviewBtn = canReview(item) ? `
    <button class="btn-show-review-form" data-item-id="${item._id}" data-product-id="${item.productId}"
      style="font-size:0.8rem;padding:4px 10px;cursor:pointer">
      <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 4l2.5 5.5L20 10l-4.2 4 1 5.8L12 17l-4.8 2.8 1-5.8L4 10l5.5-.5L12 4z"/></svg> Review this item
    </button>
    <div class="item-review-form" id="review-form-${item._id}" style="display:none;margin-top:10px"></div>` : '';

  const hasAnyAction = !!(item.productId || canRequestCancel(item) || canRequestReturn(item));
  const itemActions = hasAnyAction ? `
    <div class="order-actions-wrapper" style="margin-top:14px">
      <button class="order-actions-toggle" data-item-id="${item._id}" style="font-size:0.8rem;padding:4px 12px">Actions <span class="oat-caret">▾</span></button>
      <div class="order-actions-menu" id="item-actions-menu-${item._id}">
        ${contactSellerBtn}
        ${reviewBtn}
        ${cancelBtn}
        ${returnForm}
      </div>
    </div>` : '';

  return `
    <div class="order-item" data-item-id="${item._id}">
      <img class="order-thumb"
        src="${img}"
        alt="${item.name || 'Product'}"
        onerror="this.src='/assets/images/products/sell4life-placeholder.png'">

      <div class="order-info" style="flex:1">
        <div class="order-name">${item.name || 'Unnamed product'}</div>
        ${window.s4lVariantLabel && window.s4lVariantLabel(item.attributes)
          ? `<div style="font-size:0.8rem;color:#0b6b6a;font-weight:600;margin-top:2px">${window.s4lVariantLabel(item.attributes)}</div>`
          : ''}
        <div class="order-qty">${qty} × ${fmtOrder(price)}</div>
        ${badges ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px">${badges}</div>` : ''}
        ${quantityDetail ? `<div style="font-size:0.75rem;color:#6b7280;margin-top:6px">${quantityDetail}</div>` : ''}
        ${item.trackingNumber
          ? `<div style="font-size:0.8rem;color:#374151;margin-top:10px">
               Tracking: <strong>${item.trackingNumber}</strong>${item.carrier ? ` via ${item.carrier}` : ''}
             </div>`
          : ''}
        ${itemActions}
      </div>

      <div class="order-line-price">${fmtOrder(line)}</div>
    </div>
  `;
}

/* ======================================================
   BUILD VENDOR SHIPMENT GROUP (buyer view)
====================================================== */
function buildVendorGroup(vo, groupItems) {
  const tracking = vo.trackingNumber
    ? `<span style="font-size:0.8rem;color:#374151;margin-left:auto">
         Tracking: <strong>${vo.trackingNumber}</strong>${vo.carrier ? ` via ${vo.carrier}` : ''}
       </span>`
    : '';

  return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;overflow:hidden">
      <div style="background:#f9fafb;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-bottom:1px solid #e5e7eb">
        <strong style="font-size:0.88rem">${vo.vendorStoreName || 'Seller'}</strong>
        ${window.s4lStatusBadge ? window.s4lStatusBadge(vo.status) : (vo.status || '')}
        ${tracking}
      </div>
      <div style="padding:0 4px">
        ${groupItems.map(buildItemHTML).join('')}
      </div>
    </div>`;
}

/* ======================================================
   LOAD ORDER
====================================================== */
async function loadOrderDetails() {
  const params    = new URLSearchParams(window.location.search);
  const orderId   = params.get('id');
  const container = document.getElementById('order-details');
  const loading   = document.getElementById('order-loading');

  if (!container || !loading) return;

  if (!orderId) {
    loading.textContent = 'Invalid order.';
    return;
  }

  const token = localStorage.getItem('s4l_token');
  if (!token) {
    localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
    window.location.href = '/account/signin.html';
    return;
  }

  try {
    const res = await authFetch(`${API}/orders/${orderId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const order = await res.json();
    loading.style.display = 'none';

    orderCurrencySymbol = order.displayCurrencySymbol || '£';
    orderCurrencyRate = Number(order.displayCurrencyRate) || 1;

    const id        = order.id || order._id;
    const displayId = order.shortId || `S4L-${id.slice(0, 10).toUpperCase()}`;
    const items     = Array.isArray(order.items) ? order.items : [];

    const paymentStatus = order.paymentStatus || 'pending';
    const paymentLabel  =
      paymentStatus === 'paid'                ? 'Paid' :
      paymentStatus === 'refund_scheduled'    ? 'Refund Scheduled' :
      paymentStatus === 'refunded'            ? 'Refunded' :
      paymentStatus === 'partially_refunded'  ? 'Partially Refunded' :
      paymentStatus === 'failed'              ? 'Failed' : 'Unpaid';

    container.innerHTML = `
      <h2 class="order-id">${displayId}</h2>

      <p>Fulfillment: <strong class="order-status">${window.s4lStatusBadge ? window.s4lStatusBadge(order.status) : (order.status || '—')}</strong></p>

      <p>Payment:
        <strong class="payment-status ${paymentStatus}">${paymentLabel}</strong>
      </p>

      <p>Date: ${order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</p>

      <div class="order-history">
        <button type="button" class="order-history-toggle">Order activity <span class="oh-caret">▾</span></button>
        <ul class="order-history-list">
          ${Array.isArray(order.statusHistory)
            ? order.statusHistory.slice()
                .sort((a, b) => {
                  const diff = new Date(b.date) - new Date(a.date);
                  if (diff !== 0) return diff;
                  // Same timestamp: cancel before refund (logical order)
                  const rank = { Cancelled: 0, Refunded: 1, Refund: 2 };
                  const ra = Object.keys(rank).find(k => String(a.status).includes(k));
                  const rb = Object.keys(rank).find(k => String(b.status).includes(k));
                  return (rank[ra] ?? 99) - (rank[rb] ?? 99);
                })
                .map(h => `
                <li>
                  <span class="history-label">${formatHistoryStatus(h.status)}</span>
                  <span class="history-date">${new Date(h.date).toLocaleString()}</span>
                </li>`).join('')
            : ''}
        </ul>
      </div>

      <div class="order-items">
        ${(() => {
          const vendorOrders = Array.isArray(order.vendorOrders) ? order.vendorOrders : [];
          if (vendorOrders.length > 1) {
            return vendorOrders.map(vo => {
              const voItems = items.filter(i => String(i.vendorId) === String(vo.vendorId));
              return buildVendorGroup(vo, voItems);
            }).join('');
          }
          return items.length ? items.map(buildItemHTML).join('') : '<p>No items found.</p>';
        })()}
      </div>

      <div class="order-total"><h3>${fmtOrder(order.total ?? 0)}</h3></div>
    `;

    setupButtons(order, id);
  } catch (err) {
    console.error('ORDER DETAILS ERROR:', err);
    loading.textContent = 'Failed to load order.';
  }
}

/* ======================================================
   ORDER-LEVEL BUTTONS
====================================================== */
function setupButtons(order, id) {
  // Order-level cancel removed — per-item Cancel buttons shown on each item card instead
}

/* ======================================================
   CONTACT SELLER MODAL (per item — reuses ask-modal styles)
====================================================== */
let _contactModalReady = false;
let _contactProductId  = null;

function ensureContactModal() {
  if (_contactModalReady) return;
  _contactModalReady = true;

  const backdrop = document.createElement('div');
  backdrop.className = 'ask-modal-backdrop';
  backdrop.id = 'ask-modal-backdrop';
  backdrop.innerHTML = `
    <div class="ask-modal">
      <h3>Message seller about</h3>
      <p id="ask-modal-product-name"></p>
      <textarea id="ask-modal-body" placeholder="Type your question…"></textarea>
      <div class="ask-modal-msg" id="ask-modal-msg"></div>
      <div class="ask-modal-actions">
        <button class="ask-modal-cancel" id="ask-modal-cancel">Cancel</button>
        <button class="ask-modal-submit" id="ask-modal-submit">Send</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const askBody   = document.getElementById('ask-modal-body');
  const askMsg    = document.getElementById('ask-modal-msg');
  const askCancel = document.getElementById('ask-modal-cancel');
  const askSubmit = document.getElementById('ask-modal-submit');

  const close = () => {
    backdrop.classList.remove('open');
    if (askMsg) { askMsg.textContent = ''; askMsg.className = 'ask-modal-msg'; }
    if (askBody) askBody.value = '';
    _contactProductId = null;
  };

  askCancel?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  askSubmit?.addEventListener('click', async () => {
    const text = askBody?.value.trim();
    if (!text) { if (askMsg) { askMsg.textContent = 'Please write a message.'; askMsg.className = 'ask-modal-msg err'; } return; }
    if (!_contactProductId) return;
    askSubmit.disabled = true;
    if (askMsg) { askMsg.textContent = ''; askMsg.className = 'ask-modal-msg'; }
    try {
      const res = await authFetch(`${API}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: _contactProductId, body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send.');
      if (askMsg) { askMsg.textContent = 'Message sent!'; askMsg.className = 'ask-modal-msg ok'; }
      setTimeout(close, 1200);
    } catch (err) {
      if (askMsg) { askMsg.textContent = err.message; askMsg.className = 'ask-modal-msg err'; }
    } finally {
      askSubmit.disabled = false;
    }
  });
}

function openContactModal(productId, productName) {
  ensureContactModal();
  _contactProductId = productId;
  const nameEl = document.getElementById('ask-modal-product-name');
  if (nameEl) nameEl.textContent = productName;
  document.getElementById('ask-modal-backdrop')?.classList.add('open');
  document.getElementById('ask-modal-body')?.focus();
}

/* ======================================================
   PER-ITEM RETURN HANDLERS (delegated — added once)
====================================================== */
let _returnHandlerReady = false;

function ensureReturnHandler() {
  if (_returnHandlerReady) return;
  _returnHandlerReady = true;

  document.addEventListener('click', async (e) => {
    // Contact seller about this item
    const contactBtn = e.target.closest('.btn-contact-seller');
    if (contactBtn) {
      contactBtn.closest('.order-actions-menu')?.classList.remove('open');
      if (!localStorage.getItem('s4l_token')) {
        localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
        window.location.href = '/account/signin.html';
        return;
      }
      openContactModal(contactBtn.dataset.productId, contactBtn.dataset.productName);
      return;
    }

    // Cancel item
    const cancelItemBtn = e.target.closest('.btn-cancel-item');
    if (cancelItemBtn) {
      if (!await showConfirm('Request cancellation for this item?')) return;
      const itemId  = cancelItemBtn.dataset.itemId;
      const orderId = new URLSearchParams(window.location.search).get('id');
      cancelItemBtn.disabled = true;
      cancelItemBtn.textContent = 'Requesting…';
      try {
        const res = await authFetch(`${API}/orders/${orderId}/items/${itemId}/cancel-request`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (!res.ok) { await showAlert(data.error || 'Cancel request failed'); return; }
        location.reload();
      } catch (err) {
        await showAlert('Something went wrong. Please try again.');
      } finally {
        cancelItemBtn.disabled = false;
        cancelItemBtn.textContent = 'Cancel this item';
      }
      return;
    }

    // Toggle form
    const showBtn = e.target.closest('.btn-show-return-form');
    if (showBtn) {
      const itemId = showBtn.dataset.itemId;
      const form   = document.getElementById(`return-form-${itemId}`);
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }

    // Toggle inline "write a review" form — reuses reviews.js's own
    // buildForm() so the write/submit logic lives in exactly one place.
    const showReviewBtn = e.target.closest('.btn-show-review-form');
    if (showReviewBtn) {
      const itemId    = showReviewBtn.dataset.itemId;
      const productId = showReviewBtn.dataset.productId;
      const container = document.getElementById(`review-form-${itemId}`);
      if (!container) return;

      if (container.childElementCount) {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
        return;
      }
      if (typeof window.buildReviewForm !== 'function') return;

      const formEl = window.buildReviewForm(productId, () => {
        container.style.display = 'none';
        container.innerHTML = '';
        showReviewBtn.innerHTML = '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 4l2.5 5.5L20 10l-4.2 4 1 5.8L12 17l-4.8 2.8 1-5.8L4 10l5.5-.5L12 4z"/></svg> Review this item';
      });
      container.appendChild(formEl);
      container.style.display = 'block';
      return;
    }

    // Cancel form
    const cancelBtn = e.target.closest('.btn-cancel-return-form');
    if (cancelBtn) {
      const form = document.getElementById(`return-form-${cancelBtn.dataset.itemId}`);
      if (form) form.style.display = 'none';
      return;
    }

    // Submit return request
    const submitBtn = e.target.closest('.btn-submit-return');
    if (!submitBtn) return;

    const itemId   = submitBtn.dataset.itemId;
    const form     = document.getElementById(`return-form-${itemId}`);
    const qty      = Number(form.querySelector('.return-qty-sel').value);
    const reasonCategory = form.querySelector('.return-category-sel').value;
    const reason   = form.querySelector('.return-reason-inp').value.trim();
    const params   = new URLSearchParams(window.location.search);
    const orderId  = params.get('id');

    if (!reasonCategory) {
      await showAlert('Please select a reason for the return.');
      return;
    }

    submitBtn.disabled   = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const res = await authFetch(`${API}/orders/${orderId}/items/${itemId}/return-request`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ quantity: qty, reason, reasonCategory }),
      });
      const data = await res.json();
      if (!res.ok) { await showAlert(data.error || 'Return request failed'); return; }
      location.reload();
    } catch (err) {
      console.error(err);
      await showAlert('Something went wrong. Please try again.');
    } finally {
      submitBtn.disabled   = false;
      submitBtn.textContent = 'Submit Request';
    }
  });
}

/* ======================================================
   LIVE UPDATE (status only — no full rebuild)
====================================================== */
async function refreshOrderStatus() {
  const params    = new URLSearchParams(window.location.search);
  const orderId   = params.get('id');
  if (!orderId) return;

  try {
    const res = await authFetch(`${API}/orders/${orderId}`);
    if (!res.ok) return;
    const order = await res.json();

    const statusEl  = document.querySelector('.order-status');
    const paymentEl = document.querySelector('.payment-status');

    if (statusEl) statusEl.innerHTML = window.s4lStatusBadge ? window.s4lStatusBadge(order.status) : order.status;

    if (paymentEl) {
      const payment = (order.paymentStatus || '').toLowerCase();
      const label   =
        payment === 'paid'                ? 'Paid' :
        payment === 'refund_scheduled'    ? 'Refund Scheduled' :
        payment === 'refunded'            ? 'Refunded' :
        payment === 'partially_refunded'  ? 'Partially Refunded' :
        payment === 'failed'              ? 'Failed' : 'Unpaid';
      paymentEl.textContent = label;
      paymentEl.className   = `payment-status ${payment}`;
    }
  } catch (err) {
    console.error('Live update failed:', err);
  }
}

/* ======================================================
   ACTION DROPDOWN (one per item)
====================================================== */
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.order-actions-toggle');
  if (toggle) {
    const menu = toggle.parentElement.querySelector('.order-actions-menu');
    // Close any other open menus first
    document.querySelectorAll('.order-actions-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
    menu?.classList.toggle('open');
    return;
  }
  if (!e.target.closest('.order-actions-wrapper')) {
    document.querySelectorAll('.order-actions-menu.open').forEach(m => m.classList.remove('open'));
  }

  // Order activity history — hover already peeks it (CSS); a click pins
  // it open so it stays visible without holding the mouse there.
  const historyToggle = e.target.closest('.order-history-toggle');
  if (historyToggle) {
    historyToggle.classList.toggle('open');
    historyToggle.nextElementSibling?.classList.toggle('open');
  }
});

/* ======================================================
   INIT
====================================================== */
ensureReturnHandler();
loadOrderDetails();

startLiveUpdates(() => {
  refreshOrderStatus();
});
