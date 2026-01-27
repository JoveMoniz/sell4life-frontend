// =====================================================
// SIGN IN (intent-based redirect)
// =====================================================

import { API_BASE } from "./config.js";

console.log("signin.js loaded");

// =====================================================
// AUTO-REDIRECT IF ALREADY LOGGED IN
// =====================================================
const existingToken = localStorage.getItem("s4l_token");

if (existingToken) {
  const redirect =
    localStorage.getItem("postLoginRedirect") || "/";

  localStorage.removeItem("postLoginRedirect");
  window.location.href = redirect;
}

// =====================================================
// DOM READY
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signinForm");
  const msg  = document.getElementById("msg");

  if (!form || !msg) {
    console.error("Signin DOM elements missing");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    msg.textContent = "Checking credentials...";
    msg.style.color = "white";

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const text = await res.text();
      console.log("LOGIN STATUS:", res.status);
      console.log("LOGIN RAW RESPONSE:", text);

      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        msg.textContent = "Invalid server response";
        msg.style.color = "red";
        return;
      }

      if (!res.ok || !data.token) {
        msg.textContent = data.msg || "Login failed";
        msg.style.color = "red";
        return;
      }

      // ✅ Store auth
      localStorage.setItem("s4l_token", data.token);
      localStorage.setItem("s4l_user", JSON.stringify(data.user));

      msg.textContent = "Login successful";
      msg.style.color = "lightgreen";

      // ✅ Obey stored intent
      const redirect =
        localStorage.getItem("postLoginRedirect") || "/";

      localStorage.removeItem("postLoginRedirect");

      setTimeout(() => {
        window.location.href = redirect;
      }, 300);

    } catch (err) {
      console.error("LOGIN ERROR:", err);
      msg.textContent = "Server error";
      msg.style.color = "red";
    }
  });
});
