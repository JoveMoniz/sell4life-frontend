import { API_BASE } from "./config.js";

const form  = document.getElementById("loginForm");
const error = document.getElementById("error");
const btn   = form.querySelector("button");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";
  error.className = "";

  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  // UI: loading state
  btn.disabled = true;
  btn.textContent = "Checking credentials…";

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.msg || "Login failed");
    }

    // 🔐 Persist auth state
    localStorage.setItem("s4l_token", data.token);
    localStorage.setItem("s4l_role", data.user.role);
    localStorage.setItem("s4l_user", JSON.stringify(data.user));

    // UI: success feedback
    btn.textContent = "Logged in";
    error.textContent = "Login successful";
    error.classList.add("success");

    // Tiny pause so humans can read it
    setTimeout(() => {
      if (data.user.role === "admin") {
        window.location.href = "/account/admin/index.html";
      } else {
        window.location.href = "/account/orders.html";
      }
    }, 500);

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    error.textContent = err.message || "Server error";

    // Restore UI
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});
