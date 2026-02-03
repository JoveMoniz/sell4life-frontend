import { API_BASE } from "./config.js";

const form  = document.getElementById("loginForm");
const error = document.getElementById("error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // reset message state
  error.textContent = "Checking credentials…";
  error.className = "";
  
  const email    = document.getElementById("email").value.trim();
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
      error.className = "error";
      return;
    }

    // 🚫 BLOCK NON-ADMINS HERE
    if (data.user.role !== "admin") {
      error.textContent = "You do not have admin access.";
      error.className = "error";
      return;
    }

    // 🔐 Persist auth state (ADMIN ONLY)
    localStorage.setItem("s4l_token", data.token);
    localStorage.setItem("s4l_role", data.user.role);
    localStorage.setItem("s4l_user", JSON.stringify(data.user));

    // ✅ Success feedback
    error.textContent = "Login successful";
    error.className = "success";

    // 🚦 Redirect to admin dashboard
    setTimeout(() => {
      window.location.replace("/account/admin/index.html");
    }, 600);

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    error.textContent = "Server error. Try again.";
    error.className = "error";
  }
});
