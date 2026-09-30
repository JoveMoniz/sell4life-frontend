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

// Plain numeric conversion, no formatting — for editable fields (Add/Edit
// Product prices) where a US vendor types a real dollar amount that must be
// converted to GBP before it's sent to the API (every price is stored in
// GBP platform-wide). Returns the input unchanged for a GBP vendor.
function vendorAmountToGbp(displayAmount, displayCurrency) {
  const num = Number(displayAmount || 0);
  if (!displayCurrency || !displayCurrency.currency || displayCurrency.currency === 'GBP') return num;
  return num / Number(displayCurrency.rate || 1);
}

// The reverse — GBP (stored) -> the vendor's display currency, for
// prefilling an editable field when opening an existing product.
function vendorAmountFromGbp(gbpAmount, displayCurrency) {
  const num = Number(gbpAmount || 0);
  if (!displayCurrency || !displayCurrency.currency || displayCurrency.currency === 'GBP') return num;
  return num * Number(displayCurrency.rate || 1);
}

// Swaps every "(£)" label/placeholder inside `root` to the vendor's real
// currency symbol, e.g. "Price (£)" -> "Price ($)". A no-op for a GBP
// vendor. Call once, after the vendor's displayCurrency is known.
//
// Only touches direct TEXT NODES of each label — many of these labels have
// a child <span> (the "*" required marker, or a hint) sitting right after
// the "(£)" text, so walking .textContent (or skipping any element that
// has child elements at all) either mangles that child's own text or
// skips the label entirely. Direct text nodes are the label's own words,
// untouched by whatever child elements sit alongside them.
function relabelVendorMoneyFields(root, displayCurrency) {
  if (!displayCurrency || !displayCurrency.currency || displayCurrency.currency === 'GBP') return;
  const symbol = displayCurrency.symbol || '$';
  root.querySelectorAll('label, .ap-hint, span').forEach((el) => {
    el.childNodes.forEach((node) => {
      if (node.nodeType === 3 && node.textContent.includes('(£)')) {
        node.textContent = node.textContent.replace(/\(£\)/g, `(${symbol})`);
      }
    });
  });
  root.querySelectorAll('input[placeholder]').forEach((el) => {
    if (el.placeholder.includes('£')) el.placeholder = el.placeholder.replace(/£/g, symbol);
  });
}
