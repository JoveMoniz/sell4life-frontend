const token = localStorage.getItem("s4l_token");
const user  = JSON.parse(localStorage.getItem("s4l_user"));

if (!token || user?.role !== "admin") {
  window.location.href = "/";
}

const params = new URLSearchParams(window.location.search);
const orderId = params.get("id");

if (!orderId) {
  window.location.href = "/account/admin/orders.html";
}

const info = document.getElementById("orderInfo");
const historyList = document.getElementById("statusHistory");
const statusSelect = document.getElementById("statusSelect");
const result = document.getElementById("result");

fetch(`${API_BASE}/api/admin/orders/${orderId}`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
.then(res => res.json())
.then(order => {
  info.innerHTML = `
    <p><strong>ID:</strong> ${order.id}</p>
    <p><strong>User:</strong> ${order.user?.email || "-"}</p>
    <p><strong>Total:</strong> £${order.total}</p>
    <p><strong>Status:</strong> ${order.status}</p>
  `;

  statusSelect.value = order.status;

  historyList.innerHTML = "";
  order.statusHistory.forEach(h => {
    const li = document.createElement("li");
    li.textContent = `${h.status} – ${new Date(h.date).toLocaleString()}`;
    historyList.appendChild(li);
  });
});

document.getElementById("updateStatus").addEventListener("click", () => {
  fetch(`${API_BASE}/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: statusSelect.value })
  })
  .then(res => res.json())
  .then(() => {
    result.textContent = "Status updated";
  })
  .catch(() => {
    result.textContent = "Update failed";
  });
});
