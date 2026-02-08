import { API_BASE } from "./config.js";

/* ================================
   AUTH GUARD
================================ */
const token = localStorage.getItem("s4l_token");

if (!token) {
  window.location.href = "/account/admin/signin.html";
  throw new Error("Not authenticated");
}

/* ================================
   GET ORDER ID
================================ */
const params  = new URLSearchParams(window.location.search);
const orderId = params.get("id");

if (!orderId) {
  window.location.href = "/account/admin/orders.html";
  throw new Error("Missing order ID");
}

/* ================================
   ELEMENTS
================================ */
const statusSelect  = document.getElementById("statusSelect");
const updateBtn     = document.getElementById("updateStatus");
const result        = document.getElementById("result");
const historyList   = document.getElementById("statusHistory");
const productsTable = document.getElementById("productsTable");

/* ================================
   STATE
================================ */
let currentOrder = null;

const STATUSES = ["Processing", "Shipped", "Delivered", "Cancelled"];
const STATUS_FLOW = ["Processing", "Shipped", "Delivered"];

/* ================================
   LOAD ORDER
================================ */
async function loadOrder() {
  try {
    const res = await fetch(
      `${API_BASE}/api/admin/orders/${orderId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (res.status === 401 || res.status === 403) {
      window.location.href = "/";
      return;
    }

    if (!res.ok) throw new Error("Failed to load order");

    const order = await res.json();
    currentOrder = order;

    /* ========= ORDER SUMMARY ========= */
    document.getElementById("orderId").textContent =
      `S4L-${order.id.slice(0, 10).toUpperCase()}`;

    document.getElementById("orderUser").textContent =
      order.user?.email || "-";

    document.getElementById("orderDate").textContent =
      new Date(order.createdAt).toLocaleString();

    document.getElementById("orderTotal").textContent =
      Number(order.total).toFixed(2);

    document.getElementById("orderStatus").textContent =
      order.status;

    /* ========= STATUS SELECT (DOWNGRADE SAFE) ========= */
    statusSelect.innerHTML = "";

    const currentIndex = STATUS_FLOW.indexOf(order.status);

    STATUSES.forEach(status => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;

      const statusIndex = STATUS_FLOW.indexOf(status);

      if (
        currentIndex !== -1 &&
        statusIndex !== -1 &&
        statusIndex < currentIndex
      ) {
        option.disabled = true;
      }

      if (status === order.status) {
        option.selected = true;
      }

      statusSelect.appendChild(option);
    });

    /* ========= PRODUCTS ========= */
    productsTable.innerHTML = "";

    const items = order.items || order.products || [];

    if (!Array.isArray(items) || items.length === 0) {
      productsTable.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; opacity:.6">
            No products found for this order
          </td>
        </tr>
      `;
    } else {
      items.forEach(item => {
        const qty   = Number(item.quantity || 0);
        const price = Number(item.price || 0);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="product-cell">
            <img
              src="${item.image || "/assets/images/products/default.png"}"
              alt="${item.name}"
              class="product-thumb"
            />
            <span class="product-name">${item.name}</span>
          </td>
          <td>${qty}</td>
          <td>£${price.toFixed(2)}</td>
          <td>£${(qty * price).toFixed(2)}</td>
        `;

        productsTable.appendChild(tr);
      });
    }

    /* ========= STATUS HISTORY ========= */
    historyList.innerHTML = "";
    (order.statusHistory || []).forEach(h => {
      const li = document.createElement("li");
      li.textContent =
        `${h.status} – ${new Date(h.date).toLocaleString()}`;
      historyList.appendChild(li);
    });

  } catch (err) {
    console.error("ADMIN ORDER DETAILS ERROR:", err);
    result.textContent = "Failed to load order";
  }
}

/* ================================
   UPDATE STATUS
================================ */
updateBtn.addEventListener("click", async () => {
  if (!currentOrder) return;

  updateBtn.disabled = true;
  updateBtn.textContent = "Updating…";
  result.textContent = "";

  try {
    const res = await fetch(
      `${API_BASE}/api/admin/orders/${orderId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: statusSelect.value
        })
      }
    );

    if (!res.ok) throw new Error("Update failed");

    result.textContent = "Status updated";
    result.className = "success";

    await loadOrder();

  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err);
    result.textContent = "Error updating status";
    result.className = "error";
  } finally {
    updateBtn.disabled = false;
    updateBtn.textContent = "Update Status";
  }
});

/* ================================
   INIT
================================ */
loadOrder();
