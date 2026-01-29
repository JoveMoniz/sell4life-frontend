import { API_BASE } from "./config.js";

/* ================================
   ADMIN GUARD (HARD STOP)
================================ */
const token = localStorage.getItem("s4l_token");
const user  = JSON.parse(localStorage.getItem("s4l_user"));

if (!token) {
  window.location.href = "/";
  throw new Error("Not logged in");
}


/* ================================
   STATE
================================ */
let currentPage = 1;

/* ================================
   LOAD ORDERS (PAGINATED)
================================ */
function loadOrders(page = 1) {
  fetch(`${API_BASE}/api/admin/orders?page=${page}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  .then(res => {
    if (!res.ok) throw new Error("Failed to fetch admin orders");
    return res.json();
  })
  .then(data => {
    const tbody = document.getElementById("ordersTable");
    tbody.innerHTML = "";

    data.orders.forEach(order => {
      const tr = document.createElement("tr");

      // Row click → order details
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        window.location.href =
          `/account/admin/order-details.html?id=${order._id}`;
      });

      tr.innerHTML = `
        <td>${order._id}</td>
        <td>${order.user?.email || "-"}</td>
        <td>£${order.total.toFixed(2)}</td>
        <td>
          <span class="status status-${order.status.toLowerCase()}">
            ${order.status}
          </span>
        </td>
        <td>${new Date(order.createdAt).toLocaleString()}</td>
        <td>
          <a href="/account/admin/order-details.html?id=${order._id}"
             onclick="event.stopPropagation()">
            View
          </a>
        </td>
      `;

      tbody.appendChild(tr);
    });

    renderPagination(data.page, data.totalPages);
  })
  .catch(err => {
    console.error("ADMIN ORDERS ERROR:", err);
  });
}

/* ================================
   PAGINATION CONTROLS
================================ */
function renderPagination(current, total) {
  const container = document.getElementById("pagination");
  if (!container) return;

  container.innerHTML = "";
  if (total <= 1) return;

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.disabled = i === current;

    btn.addEventListener("click", () => {
      currentPage = i;
      loadOrders(i);
    });

    container.appendChild(btn);
  }
}

/* ================================
   INIT
================================ */
loadOrders(currentPage);
