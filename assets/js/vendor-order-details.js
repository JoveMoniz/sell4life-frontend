// ======================================================
// VENDOR ORDER DETAILS — per-item return processing
// ======================================================

console.log('vendor-order-details loaded');

function authFetch(url, opts = {}) {
  const token = localStorage.getItem('s4l_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, credentials: 'include', headers });
}

let timerInterval;

// Vendor payouts are always GBP regardless of what the buyer was charged —
// this is purely informational, so it's a hover tooltip on the visible £
// figures, and a plain-text parenthetical inside showConfirm/showAlert
// dialogs (which can't render HTML). Mirrors the same pair of helpers on
// admin order pages.
function gbp(value) {
  const order = window._currentOrder;
  const gbpAmount = Number(value) || 0;
  const text = '£' + gbpAmount.toFixed(2);
  const isInternational = order?.chargeCurrency && order.chargeCurrency !== 'GBP';
  if (!isInternational) return text;
  const chargeRate   = Number(order.chargeToGbpRate) || 1;
  const chargeSymbol = order.displayCurrencySymbol || '$';
  const chargeAmount = (gbpAmount * chargeRate).toFixed(2);
  return `<span title="Buyer charged ${chargeSymbol}${chargeAmount} ${order.chargeCurrency}" style="cursor:help;border-bottom:1px dotted #9ca3af">${text}</span>`;
}

function gbpText(value) {
  const order = window._currentOrder;
  const gbpAmount = Number(value) || 0;
  const text = '£' + gbpAmount.toFixed(2);
  const isInternational = order?.chargeCurrency && order.chargeCurrency !== 'GBP';
  if (!isInternational) return text;
  const chargeRate   = Number(order.chargeToGbpRate) || 1;
  const chargeSymbol = order.displayCurrencySymbol || '$';
  const chargeAmount = (gbpAmount * chargeRate).toFixed(2);
  return `${text} (buyer charged ${chargeSymbol}${chargeAmount} ${order.chargeCurrency})`;
}

const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');
const container = document.getElementById('vendor-order-details');

if (!container || !orderId) {
  if (container) container.innerHTML = '<p>Invalid access</p>';
  throw new Error('Missing order ID');
}

/* ======================================================
   BADGE CONFIGS
====================================================== */
// Badge rendering lives in the shared order-status.js so buyer/vendor/admin
// all show the exact same colors for the same status.
function badge(kind, status) {
  if (kind === 'return') return window.s4lReturnBadge ? window.s4lReturnBadge(status) : '';
  if (kind === 'refund') return window.s4lRefundBadge ? window.s4lRefundBadge(status) : '';
  return '';
}

/* ======================================================
   LABELS
====================================================== */
function getVendorLabel(type) {
  const map = {
    Processing:       'Start Processing',
    Shipped:          'Mark Shipped',
    Delivered:        'Mark Delivered',
    'Return Approved': 'Approve Return',
    'Return Rejected': 'Reject Return',
    Returned:         'Mark Returned',
    Cancelled:        'Cancel Order',
    'Cancel Approved': 'Approve Cancellation',
  };
  return map[type] || type;
}

/* ======================================================
   PAYMENT LABEL
====================================================== */
function getPaymentLabel(paymentStatus) {
  switch ((paymentStatus || '').toLowerCase()) {
    case 'paid':                return 'Paid';
    case 'refund_scheduled':    return 'Refund Scheduled';
    case 'refunded':            return 'Refunded';
    case 'partially_refunded':  return 'Partially Refunded';
    case 'failed':              return 'Failed';
    default:                    return 'Pending';
  }
}

/* ======================================================
   DISPLAY STATUS
====================================================== */
function getDisplayStatus(order) {
  const payment = (order.paymentStatus || '').toLowerCase();
  const statusBadge = window.s4lStatusBadge ? window.s4lStatusBadge(order.status) : order.status;
  if (payment === 'refunded') {
    return `${statusBadge} ${window.s4lRefundBadge ? window.s4lRefundBadge('processed') : '• Refunded'}`;
  }
  return statusBadge;
}

/* ======================================================
   BUILD ORDER-LEVEL ACTIONS (no itemId)
====================================================== */
function buildOrderActions(actions, id, vendorPayment) {
  if (!['paid', 'partially_refunded', 'refund_scheduled'].includes(vendorPayment)) {
    return '<p>Payment not completed.</p>';
  }
  if (vendorPayment === 'refund_scheduled') return '<p>Refund in progress. No actions available.</p>';
  if (vendorPayment === 'refunded') return '<p>Order fully refunded.</p>';

  const buttons = actions.map(a => `
    <button class="vendor-order-btn"
      data-type="${a.type}"
      data-order-id="${id}"
      style="padding:8px 16px;margin-right:8px;margin-bottom:8px;cursor:pointer;border-radius:4px;border:1px solid #d1d5db">
      ${getVendorLabel(a.type)}
    </button>
  `).join('');

  return buttons || '<p>No actions available</p>';
}

/* ======================================================
   BUILD PER-ITEM HTML
====================================================== */
function buildItemHTML(item, itemActions, id, paymentStatus) {
  const qty      = Number(item.quantity || 1);
  const price    = Number(item.price || 0);
  const reqQty   = Number(item.returnRequestedQuantity || 0);
  const appQty   = Number(item.returnApprovedQuantity || 0);
  const retQty   = Number(item.returnQuantity || 0);
  const refQty   = Number(item.refundedQuantity || 0);

  const STATUS_BADGE = {
    'Pending':          { label: 'Pending',          color: '#92400e', bg: '#fef3c7' },
    'Processing':       { label: 'Processing',       color: '#1d4ed8', bg: '#dbeafe' },
    'Shipped':          { label: 'Shipped',           color: '#6d28d9', bg: '#ede9fe' },
    'Delivered':        { label: 'Delivered',         color: '#15803d', bg: '#dcfce7' },
    'Cancel Requested': { label: 'Cancel Requested', color: '#92400e', bg: '#fef3c7' },
    'Cancelled':        { label: 'Cancelled',         color: '#b91c1c', bg: '#fee2e2' },
  };
  const badges = [
    badge(STATUS_BADGE, item.status || 'Pending'),
    badge('return', item.returnStatus),
    badge('refund', item.refundStatus),
  ].filter(Boolean).join(' ');

  const qtyDetail = [
    reqQty > 0 ? `${reqQty} requested` : '',
    retQty > 0 ? `${retQty} returned`  : '',
    refQty > 0 ? `${refQty} refunded`  : '',
  ].filter(Boolean).join(' · ');

  // Preview amount shown in the cancel confirm dialogs below — mirrors the
  // backend's calculateItemRefundAmount() for a cancel (no postage deduction;
  // that only applies to change-of-mind returns). Purely informational: the
  // actual Stripe refund is capped server-side against the real remaining
  // charge balance regardless of what's shown here.
  const cancelQty = Math.max(0, Number(item.quantity || 0) - Number(item.refundedQuantity || 0));
  const cancelRefundPreview = Math.max(0,
    (Number(item.price || 0) * cancelQty) + Number(item.shippingCost || 0) - Number(item.discountAmount || 0)
  ).toFixed(2);
  const cjStatusAttr = item.cjOrderId ? ` data-cj-status="${item.cjOrderStatus || 'unknown'}"` : '';

  const actionsHTML = itemActions.map(a => {
    // ── Fulfillment ──────────────────────────────────────
    if (a.type === 'Processing') {
      return `
        <button class="vendor-item-btn"
          data-type="Processing" data-order-id="${id}" data-item-id="${a.itemId}"
          style="margin-top:6px;padding:5px 12px;background:#1d4ed8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.82rem">
          Start Processing
        </button>`;
    }
    if (a.type === 'Shipped') {
      return `
        <button class="vendor-item-btn"
          data-type="Shipped" data-order-id="${id}" data-item-id="${a.itemId}"
          style="margin-top:6px;padding:5px 12px;background:#6d28d9;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.82rem">
          Mark Shipped
        </button>`;
    }
    if (a.type === 'Delivered') {
      return `
        <button class="vendor-item-btn"
          data-type="Delivered" data-order-id="${id}" data-item-id="${a.itemId}"
          style="margin-top:6px;padding:5px 12px;background:#15803d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.82rem">
          Mark Delivered
        </button>`;
    }
    // ── Vendor-initiated cancel ───────────────────────────
    if (a.type === 'Vendor Cancel') {
      return `
        <button class="vendor-item-btn vendor-cancel-btn"
          data-type="Vendor Cancel" data-order-id="${id}" data-item-id="${a.itemId}" data-refund-preview="${cancelRefundPreview}"${cjStatusAttr}
          style="margin-top:6px;padding:5px 12px;background:#fff;color:#b91c1c;border:1px solid #b91c1c;border-radius:4px;cursor:pointer;font-size:0.82rem">
          Cancel Item
        </button>`;
    }
    // ── Customer cancel approval ──────────────────────────
    if (a.type === 'Cancel Approved') {
      return `
        <button class="vendor-item-btn"
          data-type="Cancel Approved" data-order-id="${id}" data-item-id="${a.itemId}" data-refund-preview="${cancelRefundPreview}"${cjStatusAttr}
          style="margin-top:6px;padding:5px 12px;background:#b91c1c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.82rem">
          Approve Cancellation
        </button>`;
    }
    // ── Return handling ───────────────────────────────────
    if (a.type === 'Return Approved') {
      return `
        <button class="vendor-item-btn"
          data-type="Return Approved" data-order-id="${id}" data-item-id="${a.itemId}" data-qty="${reqQty || qty}"
          style="margin-top:6px;padding:5px 12px;background:#1d4ed8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.82rem">
          Approve Return
        </button>`;
    }
    if (a.type === 'Return Rejected') {
      return `
        <button class="vendor-item-btn"
          data-type="Return Rejected" data-order-id="${id}" data-item-id="${a.itemId}"
          style="margin-top:6px;padding:5px 12px;background:#b91c1c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.82rem">
          Reject Return
        </button>`;
    }
    if (a.type === 'Returned') {
      const remainingQty = Math.max(1, appQty - retQty) || qty;
      return `
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px">
          <select class="condition-select"
            style="padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:0.8rem">
            <option value="used">Used</option>
            <option value="good">Good</option>
            <option value="new">New</option>
            <option value="damaged">Damaged</option>
          </select>
          <button class="vendor-item-btn"
            data-type="Returned" data-order-id="${id}" data-item-id="${a.itemId}" data-qty="${remainingQty}"
            style="padding:5px 12px;background:#111;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.82rem">
            Mark Returned
          </button>
        </div>`;
    }
    return '';
  }).join('');

  // ── Goodwill refund (no return required) ────────────────────
  const maxGoodwill = Math.max(0,
    price * qty
    + Number(item.shippingCost || 0)
    - Number(item.discountAmount || 0)
    - Number(item.refundedAmount || 0)
  );
  // Gate on whether money is actually left to refund (maxGoodwill), not on
  // whether a refund has happened before or the item was cancelled — a
  // cancelled item or a return with shipping withheld can still have real
  // unrefunded value (e.g. the withheld/underpaid shipping) sitting on it.
  const goodwillEligible = ['paid', 'partially_refunded', 'refunded'].includes(paymentStatus)
    && item.refundStatus !== 'scheduled'
    && maxGoodwill > 0;

  const goodwillHTML = goodwillEligible ? `
    <div style="margin-top:8px">
      <button class="btn-show-goodwill-form" data-item-id="${item._id}"
        style="padding:5px 12px;background:#fff;color:#0b6b6a;border:1px solid #0b6b6a;border-radius:4px;cursor:pointer;font-size:0.82rem">
        Goodwill Refund (no return required)
      </button>
      <div class="goodwill-form" id="goodwill-form-${item._id}" style="display:none;margin-top:8px;padding:10px;border:1px solid #e5e7eb;border-radius:6px;max-width:320px">
        <label style="display:block;margin-bottom:6px;font-size:0.85rem">
          Refund amount (max £${maxGoodwill.toFixed(2)}):
          <input class="goodwill-amount-inp" type="number" min="0.01" max="${maxGoodwill.toFixed(2)}" step="0.01" value="${maxGoodwill.toFixed(2)}"
            style="display:block;width:100%;margin-top:4px;padding:6px;border:1px solid #d1d5db;border-radius:4px;box-sizing:border-box" />
        </label>
        <label style="display:block;margin-bottom:8px;font-size:0.85rem">
          Reason (required):
          <input class="goodwill-reason-inp" type="text" placeholder="e.g. low-value item, return postage not worth it"
            style="display:block;width:100%;margin-top:4px;padding:6px;border:1px solid #d1d5db;border-radius:4px;box-sizing:border-box" />
        </label>
        <p style="font-size:0.75rem;color:#9ca3af;margin:0 0 8px">Scheduled 24h out so you can cancel it if needed. No item return required.</p>
        <div style="display:flex;gap:8px">
          <button class="btn-submit-goodwill" data-item-id="${item._id}" data-order-id="${id}" data-max="${maxGoodwill.toFixed(2)}"
            style="padding:6px 14px;background:#0b6b6a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:0.85rem">
            Schedule Refund
          </button>
          <button class="btn-cancel-goodwill-form" data-item-id="${item._id}"
            style="padding:6px 14px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:0.85rem">
            Cancel
          </button>
        </div>
      </div>
    </div>` : '';

  const retryRefundHTML = item.refundStatus === 'failed' ? `
    <button class="btn-retry-refund" data-order-id="${id}" data-item-id="${item._id}"
      style="padding:5px 12px;background:#fff;color:#b91c1c;border:1px solid #b91c1c;border-radius:4px;cursor:pointer;font-size:0.82rem">
      ↻ Retry Refund
    </button>` : '';

  const goodwillScheduledHTML = (item.goodwillRefund && item.refundStatus === 'scheduled') ? `
    <div style="margin-top:8px;padding:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:0.8rem;color:#92400e">
      Goodwill refund of ${gbp(item.goodwillRefundAmount || 0)} scheduled —
      <strong class="goodwill-countdown" data-time="${item.refundScheduledAt}"></strong>
      <div style="font-size:0.72rem;color:#a16207;margin-top:2px">Executes ${new Date(item.refundScheduledAt).toLocaleString()}</div>
      <button class="btn-cancel-goodwill" data-item-id="${item._id}" data-order-id="${id}"
        style="margin-top:6px;padding:3px 8px;background:#fff;border:1px solid #b91c1c;color:#b91c1c;border-radius:4px;cursor:pointer;font-size:0.78rem">
        Cancel
      </button>
    </div>` : '';

  const img = typeof item.image === 'string'
    ? item.image
    : '/assets/images/products/sell4life-placeholder.png';

  const historyHTML = Array.isArray(item.returnHistory) && item.returnHistory.length
    ? `<div style="margin-top:12px">
        <button type="button" class="s4l-collapse-toggle" style="font-size:0.75rem;color:#6b7280">
          History (${item.returnHistory.length}) <span class="s4l-collapse-caret">▾</span>
        </button>
        <ul class="s4l-collapse-body" style="padding-left:16px;font-size:0.75rem;color:#374151">
          ${item.returnHistory.slice().sort((a, b) => new Date(a.at) - new Date(b.at)).map(h =>
            `<li>${new Date(h.at).toLocaleString()} — ${h.note || h.type}${h.quantity > 0 ? ` ×${h.quantity}` : ''}</li>`
          ).join('')}
        </ul>
      </div>`
    : '';

  // Shipped items stay selectable too, so tracking can be added/updated
  // after the fact — the fulfillment status just won't be re-sent for them
  // since Processing -> Shipped is the only valid forward transition.
  const trackable = ['Processing', 'Shipped'].includes(item.status);

  return `
    <div class="order-item order-item--selectable">
      ${trackable
        ? `<input type="checkbox" class="item-select-cb" data-item-id="${item._id}" data-status="${item.status}" />`
        : `<span></span>`
      }
      <img src="${img}" width="60" height="60"
        onerror="this.src='/assets/images/products/sell4life-placeholder.png'" />
      <div style="flex:1">
        <div>${item.name || 'Unnamed product'}</div>
        ${window.s4lVariantLabel && window.s4lVariantLabel(item.attributes)
          ? `<div style="font-size:0.8rem;color:#0b6b6a;font-weight:600;margin-top:2px">${window.s4lVariantLabel(item.attributes)}</div>`
          : ''}
        <div style="font-size:0.85rem;color:#6b7280">Qty: ${qty} × ${gbp(price)}</div>
        ${item.supplierUrl ? `
          <a href="${item.supplierUrl}" target="_blank" rel="noopener"
            style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:3px 10px;background:#f0f9f8;border:1px solid #0b6b6a;color:#0b6b6a;border-radius:4px;font-size:0.75rem;font-weight:600;text-decoration:none">
            <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M9 15l6-6"/><path d="M13 5l1.5-1.5a3.5 3.5 0 015 5L18 10"/><path d="M11 19l-1.5 1.5a3.5 3.5 0 01-5-5L6 14"/></svg> ${item.supplier ? `Open ${item.supplier}` : 'Open supplier listing'}
          </a>` : ''}
        ${item.cjOrderId && item.status === 'Pending' && (!item.cjOrderStatus || item.cjOrderStatus === 'CREATED') ? `
          <div style="margin-top:4px;padding:3px 10px;background:#fffbeb;border:1px solid #f59e0b;color:#92400e;border-radius:4px;font-size:0.75rem;font-weight:600;display:inline-block">
            <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3l9 16H3L12 3z"/><path d="M12 10v4M12 17h.01"/></svg> CJ order created (${item.cjOrderNumber || item.cjOrderId}) —
            <a href="https://cjdropshipping.com/mine/dropshipping/orderList?orderType=3&childType=1" target="_blank" rel="noopener"
              style="color:#92400e;text-decoration:underline">go pay for it in your CJ dashboard</a>
            (sorted newest first — it'll be at the top)
          </div>` : ''}
        ${item.cjOrderId && item.status === 'Pending' && item.cjOrderStatus && item.cjOrderStatus !== 'CREATED' && item.cjOrderStatus !== 'failed' ? `
          <div style="margin-top:4px;padding:3px 10px;background:#f0f9f8;border:1px solid #0b6b6a;color:#0b6b6a;border-radius:4px;font-size:0.75rem;font-weight:600;display:inline-block">
            <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg> Paid on CJ (${item.cjOrderNumber || item.cjOrderId}) — waiting for the supplier to dispatch it
          </div>` : ''}
        ${item.cjOrderStatus === 'failed' && item.status === 'Pending' ? `
          <div style="margin-top:4px;padding:3px 10px;background:#fef2f2;border:1px solid #fca5a5;color:#b91c1c;border-radius:4px;font-size:0.75rem;font-weight:600;display:inline-block">
            <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3l9 16H3L12 3z"/><path d="M12 10v4M12 17h.01"/></svg> CJ auto-order failed — place this order manually (${item.cjOrderError || 'unknown error'})
          </div>` : ''}
        ${item.cjCancelDenied ? `
          <div style="margin-top:4px;padding:3px 10px;background:${item.refundStatus === 'requested' ? '#fef2f2' : '#fffbeb'};border:1px solid ${item.refundStatus === 'requested' ? '#ef4444' : '#f59e0b'};color:${item.refundStatus === 'requested' ? '#991b1b' : '#92400e'};border-radius:4px;font-size:0.75rem;font-weight:600;display:inline-block">
            <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3l9 16H3L12 3z"/><path d="M12 10v4M12 17h.01"/></svg> ${
              item.refundStatus === 'requested'
                ? "Cancellation requested, but CJ never confirmed it and automatic retry has stopped — needs your decision (retry below, or contact admin about a manual refund)."
                : "Cancellation requested, but CJ couldn't stop the shipment — it may already be on its way. We keep asking CJ automatically; the refund fires as soon as they confirm the cancellation."
            }
            ${item.cjOrderStatus !== 'cancelled' ? `
              <button class="btn-retry-cj-cancel" data-item-id="${item._id}"
                style="display:block;margin-top:4px;padding:3px 8px;background:#fff;border:1px solid #92400e;color:#92400e;border-radius:4px;cursor:pointer;font-size:0.72rem">
                Retry CJ cancel
              </button>
              <button class="btn-abandon-cj-cancel" data-item-id="${item._id}"
                style="display:block;margin-top:4px;padding:3px 8px;background:#fff;border:1px solid #6b7280;color:#374151;border-radius:4px;cursor:pointer;font-size:0.72rem">
                Keep item — stop trying to cancel
              </button>` : ''}
          </div>` : ''}
        ${item.cjOrderId && item.cjOrderStatus !== 'failed' && item.cjOrderStatus !== 'cancelled' && (item.status === 'Cancelled' || item.returnStatus === 'returned') ? `
          <div style="margin-top:4px;padding:3px 10px;background:#fffbeb;border:1px solid #f59e0b;color:#92400e;border-radius:4px;font-size:0.75rem;font-weight:600;display:inline-block">
            <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M12 3l9 16H3L12 3z"/><path d="M12 10v4M12 17h.01"/></svg> ${item.status === 'Cancelled' ? 'Cancelled' : 'Returned'} on Sell4Life, but a CJ order (${item.cjOrderNumber || item.cjOrderId}) was already created —
            <a href="https://cjdropshipping.com/mine/dropshipping/orderList?orderType=3&childType=1" target="_blank" rel="noopener"
              style="color:#92400e;text-decoration:underline">check/cancel it in your CJ dashboard</a>
            <button class="btn-retry-cj-cancel" data-item-id="${item._id}"
              style="display:block;margin-top:4px;padding:3px 8px;background:#fff;border:1px solid #92400e;color:#92400e;border-radius:4px;cursor:pointer;font-size:0.72rem">
              Retry CJ cancel
            </button>
          </div>` : ''}
        ${badges    ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px">${badges}</div>` : ''}
        ${qtyDetail ? `<div style="font-size:0.75rem;color:#9ca3af;margin-top:6px">${qtyDetail}</div>` : ''}
        ${item.trackingNumber
          ? `<div style="font-size:0.78rem;color:#374151;margin-top:10px">
               <span style="color:#15803d"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg></span>
               <strong>${item.trackingNumber}</strong>${item.carrier ? ` via ${item.carrier}` : ''}
             </div>`
          : ''}
        ${historyHTML}
        <div class="order-actions-wrapper" style="margin-top:14px">
          <button class="order-actions-toggle" data-item-id="${item._id}" style="font-size:0.8rem;padding:4px 12px">Actions <span class="oat-caret">▾</span></button>
          <div class="order-actions-menu" id="item-actions-menu-${item._id}">
            ${(actionsHTML || goodwillHTML || goodwillScheduledHTML || retryRefundHTML) ? `
              ${actionsHTML}
              ${retryRefundHTML}
              ${goodwillHTML}
              ${goodwillScheduledHTML}
            ` : '<p style="margin:0;font-size:0.78rem;color:#9ca3af">No actions available</p>'}
          </div>
        </div>
      </div>
      <div class="order-price">${gbp(qty * price)}</div>
    </div>`;
}

/* ======================================================
   LOAD ORDER
====================================================== */
async function loadOrder() {
  try {
    const [orderRes, vendorRes] = await Promise.all([
      authFetch(`${API_BASE}/vendor/orders/${orderId}`),
      authFetch(`${API_BASE}/vendor/me`),
    ]);

    if (orderRes.status === 401 || orderRes.status === 403) {
      localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
      window.location.href = '/account/signin.html';
      return;
    }
    if (!orderRes.ok) throw new Error('Order not found');

    const order      = await orderRes.json();
    const vendorData = await vendorRes.json();
    const vendor     = vendorData.vendor;

    if (!vendor) { container.innerHTML = '<p>Create your store first</p>'; return; }
    if (vendor.status === 'pending')   { container.innerHTML = '<p>Your store is under review</p>'; return; }
    if (vendor.status === 'suspended') { container.innerHTML = '<p>Your store is suspended</p>'; return; }

    window._currentOrder = order;

    const id        = order._id || order.id;
    const displayId = order.shortId || `S4L-${id.slice(0, 10).toUpperCase()}`;
    const vendorId  = vendor._id;

    const vendorOrder = (order.vendorOrders || []).find(
      vo => String(vo.vendorId) === String(vendorId)
    );

    const vendorRefundScheduledAt = vendorOrder?.refundScheduledAt || order.refundScheduledAt || null;

    const vendorItems = (order.items || []).filter(
      item => String(item.vendorId) === String(vendorId)
    );

    // Derive payment status from this vendor's items only so one vendor's refund
    // doesn't bleed into the other vendor's payment display.
    const orderPayment = (order.paymentStatus || 'pending').toLowerCase();
    const vendorRefundStatuses = vendorItems.map(i => i.refundStatus || 'none');
    // Covers both a Return-triggered refund AND a Cancel-triggered refund —
    // item.refundStatus is set to 'scheduled' by both flows on the backend,
    // whereas returnStatus is only ever set by the Return flow. Checking
    // returnStatus alone (the original condition) meant a cancelled item's
    // scheduled refund never flipped paymentStatus to 'refund_scheduled'
    // here, silently hiding the countdown timer below for every cancel.
    const vendorHasScheduledRefund = vendorRefundStatuses.some(s => s === 'scheduled');
    const paymentStatus = !['paid', 'partially_refunded', 'refunded', 'refund_scheduled'].includes(orderPayment)
      ? orderPayment
      : vendorRefundStatuses.every(s => s === 'processed')
        ? 'refunded'
        : vendorRefundStatuses.some(s => ['processed', 'partially_refunded'].includes(s))
          ? 'partially_refunded'
          : (orderPayment === 'refund_scheduled' && vendorHasScheduledRefund)
            ? 'refund_scheduled'
            : 'paid';
    const paymentLabel = getPaymentLabel(paymentStatus);

    const vendorSubtotal = vendorItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity), 0
    );
    const vendorShipping = vendorOrder?.shipping
      ?? vendorItems.reduce((sum, item) => sum + Number(item.shippingCost || 0), 0);
    const vendorTotal = vendorSubtotal + vendorShipping;

    // All actions are now per-item — build itemActionsMap only
    const allowed = Array.isArray(order.allowedActions) ? order.allowedActions : [];

    const itemActionsMap = {};
    allowed.forEach(a => {
      if (!a.itemId) return;
      const key = String(a.itemId);
      if (!itemActionsMap[key]) itemActionsMap[key] = [];
      itemActionsMap[key].push(a);
    });

    const vendorStatus = order.status || vendorOrder?.status || 'Unknown';
    const hasTrackable = vendorItems.some(i => i.status === 'Processing');

    const placedAt = order.createdAt
      ? new Date(order.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';

    const statusHistoryHTML = Array.isArray(order.statusHistory) && order.statusHistory.length
      ? `<div style="margin-top:8px">
          <button type="button" class="s4l-collapse-toggle" style="font-size:0.75rem;color:#6b7280">
            Status history (${order.statusHistory.length}) <span class="s4l-collapse-caret">▾</span>
          </button>
          <ul class="s4l-collapse-body" style="padding-left:16px;font-size:0.75rem;color:#374151">
            ${order.statusHistory.slice().sort((a, b) => new Date(a.date) - new Date(b.date)).map(h =>
              `<li>${new Date(h.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — ${h.status}${h.note ? ` (${h.note})` : ''}</li>`
            ).join('')}
          </ul>
        </div>`
      : '';

    const addr = order.shippingAddress;
    const shippingAddressHTML = addr ? `
      <div class="shipping-address-block" style="margin-bottom:14px;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:0.85rem;line-height:1.5">
        <div style="font-weight:700;margin-bottom:2px">${addr.name || ''}</div>
        ${addr.address1 ? `<div>${addr.address1}</div>` : ''}
        ${addr.address2 ? `<div>${addr.address2}</div>` : ''}
        <div>${[addr.city, addr.county, addr.postcode].filter(Boolean).join(', ')}</div>
        ${addr.country ? `<div>${addr.country}</div>` : ''}
        ${addr.phone ? `<div style="margin-top:4px;color:#6b7280"><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 4h3.5l1.5 4-2 1.5c1 2.2 2.8 4 5 5l1.5-2 4 1.5V17a1.5 1.5 0 01-1.6 1.5A15 15 0 015 5.6 1.5 1.5 0 015 4z"/></svg> ${addr.phone}</div>` : ''}
      </div>` : '<p style="font-size:0.85rem;color:#9ca3af">No shipping address on file</p>';

    container.innerHTML = `
      <div class="order-details-card">
        <h2>Order ${displayId}</h2>
        ${placedAt ? `<div class="order-placed-date">Placed ${placedAt}</div>` : ''}

        <div class="order-status">
          <div>Status: <strong>${getDisplayStatus({ ...order, status: vendorStatus, refundScheduledAt: vendorRefundScheduledAt, paymentStatus })}</strong></div>
          <div>Payment: <strong>${paymentLabel}</strong></div>
        </div>
        ${paymentStatus === 'refund_scheduled' && vendorRefundScheduledAt ? `
          <div class="refund-info" style="margin:-10px 0 14px;padding:6px 10px;background:#fffbeb;border:1px solid #f59e0b;color:#92400e;border-radius:6px;font-size:0.82rem;display:inline-block">
            Refund scheduled for ${new Date(order.refundScheduledAt).toLocaleString()}
            <span id="refund-timer" data-time="${order.refundScheduledAt}"></span>
          </div>` : ''}
        ${statusHistoryHTML}

        <div class="order-items">
          ${vendorItems.length === 0
            ? '<p>No items for this vendor</p>'
            : vendorItems.map(item =>
                buildItemHTML(item, itemActionsMap[String(item._id)] || [], id, paymentStatus)
              ).join('')}
        </div>

        <div class="order-total">
          ${vendorShipping > 0 ? `<div style="font-size:0.88rem;color:#6b7280;font-weight:400;text-align:right;margin-bottom:4px">Items: ${gbp(vendorSubtotal)} + Shipping: ${gbp(vendorShipping)}</div>` : ''}
          Total: ${gbp(vendorTotal)}
        </div>

        <div class="tracking-card">
          <div class="select-all-row">
            <h3>Shipping &amp; Tracking</h3>
            ${hasTrackable ? `
            <label class="select-all-label">
              <input type="checkbox" id="select-all-items" style="cursor:pointer;accent-color:#0b6b6a" />
              Select all
            </label>` : ''}
          </div>
          ${shippingAddressHTML}
          ${hasTrackable ? `<p class="tracking-hint">Tick the items above that share this shipment, then enter the tracking details.</p>` : ''}
          <div class="tracking-fields">
            <div>
              <label style="display:block;font-size:0.8rem;color:#6b7280;margin-bottom:4px">Tracking number</label>
              <input id="tracking-number" type="text" placeholder="e.g. JD123456789GB" style="width:200px" />
            </div>
            <div>
              <label style="display:block;font-size:0.8rem;color:#6b7280;margin-bottom:4px">Carrier (optional)</label>
              <input id="tracking-carrier" type="text" placeholder="e.g. Royal Mail" style="width:160px" />
            </div>
            <button id="save-tracking-btn" class="btn-save-tracking">Save &amp; Notify Buyer</button>
          </div>
          <p id="tracking-msg" class="tracking-msg"></p>
        </div>

      </div>`;

    initTimer();
    initGoodwillTimers();
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p>Could not load order</p>';
  }
}

/* ======================================================
   TIMER
====================================================== */
function initTimer() {
  const el = document.getElementById('refund-timer');
  if (!el) return;

  const target = new Date(el.dataset.time).getTime();

  function update() {
    const diff = target - Date.now();
    if (diff <= 0) { el.textContent = 'Refund processing...'; return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `Refund in: ${h}h ${m}m ${s}s`;
  }

  update();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(update, 1000);
}

/* ======================================================
   GOODWILL REFUND COUNTDOWNS (one per scheduled item)
====================================================== */
let goodwillTimerInterval;

function formatCountdown(diffMs) {
  if (diffMs <= 0) return 'Processing…';
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const s = Math.floor((diffMs % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

function initGoodwillTimers() {
  const els = document.querySelectorAll('.goodwill-countdown');
  if (!els.length) {
    if (goodwillTimerInterval) clearInterval(goodwillTimerInterval);
    return;
  }

  function update() {
    els.forEach((el) => {
      const target = new Date(el.dataset.time).getTime();
      el.textContent = formatCountdown(target - Date.now());
    });
  }

  update();
  if (goodwillTimerInterval) clearInterval(goodwillTimerInterval);
  goodwillTimerInterval = setInterval(update, 1000);
}

/* ======================================================
   UPDATE ITEM STATUS (per-item endpoints)
====================================================== */
async function updateItemStatus(oid, itemId, type, qty, condition) {
  let url, body;

  if (['Processing', 'Shipped', 'Delivered'].includes(type)) {
    url  = `${API_BASE}/vendor/orders/${oid}/items/${itemId}/fulfillment`;
    body = { status: type };
  } else if (type === 'Vendor Cancel') {
    url  = `${API_BASE}/vendor/orders/${oid}/items/${itemId}/vendor-cancel`;
    body = {};
  } else if (type === 'Return Approved') {
    url  = `${API_BASE}/vendor/orders/${oid}/items/${itemId}/approve-return`;
    body = { quantity: qty };
  } else if (type === 'Return Rejected') {
    url  = `${API_BASE}/vendor/orders/${oid}/items/${itemId}/reject-return`;
    body = { reason: 'Rejected by vendor' };
  } else if (type === 'Returned') {
    url  = `${API_BASE}/vendor/orders/${oid}/items/${itemId}/mark-returned`;
    body = { quantity: qty, condition };
  } else if (type === 'Cancel Approved') {
    url  = `${API_BASE}/vendor/orders/${oid}/items/${itemId}/approve-cancel`;
    body = {};
  } else {
    throw new Error(`Unknown item action: ${type}`);
  }

  const res = await authFetch(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Action failed');
  }
}

/* ======================================================
   UPDATE ORDER STATUS (order-level endpoints)
====================================================== */
async function updateOrderStatus(oid, type) {
  const res = await authFetch(`${API_BASE}/vendor/orders/${oid}/status`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status: type }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Update failed');
  }
}

/* ======================================================
   CLICK HANDLER (DELEGATED)
====================================================== */
document.addEventListener('click', async (e) => {
  // Actions dropdown: open/close (layer 1 of the 2-layer guard — an action
  // can't even be reached without deliberately opening its menu first; the
  // confirm dialog on each action is layer 2). Same pattern as the buyer-
  // facing order-details page (orders-details.js/.order-actions-*).
  const actionsToggle = e.target.closest('.order-actions-toggle');
  if (actionsToggle) {
    const menu = actionsToggle.parentElement.querySelector('.order-actions-menu');
    document.querySelectorAll('.order-actions-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
    menu?.classList.toggle('open');
    return;
  }
  if (!e.target.closest('.order-actions-wrapper')) {
    document.querySelectorAll('.order-actions-menu.open').forEach(m => m.classList.remove('open'));
  }

  // History / Status history collapsibles — was a native <details>, which
  // can't be CSS-animated; toggled the same way as the actions menu now.
  const collapseToggle = e.target.closest('.s4l-collapse-toggle');
  if (collapseToggle) {
    collapseToggle.classList.toggle('open');
    collapseToggle.nextElementSibling?.classList.toggle('open');
    return;
  }

  // Select-all checkbox
  if (e.target.id === 'select-all-items') {
    document.querySelectorAll('.item-select-cb').forEach(cb => { cb.checked = e.target.checked; });
    return;
  }
  // Deselect "select all" when any individual checkbox is unchecked
  if (e.target.classList.contains('item-select-cb') && !e.target.checked) {
    const selectAll = document.getElementById('select-all-items');
    if (selectAll) selectAll.checked = false;
  }

  // Save tracking to all checked items
  const saveBtn = e.target.closest('#save-tracking-btn');
  if (saveBtn) {
    const checked = [...document.querySelectorAll('.item-select-cb:checked')];
    const msg     = document.getElementById('tracking-msg');
    const trackingNumber = document.getElementById('tracking-number')?.value.trim();
    const carrier        = document.getElementById('tracking-carrier')?.value.trim();

    if (!trackingNumber) {
      if (msg) { msg.style.color = '#dc2626'; msg.textContent = 'Enter a tracking number first.'; }
      return;
    }
    if (!checked.length) {
      if (msg) { msg.style.color = '#dc2626'; msg.textContent = 'Select at least one item above.'; }
      return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';
    if (msg) msg.textContent = '';

    try {
      await Promise.all(checked.map(async cb => {
        const itemId = cb.dataset.itemId;

        // 1. Save tracking number
        const tr = await authFetch(`${API_BASE}/vendor/orders/${orderId}/items/${itemId}/tracking`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ trackingNumber, carrier }),
        });
        if (!tr.ok) throw new Error('Failed to save tracking');

        // Already-Shipped items just needed the tracking number updated —
        // Processing -> Shipped is the only valid forward transition, so
        // re-sending "Shipped" for one that's already there would be rejected.
        if (cb.dataset.status === 'Shipped') return;

        // 2. Mark as Shipped (tracking = shipped, same action for dropshipping)
        const sh = await authFetch(`${API_BASE}/vendor/orders/${orderId}/items/${itemId}/fulfillment`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ status: 'Shipped' }),
        });
        if (!sh.ok) throw new Error('Failed to mark as shipped');
      }));
      if (msg) { msg.style.color = '#15803d'; msg.textContent = `Shipped ${checked.length} item${checked.length > 1 ? 's' : ''}. Buyer notified.`; }
      saveBtn.innerHTML = 'Saved <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg>';
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      if (msg) { msg.style.color = '#dc2626'; msg.textContent = 'Save failed — please try again.'; }
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save & Notify Buyer';
    }
    return;
  }

  // Retry cancelling the matching CJ order (for items cancelled before
  // this feature existed, or whose first live attempt failed)
  const retryCjBtn = e.target.closest('.btn-retry-cj-cancel');
  if (retryCjBtn) {
    const itemId = retryCjBtn.dataset.itemId;
    retryCjBtn.disabled = true;
    retryCjBtn.textContent = 'Retrying…';
    try {
      const res = await authFetch(`${API_BASE}/vendor/orders/${orderId}/items/${itemId}/retry-cj-cancel`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) {
        window.showToast?.(data.error || 'CJ cancel failed', 'error');
        retryCjBtn.disabled = false;
        retryCjBtn.textContent = 'Retry CJ cancel';
        return;
      }
      window.showToast?.('CJ order cancelled');
      loadOrder();
    } catch (err) {
      window.showToast?.('Something went wrong', 'error');
      retryCjBtn.disabled = false;
      retryCjBtn.textContent = 'Retry CJ cancel';
    }
    return;
  }

  // Give up on the cancellation and let the shipment proceed — no refund
  // has fired yet at this point, this just clears the hold/retry state.
  const abandonCjBtn = e.target.closest('.btn-abandon-cj-cancel');
  if (abandonCjBtn) {
    const itemId = abandonCjBtn.dataset.itemId;
    const confirmed = await showConfirm('Keep this item?\n\nThis stops the automatic cancellation retries — no refund will be issued and the order continues as normal.');
    if (!confirmed) return;

    abandonCjBtn.disabled = true;
    abandonCjBtn.textContent = 'Updating…';
    try {
      const res = await authFetch(`${API_BASE}/vendor/orders/${orderId}/items/${itemId}/abandon-cj-cancel`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) {
        window.showToast?.(data.error || 'Failed to update', 'error');
        abandonCjBtn.disabled = false;
        abandonCjBtn.textContent = 'Keep item — stop trying to cancel';
        return;
      }
      window.showToast?.('Item kept — cancellation abandoned');
      loadOrder();
    } catch (err) {
      window.showToast?.('Something went wrong', 'error');
      abandonCjBtn.disabled = false;
      abandonCjBtn.textContent = 'Keep item — stop trying to cancel';
    }
    return;
  }

  // Per-item action buttons
  const itemBtn = e.target.closest('.vendor-item-btn');
  if (itemBtn) {
    const type   = itemBtn.dataset.type;
    const oid    = itemBtn.dataset.orderId;
    const itemId = itemBtn.dataset.itemId;
    const qty    = Number(itemBtn.dataset.qty || 1);

    // Surfaces the item's cached cjOrderStatus so the confirm dialog doesn't
    // read as if CJ is being ignored — the actual cancel attempt always
    // re-checks live with CJ regardless of what's shown here, this is just
    // visibility into what we already know going in.
    const cjStatus = itemBtn.dataset.cjStatus;
    const cjLine = cjStatus
      ? `\n\nLast known CJ status: ${cjStatus}. We'll confirm live with CJ before refunding — an already-dispatched item goes to manual review instead of an instant refund.`
      : '';

    if (type === 'Vendor Cancel') {
      const amt = itemBtn.dataset.refundPreview;
      const confirmed = await showConfirm(`Cancel this item?\n\nThis will refund ${gbpText(amt)} to the customer and cannot be undone.\n\nOnly proceed if you are certain you cannot fulfil this item.${cjLine}`);
      if (!confirmed) return;
    }

    if (type === 'Cancel Approved') {
      const amt = itemBtn.dataset.refundPreview;
      const confirmed = await showConfirm(`Approve this cancellation?\n\nThis will refund ${gbpText(amt)} to the customer and cannot be undone.${cjLine}`);
      if (!confirmed) return;
    }

    let condition = 'used';
    if (type === 'Returned') {
      const wrapper = itemBtn.closest('div');
      const sel = wrapper?.querySelector('.condition-select');
      if (sel) condition = sel.value;
    }

    itemBtn.disabled = true;
    itemBtn.textContent = 'Updating...';

    try {
      await updateItemStatus(oid, itemId, type, qty, condition);
      location.reload();
    } catch (err) {
      showToast(err.message || 'Action failed', 'error');
      itemBtn.disabled = false;
      itemBtn.textContent = getVendorLabel(type);
    }
    return;
  }

  // Retry a failed refund
  const retryRefundBtn = e.target.closest('.btn-retry-refund');
  if (retryRefundBtn) {
    const oid    = retryRefundBtn.dataset.orderId;
    const itemId = retryRefundBtn.dataset.itemId;
    retryRefundBtn.disabled = true;
    retryRefundBtn.textContent = 'Retrying...';
    try {
      const res = await authFetch(`${API_BASE}/vendor/orders/${oid}/items/${itemId}/retry-refund`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry failed');
      showToast('Refund retried successfully');
      location.reload();
    } catch (err) {
      showToast(err.message || 'Retry failed', 'error');
      retryRefundBtn.disabled = false;
      retryRefundBtn.textContent = '↻ Retry Refund';
    }
    return;
  }

  // Goodwill refund — show/hide form
  const showGoodwillBtn = e.target.closest('.btn-show-goodwill-form');
  if (showGoodwillBtn) {
    const form = document.getElementById(`goodwill-form-${showGoodwillBtn.dataset.itemId}`);
    if (form) form.style.display = 'block';
    return;
  }
  const cancelGoodwillFormBtn = e.target.closest('.btn-cancel-goodwill-form');
  if (cancelGoodwillFormBtn) {
    const form = document.getElementById(`goodwill-form-${cancelGoodwillFormBtn.dataset.itemId}`);
    if (form) form.style.display = 'none';
    return;
  }

  // Goodwill refund — submit
  const submitGoodwillBtn = e.target.closest('.btn-submit-goodwill');
  if (submitGoodwillBtn) {
    const itemId = submitGoodwillBtn.dataset.itemId;
    const oid    = submitGoodwillBtn.dataset.orderId;
    const max    = Number(submitGoodwillBtn.dataset.max || 0);
    const form   = document.getElementById(`goodwill-form-${itemId}`);
    const amount = Number(form?.querySelector('.goodwill-amount-inp')?.value);
    const reason = form?.querySelector('.goodwill-reason-inp')?.value.trim();

    if (!Number.isFinite(amount) || amount <= 0 || amount > max + 0.001) {
      showToast(`Enter an amount between £0.01 and £${max.toFixed(2)}`, 'error');
      return;
    }
    if (!reason) {
      showToast('Please explain the reason for this goodwill refund', 'error');
      return;
    }

    const confirmed = await showConfirm(`Schedule a ${gbpText(amount)} goodwill refund? No item return is required. It will execute in 24 hours unless you cancel it before then.`);
    if (!confirmed) return;

    submitGoodwillBtn.disabled = true;
    submitGoodwillBtn.textContent = 'Scheduling...';

    try {
      const res = await authFetch(`${API_BASE}/vendor/orders/${oid}/items/${itemId}/goodwill-refund`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule goodwill refund');
      location.reload();
    } catch (err) {
      showToast(err.message || 'Failed to schedule goodwill refund', 'error');
      submitGoodwillBtn.disabled = false;
      submitGoodwillBtn.textContent = 'Schedule Refund';
    }
    return;
  }

  // Goodwill refund — cancel a scheduled one
  const cancelGoodwillBtn = e.target.closest('.btn-cancel-goodwill');
  if (cancelGoodwillBtn) {
    const itemId = cancelGoodwillBtn.dataset.itemId;
    const oid    = cancelGoodwillBtn.dataset.orderId;

    const confirmed = await showConfirm('Cancel this scheduled goodwill refund?');
    if (!confirmed) return;

    cancelGoodwillBtn.disabled = true;
    cancelGoodwillBtn.textContent = 'Cancelling...';

    try {
      const res = await authFetch(`${API_BASE}/vendor/orders/${oid}/items/${itemId}/goodwill-refund/cancel`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel');
      location.reload();
    } catch (err) {
      showToast(err.message || 'Failed to cancel', 'error');
      cancelGoodwillBtn.disabled = false;
      cancelGoodwillBtn.textContent = 'Cancel';
    }
    return;
  }

  // Order-level action buttons
  const orderBtn = e.target.closest('.vendor-order-btn');
  if (orderBtn) {
    const type = orderBtn.dataset.type;
    const oid  = orderBtn.dataset.orderId;

    orderBtn.disabled = true;
    orderBtn.textContent = 'Updating...';

    try {
      await updateOrderStatus(oid, type);
      location.reload();
    } catch (err) {
      showToast(err.message || 'Action failed', 'error');
      orderBtn.disabled = false;
      orderBtn.textContent = getVendorLabel(type);
    }
  }
});

/* ======================================================
   INIT
====================================================== */
loadOrder();
