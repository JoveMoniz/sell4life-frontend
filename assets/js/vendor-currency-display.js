// ======================================================
// VENDOR CURRENCY DISPLAY — shared by every vendor-facing page that shows
// money the vendor themselves earns (Dashboard, Transactions, Payouts,
// Orders). A US-country vendor sees dollar ONLY, everyone else sees pound
// ONLY, exactly as before this existed — real accounting stays GBP-
// canonical underneath regardless, this is purely how it's displayed.
//
// A page opts in by including this script and calling fmtVendorMoney(gbp,
// displayCurrency) instead of hardcoding '£' + amount — `displayCurrency`
// is the `displayCurrency` field the relevant API response now returns
// (null for a GBP vendor, {currency, rate, symbol} otherwise).
// ======================================================

function fmtVendorMoney(gbpAmount, displayCurrency) {
  const num = Number(gbpAmount || 0);
  if (displayCurrency && displayCurrency.currency && displayCurrency.currency !== 'GBP') {
    const symbol = displayCurrency.symbol || '$';
    const converted = num * Number(displayCurrency.rate || 1);
    const sign = converted < 0 ? '-' : '';
    return `${sign}${symbol}${Math.abs(converted).toFixed(2)}`;
  }
  const sign = num < 0 ? '-' : '';
  return `${sign}£${Math.abs(num).toFixed(2)}`;
}
