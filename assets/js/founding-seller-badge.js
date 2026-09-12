// Shared "Founding Seller spots remaining" badge — used on the Sell page
// and at vendor registration. Looks for #founding-seller-badge and fills it
// in from the public, unauthenticated /founding-seller-status endpoint.
(async function () {
  const el = document.getElementById('founding-seller-badge');
  if (!el) return;

  try {
    const res = await fetch(`${window.API_BASE}/founding-seller-status`);
    if (!res.ok) return;
    const { cap, remaining } = await res.json();
    if (!cap) return; // program not configured — stay hidden

    el.textContent = remaining > 0
      ? `<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="8" r="5"/><path d="M9 12.5L7 21l5-3 5 3-2-8.5"/></svg> Founding Seller spots: ${remaining}/${cap} left`
      : '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><circle cx="12" cy="8" r="5"/><path d="M9 12.5L7 21l5-3 5 3-2-8.5"/></svg> Founding Seller spots are full';
    el.hidden = false;
  } catch (_) {
    // stay hidden on any failure — never block the page on this
  }
})();
