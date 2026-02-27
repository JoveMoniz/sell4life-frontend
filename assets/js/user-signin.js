// =====================================================
// SIGN IN (intent-based, NOT role-based)
// =====================================================

console.log('user-signin.js loaded');

// =====================================================
// AUTO-REDIRECT IF ALREADY LOGGED IN
// =====================================================
const existingToken = localStorage.getItem('s4l_token');

if (existingToken) {
  const redirect = localStorage.getItem('postLoginRedirect') || '/account/orders.html';

  localStorage.removeItem('postLoginRedirect');
  window.location.href = redirect;
}

// =====================================================
// INITIALISE FORM (NO DOMContentLoaded WRAPPER)
// =====================================================

const form = document.getElementById('signinForm');
const msg = document.getElementById('msg');

if (!form || !msg) {
  console.error('Signin DOM elements missing');
} else {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    msg.textContent = 'Checking credentials…';
    msg.style.color = '#e5e7eb';

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
        console.log('STATUS:', res.status);
        console.log('RESPONSE:', data);
      } catch {
        msg.textContent = 'Invalid server response';
        msg.style.color = 'red';
        return;
      }

      if (!res.ok || !data.token || !data.user) {
        msg.textContent = data.msg || 'Login failed';
        msg.style.color = 'red';
        return;
      }

      // STORE AUTH
      localStorage.setItem('s4l_token', data.token);
      localStorage.setItem('s4l_user', JSON.stringify(data.user));

      msg.textContent = 'Login successful';
      msg.style.color = 'lightgreen';

      let redirect = localStorage.getItem('postLoginRedirect');
      localStorage.removeItem('postLoginRedirect');

      if (!redirect) {
        redirect = '/account/orders.html';
      }

      window.location.replace(redirect);
    } catch (err) {
      console.error('LOGIN ERROR:', err);
      msg.textContent = 'Server error';
      msg.style.color = 'red';
    }
  });
}
