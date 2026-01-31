import { API_BASE } from "./config.js";

/* ================================
   AUTH CHECK
================================ */
const token = localStorage.getItem("s4l_token");

if (!token) {
  window.location.href = "/account/admin/signin.html";
}

/* ================================
   STATE
================================ */
let currentPage = 1;

/* ================================
   LOAD ORDERS
================================ */
async function loadOrders(page = 1) {
  const res = await fetch(`${API_BASE}/api/admin/orders?page=${page}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (res.status === 401 || res.status === 403) {
    window.location.href = "/";
    throw new Error("Admin only");
  }

  const data = await res.json();

  const tbody = document.getElementById("ordersTable");
  tbody.innerHTML = "";

  data.orders.forEach(order => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";

    tr.addEventListener("click", () => {
      window.location.href =
        `/account/admin/order-details.html?id=${order._id}`;
    });

    tr.innerHTML = `
      <td>S4L-${order.id.slice(0, 8).toUpperCase()}</td>

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
}

/* ================================
   PAGINATION
================================ */
function renderPagination(current, total) {
  const container = document.getElementById("pagination");
  if (!container || total <= 1) return;

  container.innerHTML = "";

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.disabled = i === current;

    btn.onclick = () => {
      currentPage = i;
      loadOrders(i);
    };

    container.appendChild(btn);
  }
}


/*====================================
    LOGOUT LOGIC
    ===================================*/
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("s4l_token");
    window.location.href = "/account/admin/signin.html";
  });
});



/* ================================
   INIT (ONE. SINGLE. CALL.)
================================ */
loadOrders(currentPage);
