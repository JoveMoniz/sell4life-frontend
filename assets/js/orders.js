// =====================================================
// Orders list (API_BASE + readable IDs, no thumbnails)
// =====================================================

console.log('orders.js running');

async function initOrders() {
  const token = localStorage.getItem('s4l_token');
  const loading = document.getElementById('orders-loading');
  const list = document.getElementById('orders-list');

  if (!loading || !list) return;

  if (!token) {
    loading.textContent = 'Please sign in.';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    loading.style.display = 'none';

    if (!data.orders || data.orders.length === 0) {
      list.innerHTML = '<p>You don’t have any orders yet.</p>';
      return;
    }

    list.innerHTML = data.orders
      .map((o) => {
        const date = o.createdAt ? new Date(o.createdAt).toLocaleString() : '—';

        const displayId = o.orderNumber || `S4L-${o.id.slice(0, 10).toUpperCase()}`;

        const itemCount = o.items?.length || 0;

        return `
          <a href="./orders-details.html?id=${o.id}" class="order-card">
            <div class="order-header">
              <span class="order-id">${displayId}</span>
              <span class="order-total">£${Number(o.total).toFixed(2)}</span>
            </div>

            <div class="order-meta">
              <div>${itemCount} item${itemCount === 1 ? '' : 's'} • Status: ${o.status}</div>
              <div class="order-date">${date}</div>
            </div>
          </a>
        `;
      })
      .join('');
  } catch (err) {
    console.error('ORDERS LOAD ERROR:', err);
    loading.textContent = 'Failed to load orders.';
  }
}

// Run immediately (script is injected after DOM is ready)
initOrders();
