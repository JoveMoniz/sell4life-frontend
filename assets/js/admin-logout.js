document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("s4l_token");
    localStorage.removeItem("s4l_role");
    localStorage.removeItem("s4l_user");
    window.location.href = "/account/admin/signin.html";
  });
});
