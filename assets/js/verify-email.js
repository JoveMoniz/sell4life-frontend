const API  = window.API_BASE;
const msg  = document.getElementById('msg');
const card = document.getElementById('verifyCard');

const params = new URLSearchParams(location.search);
const token = params.get('token');
const justSent = params.get('sent') === '1';

function showSentScreen() {
  msg.className = '';
  card.innerHTML = `
    <p style="text-align:center;margin-bottom:16px">
      Account created — we've sent a verification link to your email.
      Click it to activate your account.
    </p>
    <p style="text-align:center;font-size:13px;color:#9ca3af;margin-bottom:16px">
      Nothing else will work until you verify — check your spam folder if it doesn't show up.
    </p>
    <p style="text-align:center">
      <button id="resendBtn" style="background:#0b6b6a;color:#fff;border:none;border-radius:6px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">
        Resend email
      </button>
    </p>
    <p id="resendMsg" style="text-align:center;font-size:13px;margin-top:10px"></p>`;

  document.getElementById('resendBtn').addEventListener('click', async (e) => {
    const btn = e.target;
    const resendMsg = document.getElementById('resendMsg');
    const authToken = localStorage.getItem('s4l_token');
    if (!authToken) {
      resendMsg.textContent = 'Please sign in first to resend the link.';
      resendMsg.style.color = '#f87171';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const res = await fetch(`${API}/auth/resend-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        resendMsg.textContent = 'Verification email sent — check your inbox.';
        resendMsg.style.color = '#4ade80';
      } else {
        resendMsg.textContent = data.msg || data.error || 'Could not resend — please try again.';
        resendMsg.style.color = '#f87171';
      }
    } catch {
      resendMsg.textContent = 'Network error — please try again.';
      resendMsg.style.color = '#f87171';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Resend email';
    }
  });
}

if (!token) {
  if (justSent) {
    showSentScreen();
  } else {
    msg.className   = 'error';
    msg.textContent = 'No verification token found. Check your email for the verification link.';
  }
} else {
  msg.textContent = 'Verifying your email…';

  fetch(`${API}/auth/verify-email?token=${encodeURIComponent(token)}`)
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        // Keep the cached user object (used by the site-wide "verify your
        // email" banner) in sync so it doesn't keep nagging after this.
        try {
          const cached = JSON.parse(localStorage.getItem('s4l_user') || 'null');
          if (cached) {
            cached.emailVerified = true;
            localStorage.setItem('s4l_user', JSON.stringify(cached));
          }
        } catch {}

        // Same device they registered on — they're still logged in (the
        // account gate just unblocked), so send them straight back in
        // rather than making them sign in again.
        const alreadyLoggedIn = !!localStorage.getItem('s4l_token');
        const dest = localStorage.getItem('postLoginRedirect') || '/';
        localStorage.removeItem('postLoginRedirect');

        msg.className = 'success';
        card.innerHTML = alreadyLoggedIn
          ? `
            <p class="success" style="text-align:center;margin-bottom:16px">
              Your email has been verified successfully!
            </p>
            <p style="text-align:center">
              <a href="${dest}" style="color:#9ee7e0;font-weight:600">Continue to Sell4Life →</a>
            </p>`
          : `
            <p class="success" style="text-align:center;margin-bottom:16px">
              Your email has been verified successfully!
            </p>
            <p style="text-align:center">
              <a href="/account/signin.html" style="color:#9ee7e0;font-weight:600">Sign in to your account →</a>
            </p>`;
      } else {
        msg.className   = 'error';
        msg.textContent = data.msg || 'This link is invalid or has expired.';
        card.insertAdjacentHTML('beforeend', `
          <p style="text-align:center;margin-top:12px">
            <a href="/account/signin.html" style="color:#9ee7e0;font-size:13px">Sign in to request a new link</a>
          </p>`);
      }
    })
    .catch(() => {
      msg.className   = 'error';
      msg.textContent = 'Could not connect. Please try again.';
    });
}
