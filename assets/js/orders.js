// =====================================================
// SELL4LIFE – CUSTOMER ORDERS LIST (CLEAN)
// =====================================================

console.log('orders.js running');

const API = window.API_BASE;

async function initOrders() {
  localStorage.setItem('s4l_orders_seen', Date.now());
  const token = localStorage.getItem('s4l_token');

  const loading = document.getElementById('orders-loading');
  const list = document.getElementById('orders-list');

  if (!loading || !list) return;

  if (!token) {
    loading.textContent = 'Please sign in.';
    return;
  }

  try {
    const res = await fetch(`${API}/orders`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('s4l_token');
      localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
      window.location.href = '/account/signin.html';
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    loading.style.display = 'none';

    if (!data.orders || data.orders.length === 0) {
      list.innerHTML = '<p>You don’t have any orders yet.</p>';
      return;
    }

    list.innerHTML = data.orders.map(renderOrderCard).join('');
  } catch (err) {
    console.error('ORDERS LOAD ERROR:', err);
    loading.textContent = 'Failed to load orders.';
  }
}

// =====================================================
// RENDER ORDER CARD
// =====================================================

// Each order card uses its OWN order's displayCurrency* — unlike the
// single-order details page, this list can show orders placed in
// different currencies side by side (e.g. a GBP order and a converted US
// order for the same buyer), so this can't be a single shared variable.
function fmtOrderTotal(o) {
  const symbol = o.displayCurrencySymbol || '£';
  const rate = Number(o.displayCurrencyRate) || 1;
  return `${symbol}${(Number(o.total) * rate).toFixed(2)}`;
}

function renderOrderCard(o) {
  const date = o.createdAt ? new Date(o.createdAt).toLocaleString() : '—';

  const displayId = o.shortId || `S4L-${o.id.slice(0, 10).toUpperCase()}`;

  const itemCount = o.items?.length || 0;

  const { paymentLabel, paymentClass } = getPaymentStatus(o);

  const payNowButton =
    o.paymentStatus === 'pending'
      ? `<button class="pay-now-btn" data-id="${o.id}">Pay Now</button>`
      : '';

  return `
  <div class="order-card">

    <a href="./orders-details.html?id=${o.id}" class="order-card-link">

      <div class="order-header">
        <span class="order-id">${displayId}</span>
        <span class="order-total">${fmtOrderTotal(o)}</span>
      </div>

      <div class="order-meta">
       <div>
  ${itemCount} item${itemCount === 1 ? '' : 's'}
  • Fulfillment: ${window.s4lStatusBadge ? window.s4lStatusBadge(o.status) : o.status}
  • Payment:
  <span class="payment-status ${paymentClass}">
    ${paymentLabel}
  </span>
</div>

        <div class="order-date">${date}</div>
      </div>

    </a>

    ${payNowButton}

  </div>
`;
}

// =====================================================
// PAYMENT STATUS HELPER
// =====================================================

function getPaymentStatus(order) {
  const status = typeof order === 'string' ? order : (order.paymentStatus || 'pending');
  const items  = typeof order === 'object' ? (order.items || []) : [];

  // Item-level refund statuses override the order-level payment status
  const allRefunded = items.length > 0 && items.every((i) => i.refundStatus === 'processed');
  if (allRefunded) return { paymentLabel: 'Refunded', paymentClass: 'refunded' };

  const anyRefunded = items.some((i) => ['processed', 'partially_refunded'].includes(i.refundStatus));
  if (anyRefunded) return { paymentLabel: 'Partially Refunded', paymentClass: 'partially_refunded' };

  switch (status) {
    case 'paid':
      return { paymentLabel: 'Paid', paymentClass: 'paid' };

    case 'refund_scheduled':
      return { paymentLabel: 'Refund Scheduled', paymentClass: 'refund' };

    case 'refunded':
      return { paymentLabel: 'Refunded', paymentClass: 'refunded' };

    case 'partially_refunded':
      return { paymentLabel: 'Partially Refunded', paymentClass: 'partially_refunded' };

    case 'failed':
      return { paymentLabel: 'Failed', paymentClass: 'failed' };

    case 'pending':
    default: {
      // If any item progressed past Pending the order was paid — stale DB status
      const FULFILLED = new Set([
        'Processing', 'Shipped', 'Delivered',
        'Cancel Requested', 'Cancelled', 'Returned',
      ]);
      if (items.some((i) => FULFILLED.has(i.status))) {
        return { paymentLabel: 'Paid', paymentClass: 'paid' };
      }
      return { paymentLabel: 'Unpaid', paymentClass: 'pending' };
    }
  }
}

// =====================================================
// RETRY PAYMENT BUTTON
// =====================================================

document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('pay-now-btn')) return;

  e.preventDefault();

  const orderId = e.target.dataset.id;

  window.location.href = `/cart/checkout.html?order=${orderId}`;
});

// =====================================================
// START
// =====================================================

initOrders();
