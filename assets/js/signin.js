document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signinForm");
  const msg = document.getElementById("msg");

  if (!form) {
    console.error("signinForm not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    msg.textContent = "Checking...";
    msg.style.color = "white";

    try {
      const res = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || "Login failed";
        msg.style.color = "red";
        return;
      }

      // store user + token
      localStorage.setItem("s4l_user", JSON.stringify(data.user));
      localStorage.setItem("s4l_token", data.token);

      msg.textContent = "Login successful";
      msg.style.color = "lightgreen";

      setTimeout(() => {
        window.location.href = "/account/orders.html";
      }, 800);

    } catch (err) {
      msg.textContent = "Server error";
      msg.style.color = "red";
    }
  });
});
