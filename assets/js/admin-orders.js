import { API_BASE } from "./config.js";

/* ================================
   AUTH GUARD (ADMIN ONLY)
================================ */
const token = localStorage.getItem("s4l_token");
const role  = localStorage.getItem("s4l_role");

if (!token || role !== "admin") {
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
    window.location.href = "/account/admin/signin.html";
    return;
  }

  const data = await res.json();

  const tbody = document.getElementById("ordersTable");
  tbody.innerHTML = "";

  data.orders.forEach(order => {
    const tr = document.createElement("tr");
   

    tr.innerHTML = `
      <td>S4L-${order.id.slice(0, 10).toUpperCase()}</td>
      <td>${order.user?.email || "-"}</td>
      <td>£${order.total.toFixed(2)}</td>
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

  /* 🔑 FIX: reset horizontal scroll after table redraw */
  const scrollWrapper = document.querySelector(".admin-table-scroll");
  if (scrollWrapper) {
    scrollWrapper.scrollLeft = 0;
  }

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

    if (i === current) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      if (i === current) return;
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


document
  .getElementById("ordersTable")
  .addEventListener("click", (e) => {
    const btn = e.target.closest(".view-order");
    if (!btn) return;

    const orderId = btn.dataset.id;
const row = btn.closest("tr");
let detailsRow = row.nextElementSibling;

/* If already open → toggle */
if (detailsRow && detailsRow.classList.contains("order-details-row")) {
  detailsRow.style.display =
    detailsRow.style.display === "table-row" ? "none" : "table-row";
  return;
}

/* Close any other open rows */
document.querySelectorAll(".order-details-row").forEach(r => r.remove());

/* Create new details row */
detailsRow = document.createElement("tr");
detailsRow.className = "order-details-row";

const cell = document.createElement("td");
cell.colSpan = 6;
cell.innerHTML = `
  <div style="display:flex; justify-content:space-between; gap:24px;">
    <div>
      <strong>Order ID:</strong><br>
      ${orderId}
    </div>

    <div>
      <strong>Quick actions:</strong><br>
      <em>Status and summary will go here</em>
    </div>
  </div>
`;


detailsRow.appendChild(cell);
row.after(detailsRow);

  });
