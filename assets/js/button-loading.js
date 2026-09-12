// ======================================================
// CENTRALIZED BUTTON LOADING STATE
// One shared helper so any async button click across the site shows a
// spinner + gets disabled for the duration of the request, instead of
// sitting silently — which is exactly what invites a double-click on
// money-moving actions (checkout, offers, messages). Loaded site-wide via
// layout.js, so window.setButtonLoading / window.guardedClick are
// available on every page without a separate script tag.
// ======================================================

window.setButtonLoading = function setButtonLoading(btn, isLoading, loadingText) {
  if (!btn) return;

  if (isLoading) {
    if (btn.dataset.loadingActive === 'true') return; // already loading — don't stack
    btn.dataset.loadingActive = 'true';
    btn.dataset.loadingOriginalHtml = btn.innerHTML;
    btn.dataset.loadingWasDisabled = btn.disabled ? 'true' : 'false';
    btn.disabled = true;
    btn.classList.add('s4l-btn-loading');
    const spinner = '<span class="s4l-btn-spinner"></span>';
    btn.innerHTML = loadingText ? `${spinner}${loadingText}` : `${spinner}${btn.dataset.loadingOriginalHtml}`;
  } else {
    if (btn.dataset.loadingActive !== 'true') return;
    btn.innerHTML = btn.dataset.loadingOriginalHtml ?? btn.innerHTML;
    btn.disabled = btn.dataset.loadingWasDisabled === 'true';
    btn.classList.remove('s4l-btn-loading');
    delete btn.dataset.loadingActive;
    delete btn.dataset.loadingOriginalHtml;
    delete btn.dataset.loadingWasDisabled;
  }
};

// Wraps an async click handler: shows the spinner immediately, guarantees
// re-enable in a finally (even if the handler throws), and — critically —
// ignores any click that arrives while already loading, so a fast
// double-click can never fire the handler a second time.
window.guardedClick = function guardedClick(btn, handler, loadingText) {
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    if (btn.dataset.loadingActive === 'true') { e.preventDefault(); return; }
    window.setButtonLoading(btn, true, loadingText);
    try {
      await handler(e);
    } finally {
      window.setButtonLoading(btn, false);
    }
  });
};
