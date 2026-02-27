const FINAL_STATES = ['delivered', 'cancelled'];

import { API_BASE } from './config.js';

/* =================================
   AUTH GUARD
================================= */
const token = localStorage.getItem('s4l_token');
const role = localStorage.getItem('s4l_role');

if (!token || role !== 'admin') {
  window.location.href = '/account/admin/signin.html';
}

/* =================================
   STATE
================================= */
let currentPage = 1;
let currentQuery = '';
let currentStatus = 'all';

/* =================================
   HELPERS
================================= */
async function updateOrderStatus(orderId, status) {
  const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'Status update failed');
  }
}

function getAllowedTransitions(currentStatus) {
  const map = {
    Processing: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered'],
    Delivered: [],
    Cancelled: [],
  };

  return map[currentStatus] || [];
}

/* =================================
   LOAD ORDERS
================================= */
async function loadOrders(page = 1, q = '', status = 'all') {
  let url = `${API_BASE}/admin/orders?page=${page}`;

  if (q) url += `&q=${encodeURIComponent(q)}`;
  if (status !== 'all') url += `&status=${status}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    window.location.href = '/account/admin/signin.html';
    return;
  }

  const data = await res.json();
  const tbody = document.getElementById('ordersTable');
  tbody.innerHTML = '';

  data.orders.forEach((order) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>S4L-${order.id.slice(0, 10).toUpperCase()}</td>
      <td>${order.user?.email || '-'}</td>
      <td>£${Number(order.total || 0).toFixed(2)}</td>
      <td>
        <span class="status status-${order.status.toLowerCase()}">
          ${order.status}
        </span>
      </td>
      <td>${new Date(order.createdAt).toLocaleString()}</td>
      <td>
        <button class="view-order" data-id="${order.id}">
          View
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  renderPagination(data.page, data.totalPages);
}

/* =================================
   PAGINATION
================================= */
function renderPagination(current, total) {
  const container = document.getElementById('pagination');
  container.innerHTML = '';

  if (total <= 1) return;

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;

    if (i === current) btn.classList.add('active');

    btn.addEventListener('click', () => {
      currentPage = i;
      loadOrders(i, currentQuery, currentStatus);
    });

    container.appendChild(btn);
  }
}

/* =================================
   TABLE CLICK HANDLER
================================= */
document.getElementById('ordersTable').addEventListener('click', async (e) => {
  /* OPEN INLINE DETAILS */
  const viewBtn = e.target.closest('.view-order');
  if (viewBtn) {
    const row = viewBtn.closest('tr');
    const orderId = viewBtn.dataset.id;

    const backendStatus = row.children[3].textContent.trim();
    const isFinal = FINAL_STATES.includes(backendStatus.toLowerCase());

    let detailsRow = row.nextElementSibling;
    if (detailsRow && detailsRow.classList.contains('order-details-row')) {
      detailsRow.classList.remove('open');

      setTimeout(() => {
        detailsRow.remove();
      }, 350); // match CSS duration

      return;
    }

    document.querySelectorAll('.order-details-row').forEach((r) => r.remove());

    const allowedStatuses = getAllowedTransitions(backendStatus);

    detailsRow = document.createElement('tr');
    detailsRow.className = 'order-details-row';

    const cell = document.createElement('td');
    cell.colSpan = 6;

    cell.innerHTML = `
  <div class="inline-order-wrapper">
    <div class="inline-order-content">

      <div class="inline-status-line">
        <strong>Status</strong>
        <span class="status status-${backendStatus.toLowerCase()}">
          ${backendStatus}
        </span>
      </div>

      ${
        isFinal
          ? `
            <div class="inline-final-message">
              Final state – no further changes
            </div>
          `
          : `
            <div class="inline-status-buttons">
              ${allowedStatuses
                .map(
                  (status) => `
                  <button
                    class="status-btn ${status === backendStatus ? 'active' : ''}"
                    data-id="${orderId}"
                    data-status="${status}">
                    ${status}
                  </button>
                `
                )
                .join('')}
            </div>
          `
      }

      <a class="inline-details-link"
         href="/account/admin/order-details.html?id=${orderId}">
        View full details →
      </a>

    </div>
  </div>
`;

    detailsRow.appendChild(cell);
    row.after(detailsRow);
    // trigger animation
    requestAnimationFrame(() => {
      detailsRow.classList.add('open');
    });
    return;
  }

  /* STATUS BUTTON CLICK */
  const statusBtn = e.target.closest('.status-btn');
  if (!statusBtn) return;

  const orderId = statusBtn.dataset.id;
  const newStatus = statusBtn.dataset.status;

  statusBtn.disabled = true;
  statusBtn.textContent = 'Saving…';

  try {
    await updateOrderStatus(orderId, newStatus);

    const detailsRow = statusBtn.closest('tr');
    const mainRow = detailsRow.previousElementSibling;
    const statusCell = mainRow.children[3];

    // Update main table badge
    statusCell.innerHTML = `
    <span class="status status-${newStatus.toLowerCase()}">
      ${newStatus}
    </span>
  `;

    const content = detailsRow.querySelector('.inline-order-content');

    // Update inline badge
    const inlineStatus = content.querySelector('.inline-status-line span');
    if (inlineStatus) {
      inlineStatus.className = `status status-${newStatus.toLowerCase()}`;
      inlineStatus.textContent = newStatus;
    }

    // Get new transitions
    const allowedStatuses = getAllowedTransitions(newStatus);

    const buttonsContainer = content.querySelector('.inline-status-buttons');

    // If no transitions → final state
    if (!allowedStatuses.length) {
      buttonsContainer?.remove();

      // Avoid duplicating final message
      if (!content.querySelector('.inline-final-message')) {
        const msg = document.createElement('div');
        msg.className = 'inline-final-message';
        msg.textContent = 'Final state – no further changes';

        content.insertBefore(msg, content.querySelector('.inline-details-link'));
      }

      return;
    }

    // Otherwise rebuild buttons
    buttonsContainer.innerHTML = allowedStatuses
      .map(
        (status) => `
        <button
          class="status-btn"
          data-id="${orderId}"
          data-status="${status}">
          ${status}
        </button>
      `
      )
      .join('');
  } catch (err) {
    console.error(err);
    statusBtn.textContent = 'Error';
  }

  setTimeout(() => {
    statusBtn.textContent = newStatus;
    statusBtn.disabled = false;
  }, 800);
});

/* =================================
   STATUS FILTER BUTTONS
================================= */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));

  btn.classList.add('active');

  currentStatus = btn.dataset.status;
  currentPage = 1;

  loadOrders(1, currentQuery, currentStatus);
});

/* =================================
   SEARCH + AUTOCOMPLETE (S4L PREFIX)
================================= */

document.addEventListener('DOMContentLoaded', () => {
  let autoTimer;
  let autoController;
  let activeIndex = -1;

  const searchInput = document.getElementById('orderSearch');
  const resultsBox = document.getElementById('autocompleteResults');

  if (!searchInput || !resultsBox) return;

  /* DEFAULT PREFIX */
  if (!searchInput.value) {
    searchInput.value = 'S4L-';
  }

  function getCleanQuery() {
    let value = searchInput.value.trim();

    if (value.toUpperCase().startsWith('S4L-')) {
      const afterPrefix = value.slice(4);

      if (afterPrefix && !/^[0-9A-Fa-f]/.test(afterPrefix)) {
        searchInput.value = afterPrefix;
        return afterPrefix;
      }

      return afterPrefix;
    }

    if (/^[0-9A-Fa-f]/.test(value)) {
      searchInput.value = 'S4L-' + value;
      return value;
    }

    return value;
  }

  /* ENTER SEARCH */
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && activeIndex === -1) {
      const q = getCleanQuery();

      currentQuery = q;
      currentPage = 1;

      resultsBox.style.display = 'none';
      loadOrders(1, currentQuery, currentStatus);
    }
  });

  /* AUTOCOMPLETE INPUT (FASTER + CACHED + LOADING UI) */
  const acCache = new Map(); // key: q -> { ts, data }
  const CACHE_TTL = 30_000; // 30s

  function showResultsBox() {
    resultsBox.style.display = 'block';
  }

  function hideResultsBox() {
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
    activeIndex = -1;
  }

  function renderAutocomplete(data) {
    resultsBox.innerHTML = '';
    activeIndex = -1;

    if (!data || !data.length) {
      hideResultsBox();
      return;
    }

    data.forEach((order) => {
      const item = document.createElement('div');
      if (order.email) {
        item.innerHTML = `<strong>${order.email}</strong>`;
      } else {
        item.innerHTML = `<strong>S4L-${order.shortId}</strong>`;
      }

      item.addEventListener('click', () => {
        hideResultsBox();

        if (order.shortId) {
          searchInput.value = `S4L-${order.shortId}`;
          currentQuery = order.shortId;
        } else if (order.email) {
          searchInput.value = order.email;
          currentQuery = order.email;
        } else {
          return; // nothing usable
        }

        currentPage = 1;
        loadOrders(1, currentQuery, currentStatus);
      });

      resultsBox.appendChild(item);
    });

    showResultsBox();
  }

  function renderLoadingRow(q) {
    resultsBox.innerHTML = `<div><small>Searching “${q}”…</small></div>`;
    showResultsBox();
  }

  async function fetchAutocomplete(q) {
    autoController = new AbortController();

    const res = await fetch(`${API_BASE}/admin/orders/autocomplete?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: autoController.signal,
    });

    if (!res.ok) return [];

    return await res.json();
  }

  searchInput.addEventListener('input', () => {
    const q = getCleanQuery();

    clearTimeout(autoTimer);
    if (autoController) autoController.abort();

    // If user is basically at prefix only, don't spam server
    if (!q || q.length < 1) {
      hideResultsBox();
      return;
    }

    // Instant UI reaction
    renderLoadingRow(q);

    // Serve cached immediately if available
    const cached = acCache.get(q);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      renderAutocomplete(cached.data);
      // Still refresh quietly in background if you want:
      // (comment out the fetch below if you don't want refresh)
    }

    // Small debounce so typing doesn't fire 20 requests per second
    autoTimer = setTimeout(async () => {
      try {
        const data = await fetchAutocomplete(q);

        acCache.set(q, { ts: Date.now(), data });
        renderAutocomplete(data);
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    }, 80); // 🔥 80ms feels instant
  });

  /* KEYBOARD NAVIGATION */
  searchInput.addEventListener('keydown', (e) => {
    const items = resultsBox.querySelectorAll('div');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex++;
      if (activeIndex >= items.length) activeIndex = 0;
      updateActive(items);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex--;
      if (activeIndex < 0) activeIndex = items.length - 1;
      updateActive(items);
    }

    if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      items[activeIndex].click();
      activeIndex = -1;
    }
  });

  function updateActive(items) {
    items.forEach((item) => item.classList.remove('active'));

    if (activeIndex >= 0) {
      items[activeIndex].classList.add('active');
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-wrapper')) {
      resultsBox.style.display = 'none';
      activeIndex = -1;
    }
  });
});
/* =================================
   INIT
================================= */
loadOrders();
