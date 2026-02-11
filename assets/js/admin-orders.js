import { API_BASE } from "./config.js";

const FINAL_STATES = ["delivered", "cancelled"];

/* ================= AUTH GUARD ================= */
const token = localStorage.getItem("s4l_token");
const role  = localStorage.getItem("s4l_role");

if (!token || role !== "admin") {
  window.location.href = "/account/admin/signin.html";
}

/* ================= STATE ================= */
let currentPage = 1;
let searchInput, statusSelect, searchBtn;

/* ================= UPDATE STATUS ================= */
async function updateOrderStatus(orderId, status) {
  const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });

  if (!res.ok) throw new Error("Status update failed");
}

/* ================= FETCH ORDERS (ONLY ONE) ================= */
async function fetchOrders(page = 1) {
  try {
    const q = searchInput?.value.trim() || "";
    const status = statusSelect?.value || "all";

    let url = `${API_BASE}/admin/orders?page=${page}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    if (status !== "all") url += `&status=${status}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return;

    const data = await res.json();
    renderOrders(data.orders);
    renderPagination(page, data.totalPages);

  } catch (err) {
    console.error("fetchOrders error:", err);
  }
}

/* ================= RENDER TABLE ================= */
function renderOrders(orders) {
  const tbody = document.getElementById("ordersTable");
  tbody.innerHTML = "";

  orders.forEach(order => {
    const id = order._id;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>S4L-${id.slice(0, 10).toUpperCase()}</td>
      <td>${order.user?.email || "-"}</td>
      <td>£${Number(order.total || 0).toFixed(2)}</td>
      <td>
        <span class="status status-${order.status.toLowerCase()}">
          ${order.status}
        </span>
      </td>
      <td>${new Date(order.createdAt).toLocaleString()}</td>
      <td>
        <button class="view-order" data-id="${id}">View</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================= PAGINATION (ONLY ONE) ================= */
function renderPagination(current, total) {
  const container = document.getElementById("pagination");
  container.innerHTML = "";

  if (total <= 1) return;

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === current) btn.classList.add("active");

    btn.addEventListener("click", () => fetchOrders(i));
    container.appendChild(btn);
  }
}

/* ================= INLINE DETAILS + STATUS ================= */
document.getElementById("ordersTable").addEventListener("click", async e => {

  const viewBtn = e.target.closest(".view-order");
  if (viewBtn) {
    const row = viewBtn.closest("tr");
    const orderId = viewBtn.dataset.id;

    const backendStatus = row.children[3].textContent.trim();
    const currentStatus = backendStatus.toLowerCase();
    const isFinal = FINAL_STATES.includes(currentStatus);

    let detailsRow = row.nextElementSibling;
    if (detailsRow && detailsRow.classList.contains("order-details-row")) {
      detailsRow.classList.toggle("open");
      return;
    }

    document.querySelectorAll(".order-details-row").forEach(r => r.remove());

    const TRANSITIONS = {
      processing: ["Processing", "Shipped", "Cancelled"],
      shipped: ["Shipped", "Delivered"],
      delivered: ["Delivered"],
      cancelled: ["Cancelled"]
    };

    const allowed = TRANSITIONS[currentStatus] || [backendStatus];

    detailsRow = document.createElement("tr");
    detailsRow.className = "order-details-row open";

    const cell = document.createElement("td");
    cell.colSpan = 6;

    cell.innerHTML = `
      <div class="inline-order-wrapper">
        <strong>Status</strong><br>
        ${
          isFinal
            ? `<span class="status status-${currentStatus}">${backendStatus}</span>`
            : `<select class="inline-status" data-id="${orderId}">
                ${allowed.map(s =>
                  `<option ${s === backendStatus ? "selected" : ""}>${s}</option>`
                ).join("")}
              </select>
              <br><br>
              <button class="inline-update" data-id="${orderId}">
                Update status
              </button>`
        }
      </div>
    `;

    detailsRow.appendChild(cell);
    row.after(detailsRow);
    return;
  }

  const saveBtn = e.target.closest(".inline-update");
  if (!saveBtn) return;

  const orderId = saveBtn.dataset.id;
  const select = document.querySelector(`.inline-status[data-id="${orderId}"]`);
  const newStatus = select.value;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    await updateOrderStatus(orderId, newStatus);

    const mainRow = saveBtn.closest("tr").previousElementSibling;
    mainRow.children[3].innerHTML =
      `<span class="status status-${newStatus.toLowerCase()}">${newStatus}</span>`;

    saveBtn.textContent = "Saved";
  } catch {
    saveBtn.textContent = "Error";
  }

  setTimeout(() => {
    saveBtn.textContent = "Update status";
    saveBtn.disabled = false;
  }, 1200);
});

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
  searchInput  = document.getElementById("orderSearch");
  statusSelect = document.getElementById("statusFilter");
  searchBtn    = document.getElementById("searchBtn");

  if (!searchInput || !statusSelect || !searchBtn) {
    console.error("Search UI missing");
    return;
  }

  searchBtn.addEventListener("click", () => fetchOrders(1));
  searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") fetchOrders(1);
  });

  fetchOrders(1);
});
