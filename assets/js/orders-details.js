// =====================================================
// Order Details (ADMIN) – Status Logic Aligned
// =====================================================

import { API_BASE } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {
  const params  = new URLSearchParams(window.location.search);
  const orderId = params.get("id");

  const container = document.getElementById("order-details");
  const loading   = document.getElementById("order-loading");

  if (!orderId) {
    loading.textContent = "Invalid order.";
    return;
  }

  const token = localStorage.getItem("s4l_token");
  if (!token) {
    window.location.href = "/account/admin/signin.html";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Order not found");

    const order = await res.json();
    loading.style.display = "none";

    const backendStatus = order.status;
    const currentStatus = backendStatus.toLowerCase();

    const FINAL_STATES = ["delivered", "cancelled"];

    const TRANSITIONS = {
      processing: ["Processing", "Shipped", "Cancelled"],
      shipped: ["Shipped", "Delivered"],
      delivered: ["Delivered"],
      cancelled: ["Cancelled"]
    };

    const allowedStatuses =
      TRANSITIONS[currentStatus] || [backendStatus];

    const isFinal = FINAL_STATES.includes(currentStatus);

    const items = Array.isArray(order.items) ? order.items : [];

    const itemsHTML = items.map(item => {
      const qty   = Number(item.quantity ?? 1);
      const price = Number(item.price ?? 0);
      const line  = qty * price;

      const img =
        item.image && typeof item.image === "string"
          ? item.image
          : "/assets/images/products/default.png";

      return `
        <div class="order-item">
          <img class="order-thumb"
               src="${img}"
               onerror="this.src='/assets/images/products/default.png'">
          <div class="order-info">
            <div class="order-name">${item.name || "Unnamed product"}</div>
            <div class="order-qty">${qty} × £${price.toFixed(2)}</div>
          </div>
          <div class="order-line-price">
            £${line.toFixed(2)}
          </div>
        </div>
      `;
    }).join("");

    const statusControl = isFinal
      ? `<span class="status status-${currentStatus}">
           ${backendStatus}
         </span>
         <p style="opacity:.6;margin-top:6px">
           Final state – no further changes
         </p>`
      : `
        <select id="statusSelect">
          ${allowedStatuses.map(s => `
            <option value="${s}" ${s === backendStatus ? "selected" : ""}>
              ${s}
            </option>
          `).join("")}
        </select>
        <button id="updateStatus">Update status</button>
      `;

    container.innerHTML = `
      <h2 class="order-id">
        S4L-${order.id.slice(0, 10).toUpperCase()}
      </h2>

      <p><strong>Date:</strong>
        ${new Date(order.createdAt).toLocaleString()}
      </p>

      <div class="order-status">
        <strong>Status</strong><br>
        ${statusControl}
      </div>

      <div class="order-items">
        ${itemsHTML || "<p>No items found.</p>"}
      </div>

      <div class="order-total">
        <h3>£${Number(order.total ?? 0).toFixed(2)}</h3>
      </div>
    `;

    const updateBtn = document.getElementById("updateStatus");
    if (updateBtn) {
      updateBtn.addEventListener("click", async () => {
        const select = document.getElementById("statusSelect");
        if (!select) return;

        updateBtn.disabled = true;
        updateBtn.textContent = "Updating…";

        try {
          const res = await fetch(
            `${API_BASE}/api/admin/orders/${orderId}/status`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ status: select.value })
            }
          );

          if (!res.ok) throw new Error("Update failed");

          location.reload();
        } catch (err) {
          console.error(err);
          updateBtn.textContent = "Error";
          updateBtn.disabled = false;
        }
      });
    }

  } catch (err) {
    console.error("ORDER DETAILS ERROR:", err);
    loading.textContent = "Failed to load order.";
  }
});
