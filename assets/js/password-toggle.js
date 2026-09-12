// Wires up any ".pw-toggle-btn" (paired with a sibling password <input>
// inside the same ".pw-field-wrap") to show/hide the password text.
(function () {
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.06 21.06 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.06 21.06 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  document.querySelectorAll('.pw-toggle-btn').forEach(function (btn) {
    const input = btn.closest('.pw-field-wrap')?.querySelector('input[type="password"], input[type="text"]');
    if (!input) return;
    btn.innerHTML = EYE;
    btn.setAttribute('aria-label', 'Show password');
    btn.addEventListener('click', function () {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.innerHTML = isHidden ? EYE_OFF : EYE;
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });
})();
