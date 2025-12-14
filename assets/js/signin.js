

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    // rest of your existing code






document.getElementById("signinForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");

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
            msg.textContent = data.error;
            msg.style.color = "red";
            return;
        }

        // Save user session in localStorage
        localStorage.setItem("s4l_user", JSON.stringify(data.user));

        msg.textContent = "Login successful!";
        msg.style.color = "lightgreen";

        setTimeout(() => {
            window.location.href = "/account/orders.html";
        }, 800);

    } catch (err) {
        msg.textContent = "Server error.";
        msg.style.color = "red";
    }
});


  });
});