import { API_BASE } from "./config.js";

// ===============================
// Auth check (page-level only)
// ===============================
const token = localStorage.getItem("s4l_token");

if (!token) {
  window.location.href = "/account/admin/signin.html";
  throw new Error("Not authenticated");
}

// ===============================
// Load users
// ===============================
async function loadUsers() {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  // Page-level auth failure only
  if (res.status === 401 || res.status === 403) {
    window.location.href = "/";
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
// Delegated click handler (robust)
// ===============================
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("save-btn")) return;

  e.preventDefault();

  const row = e.target.closest("tr");
  if (!row) {
    console.error("Row not found");
    return;
  }

  const select = row.querySelector(".role-select");
  if (!select) {
    console.error("Role select not found");
    return;
  }

const userId = select.getAttribute("data-user-id");
console.log("USER ID:", userId);

  const role = select.value;

  if (!userId) {
    console.error("Missing userId");
    return;
  }

  try {
    const updateRes = await fetch(
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

    // IMPORTANT: do NOT redirect here
    if (!updateRes.ok) {
      console.error("Failed to update role");
      return;
    }

    // Reload users after successful update
    await loadUsers();

  } catch (err) {
    console.error("Update error:", err);
  }
});

// ===============================
// Initial load
// ===============================
loadUsers();
