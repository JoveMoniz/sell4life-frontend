import { API_BASE } from "./config.js";

// ===============================
// Token (do NOT redirect here)
// ===============================
const token = localStorage.getItem("s4l_token");

// ===============================
// Load users (backend-protected)
// ===============================
async function loadUsers() {
  if (!token) {
    // No token → send to admin entry point
    window.location.href = "/account/admin/orders.html";
    return;
  }

  const res = await fetch(`${API_BASE}/api/admin/users`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  // Backend decides if we are allowed
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/account/admin/orders.html";
    return;
  }

  const data = await res.json();
  const tbody = document.getElementById("usersTable");
  tbody.innerHTML = "";

  data.users.forEach(user => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${user.email}</td>
      <td>
        <select class="role-select" data-user-id="${user._id}">
          <option value="user" ${user.role === "user" ? "selected" : ""}>user</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
        </select>
      </td>
      <td>
        <button class="save-btn">Save</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ===============================
// Delegated save handler
// ===============================
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("save-btn")) return;

  e.preventDefault();

  const row = e.target.closest("tr");
  if (!row) return;

  const select = row.querySelector(".role-select");
  if (!select) return;

  const userId = select.getAttribute("data-user-id");
  const role = select.value;

  if (!userId) {
    console.error("Missing userId");
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/admin/users/${userId}/role`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      }
    );

    // Do NOT redirect on action failure
    if (!res.ok) {
      console.error("Failed to update role");
      return;
    }

    // Reload table after success
    await loadUsers();

  } catch (err) {
    console.error("Update error:", err);
  }
});

// ===============================
// Initial load
// ===============================
loadUsers();
