// =====================================================
// REGISTER (auto-login + intent redirect) – FIXED
// =====================================================

import { API_BASE } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const msg = document.getElementById('msg');

  if (!form || !msg) {
    console.error('Register DOM elements missing');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name')?.value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    msg.textContent = 'Creating account...';
    msg.style.color = 'white';

    // Same UTM/referrer this session already recorded for visit tracking
    // (client-info.js) — reused here so registrations can be attributed
    // to a traffic source/campaign, not just visits. Never let a missing
    // or blocked sessionStorage stop registration itself.
    let utm = {};
    let referrer = '';
    try {
      utm = JSON.parse(sessionStorage.getItem('s4l_session_utm') || '{}');
      referrer = sessionStorage.getItem('s4l_session_referrer') || '';
    } catch { /* attribution is best-effort only */ }

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, utm, referrer }),
      });

      const data = await res.json();
      console.log('REGISTER RESPONSE:', data);

      // ❌ Fail if no token
      if (!res.ok || !data.token) {
        msg.textContent = data.error || data.msg || 'Registration failed';
        msg.style.color = 'red';
        return;
      }

      // ✅ AUTO-LOGIN
      localStorage.setItem('s4l_token', data.token);
      localStorage.setItem('s4l_user', JSON.stringify(data.user));

      // A brand-new account is never pre-verified — every authenticated
      // action is blocked server-side until they click the email link, so
      // send them to that screen instead of into the app. Keep whatever
      // destination they were originally headed to; the "check your
      // email" screen picks it back up once they're verified.
      if (!data.user.emailVerified) {
        msg.textContent = 'Account created. Check your email to activate it...';
        msg.style.color = 'lightgreen';
        setTimeout(() => {
          window.location.href = '/account/verify-email.html?sent=1';
        }, 300);
        return;
      }

      msg.textContent = 'Account created. Logging you in...';
      msg.style.color = 'lightgreen';

      // ✅ Redirect back to origin
      const redirect = localStorage.getItem('postLoginRedirect') || '/';

      localStorage.removeItem('postLoginRedirect');

      setTimeout(() => {
        window.location.href = redirect;
      }, 300);
    } catch (err) {
      console.error('REGISTER ERROR:', err);
      msg.textContent = 'Server error';
      msg.style.color = 'red';
    }
  });
});
