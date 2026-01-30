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

    // 🔐 TOKEN IS CREATED HERE
    localStorage.setItem("s4l_token", data.token);

    // optional, for UI only
    localStorage.setItem("s4l_user", JSON.stringify(data.user));

    // 🚦 REDIRECT AFTER LOGIN
    if (data.user.role === "admin") {
      window.location.href = "/account/admin/orders.html";
    } else {
      window.location.href = "/account/orders.html";
    }

  } catch (err) {
    console.error(err);
    error.textContent = "Server error";
  }
});
