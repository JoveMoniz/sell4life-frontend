// ======================================================
// CURRENCY — one fetch per page load resolves which currency to display
// prices in (based on GeoIP) and the GBP conversion rate to use. Plain
// script (not a module), loaded before any page script that formats
// prices — those scripts should `await window.S4L_CURRENCY_READY` before
// their first price render.
//
// Display-only: the actual Stripe charge always happens in GBP. This
// just shows buyers an approximate price in a currency they recognize,
// with a small conversion markup baked in (same principle Stripe's own
// "Adaptive Pricing" uses) so it doesn't undersell once real card-network
// conversion costs are accounted for.
// ======================================================
(function () {
  let info = { currency: 'GBP', rate: 1, symbol: '£' };

  window.S4L_CURRENCY_READY = fetch(`${window.API_BASE}/currency/me`)
    .then((r) => r.json())
    .then((d) => { if (d && d.currency) info = d; })
    .catch(() => { /* keep the GBP fallback */ });

  window.s4lCurrencyInfo = function () {
    return info;
  };

  // gbpAmount: a plain number already in GBP (how every price is stored).
  // Returns a formatted string like "£12.34" / "€14.20" / "$16.99".
  window.s4lFormatPrice = function (gbpAmount) {
    const n = Number(gbpAmount) || 0;
    return `${info.symbol}${(n * info.rate).toFixed(2)}`;
  };
})();
