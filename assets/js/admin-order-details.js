import { API_BASE } from "./config.js";

/* ================================
   AUTH GUARD (TOKEN ONLY)
   Backend decides who is admin
================================ */
const token = localStorage.getItem("s4l_token");

if (!token) {
  window.location.href = "/account/admin/signin.html";
  throw new Error("Not authenticated");
}

/* ================================
   GET ORDER ID
================================ */
const params = new URLSearchParams(window.location.search);
const orderId = params.get("id");

if (!orderId) {
  window.location.href = "/account/admin/orders.html";
  throw new Error("Missing order ID");
}

/* ================================
   ELEMENTS
================================ */
const info = document.getElementById("orderInfo");
const historyList = document.getElementById("statusHistory");
const statusSelect = document.getElementById("statusSelect");
const result = document.getElementById("result");

/* ================================
   FETCH ORDER (ADMIN ENDPOINT)
================================ */
fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
.then(res => {
  if (res.status === 401 || res.status === 403) {
    // token valid but not admin → backend decides
    window.location.href = "/";
    return null;
  }
  if (!res.ok) throw new Error("Failed to load order");
  return res.json();
})
.then(order => {
  if (!order) return;

  info.innerHTML = `
    <p><strong>ID:</strong> ${order._id}</p>
    <p><strong>User:</strong> ${order.user?.email || "-"}</p>
    <p><strong>Total:</strong> £${order.total.toFixed(2)}</p>
    <p><strong>Status:</strong> ${order.status}</p>
  `;

  statusSelect.value = order.status;

  historyList.innerHTML = "";
  order.statusHistory.forEach(h => {
    const li = document.createElement("li");
    li.textContent = `${h.status} – ${new Date(h.date).toLocaleString()}`;
    historyList.appendChild(li);
  });
})
.catch(err => {
  console.error("ADMIN ORDER DETAILS ERROR:", err);
  result.textContent = "Failed to load order";
});

/* ================================
   UPDATE STATUS
================================ */
document.getElementById("updateStatus").addEventListener("click", () => {
  fetch(`${API_BASE}/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      status: statusSelect.value
    })
  })
  .then(res => {
    if (res.status === 401 || res.status === 403) {
      window.location.href = "/";
      return null;
    }
    if (!res.ok) throw new Error("Update failed");
    return res.json();
  })
  .then(() => {
    result.textContent = "Status updated successfully";
  })
  .catch(err => {
    console.error(err);
    result.textContent = "Error updating status";
  });
});
