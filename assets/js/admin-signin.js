import { API_BASE } from "./config.js";

const form = document.getElementById("loginForm");
const error = document.getElementById("error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      error.textContent = data.msg || "Login failed";
      return;
    }

    // 🔐 Persist auth state
    localStorage.setItem("s4l_token", data.token);
    localStorage.setItem("s4l_role", data.user.role);
    localStorage.setItem("s4l_user", JSON.stringify(data.user));

    // 🚦 Single source of truth for redirect
    if (data.user.role === "admin") {
      window.location.href = "/account/admin/index.html";
    } else {
      window.location.href = "/account/orders.html";
    }

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    error.textContent = "Server error";
  }
});
