import { API_BASE } from "./config.js";

/* ================================
   AUTH GUARD (ADMIN TOKEN ONLY)
================================ */
const token = localStorage.getItem("s4l_token");

if (!token) {
  window.location.href = "/account/admin/signin.html";
  throw new Error("Not authenticated");
}

/* ================================
   GET ORDER ID (MATCH ORDERS PAGE)
================================ */
const params  = new URLSearchParams(window.location.search);
const orderId = params.get("id");

if (!orderId) {
  console.error("Missing order ID in URL");
  window.location.href = "/account/admin/orders.html";
  throw new Error("Missing order ID");
}

/* ================================
   ELEMENTS
================================ */
const info         = document.getElementById("orderInfo");
const historyList = document.getElementById("statusHistory");
const statusSelect = document.getElementById("statusSelect");
const result       = document.getElementById("result");

/* ================================
   LOAD ORDER (ADMIN)
================================ */
async function loadOrder() {
  try {
    const res = await fetch(
      `${API_BASE}/api/admin/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (res.status === 401 || res.status === 403) {
      window.location.href = "/";
      return;
    }

    if (!res.ok) throw new Error("Failed to load order");

    const order = await res.json();

    info.innerHTML = `
      <p><strong>ID:</strong> S4L-${order.id.slice(0, 8).toUpperCase()}</p>
      <p><strong>User:</strong> ${order.user?.email || "-"}</p>
      <p><strong>Total:</strong> £${order.total.toFixed(2)}</p>
      <p><strong>Status:</strong> ${order.status}</p>
    `;

    statusSelect.value = order.status;

    historyList.innerHTML = "";
    order.statusHistory.forEach(h => {
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

loadOrder();

/* ================================
   UPDATE STATUS
================================ */
document
  .getElementById("updateStatus")
  .addEventListener("click", async () => {
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

      if (res.status === 401 || res.status === 403) {
        window.location.href = "/";
        return;
      }

      if (!res.ok) throw new Error("Update failed");

      result.textContent = "Status updated successfully";

      // reload to refresh history
      loadOrder();

    } catch (err) {
      console.error(err);
      result.textContent = "Error updating status";
    }
  });
