import { API_BASE } from "./config.js";

const token = localStorage.getItem("s4l_token");

if (!token) {
  window.location.href = "/account/admin/signin.html";
  throw new Error("Not authenticated");
}

async function loadUsers() {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

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
        <button class="save-btn" data-user-id="${user._id}">
          Save
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // 🔒 Attach handlers AFTER render
  document.querySelectorAll(".save-btn").forEach(button => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();

      const userId = button.dataset.userId;
      if (!userId) {
        console.error("Missing userId on button");
        return;
      }

      const select = document.querySelector(
        `.role-select[data-user-id="${userId}"]`
      );

      if (!select) {
        console.error("Role select not found for user:", userId);
        return;
      }

      const role = select.value;

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

      if (!updateRes.ok) {
        console.error("Failed to update role");
        return;
      }

      // reload list after save
      loadUsers();
    });
  });
}

loadUsers();
