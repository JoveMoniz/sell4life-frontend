// Shared Founding Seller status banner — used on the vendor Dashboard,
// Store Settings, and (in fuller form) Transactions. Fetches the single
// source of truth (/vendor/fee-rate, already computes used/remaining/active
// from the vendor's real order history) and renders a full-conditions
// banner into a given element. Hidden entirely for non-enrolled vendors.
window.renderFoundingSellerBanner = async function (elId) {
  const el = document.getElementById(elId);
  if (!el) return;

  try {
    const token = localStorage.getItem('s4l_token');
    const res = await fetch(`${window.API_BASE}/vendor/fee-rate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    const fs = data.foundingSeller;
    if (!fs?.enrolled) { el.innerHTML = ''; return; }

    const ratePct = Math.round(fs.rate * 100);
    const normalPct = Math.round(data.normalCommissionRate * 100);
    const rateText = ratePct === 0 ? 'fully free (0% commission)' : `a discounted ${ratePct}% commission`;
    const joinedText = fs.joinedAt
      ? ` Joined the program ${new Date(fs.joinedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`
      : '';

    if (fs.active) {
      el.innerHTML = `
        <div style="background:#fef9c3;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;margin-bottom:18px;font-size:13px;color:#854d0e">
          <strong><svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="8" r="5"/><path d="M9 12.5L7 21l5-3 5 3-2-8.5"/></svg> You're a Founding Seller!</strong> Your first ${fs.limit} sales are ${rateText} (normally ${normalPct}%).
          You've used ${fs.used}/${fs.limit} — <strong>${fs.remaining}</strong> discounted sale${fs.remaining !== 1 ? 's' : ''} left.${joinedText}
        </div>`;
    } else {
      el.innerHTML = `
        <div style="background:#f9fafb;border-left:4px solid #9ca3af;border-radius:6px;padding:12px 16px;margin-bottom:18px;font-size:13px;color:#4b5563">
          You were a Founding Seller — your ${fs.limit} discounted sale${fs.limit !== 1 ? 's' : ''} (at ${ratePct}%) have all been used. The standard ${normalPct}% commission now applies.${joinedText}
        </div>`;
    }
  } catch (_) {
    // non-critical — leave the element empty rather than blocking the page
  }
};
