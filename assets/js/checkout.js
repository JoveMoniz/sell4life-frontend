// ======================================================
// SELL4LIFE CHECKOUT
// Stripe Payment Element + Order Creation Flow
// ======================================================

// ======================================================
// URL PARAMETERS
// ======================================================

const params = new URLSearchParams(window.location.search);
const existingOrderId = params.get('order');

// ======================================================
// DOM ELEMENTS
// ======================================================

const itemsWrap = document.getElementById('checkout-items');
const subtotalEl = document.getElementById('checkout-subtotal');
// shippingFields.country is the HIDDEN code input (checkout-country-code) —
// every other part of this file (address-format lookup, the Pay Now
// payload, prefill) reads/writes an ISO code exactly as before. The visible
// typeahead (countryNameInput, below) is name-based and resolves into it.
const shippingFields = {
  name: document.getElementById('checkout-name'),
  phone: document.getElementById('checkout-phone'),
  address1: document.getElementById('checkout-address'),
  address2: document.getElementById('checkout-address2'),
  city: document.getElementById('checkout-city'),
  county: document.getElementById('checkout-county'),
  postcode: document.getElementById('checkout-postcode'),
  country: document.getElementById('checkout-country-code'),
};

// ======================================================
// COUNTRY — type-to-search instead of scrolling a ~190-option list.
// A plain <select> already existed here; this swaps it for an <input>
// backed by a <datalist> (same pattern as vendor-edit-product.js's
// attribute datalists) since datalist binds by visible text, not the ISO
// code the backend needs — a hidden input (shippingFields.country) holds
// the resolved code, kept in sync on every input/change/blur.
// ======================================================
const countryNameInput = document.getElementById('checkout-country');
const countryList = document.getElementById('checkout-country-list');
const COUNTRIES = Array.isArray(window.S4L_COUNTRIES) ? window.S4L_COUNTRIES : [];
const countryByCode = new Map(COUNTRIES.map(c => [c.code, c.name]));
const countryByNameLower = new Map(COUNTRIES.map(c => [c.name.toLowerCase(), c.code]));

if (countryList) {
  countryList.innerHTML = COUNTRIES.map(c => `<option value="${c.name}"></option>`).join('');
}

function setCountryCode(code, { skipFormat } = {}) {
  const resolvedCode = countryByCode.has(code) ? code : 'GB';
  shippingFields.country.value = resolvedCode;
  if (countryNameInput) countryNameInput.value = countryByCode.get(resolvedCode) || '';
  if (!skipFormat) applyAddressFormat(resolvedCode);
}

function resolveCountryFromTypedName() {
  if (!countryNameInput) return;
  const typed = countryNameInput.value.trim().toLowerCase();
  const matchedCode = countryByNameLower.get(typed);
  if (matchedCode) {
    shippingFields.country.value = matchedCode;
    applyAddressFormat(matchedCode);
  }
  // An unmatched/partial name is left as typed — no country change fires
  // until it resolves to a real one, so the format/currency logic never
  // acts on a country that isn't actually valid.
}

countryNameInput?.addEventListener('change', resolveCountryFromTypedName);
countryNameInput?.addEventListener('blur', resolveCountryFromTypedName);
// Select the pre-filled country name on focus so the first keystroke just
// replaces it — without this, a buyer has to manually clear "United
// Kingdom" before they can type their own country.
countryNameInput?.addEventListener('focus', () => countryNameInput.select());

setCountryCode('GB', { skipFormat: true });

// ======================================================
// ADDRESS FORMAT BY COUNTRY
// The form used to hardcode UK-style "County"/"Postcode" labels for every
// buyer regardless of the country selected — a US address has no county
// (it needs a required State instead) and a German address has no county
// field at all. GB stays the default/fallback shape since that's still
// the primary market; anything not explicitly listed gets a generic
// "State / Region" (optional) + "Postal Code" shape rather than the
// UK-specific wording.
// ======================================================
// postalPattern: catches the case a country selection alone doesn't —
// picking "United States" but leaving a UK-shaped postcode typed in used
// to pass validation, since only "is it non-empty" was checked, never
// "does it actually look right for the country selected." Deliberately
// only set for the countries we explicitly model (GB/US/DE); anything
// falling through to DEFAULT_ADDRESS_FORMAT has too many real-world postal
// formats to safely hardcode one pattern without false-rejecting a
// legitimate address, so it stays a plain required-field check.
const ADDRESS_FORMATS = {
  GB: { regionLabel: 'County', regionRequired: false, showRegion: true, postalLabel: 'Postcode', postalPlaceholder: '', phonePlaceholder: '07…', postalPattern: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, postalExample: 'SW1A 1AA' },
  US: { regionLabel: 'State', regionRequired: true, showRegion: true, postalLabel: 'ZIP Code', postalPlaceholder: '90210', phonePlaceholder: '(555) 123-4567', postalPattern: /^\d{5}(-\d{4})?$/, postalExample: '90210' },
  DE: { regionLabel: '', regionRequired: false, showRegion: false, postalLabel: 'Postal Code', postalPlaceholder: '10115', phonePlaceholder: '030 12345678', postalPattern: /^\d{5}$/, postalExample: '10115' },
};
const DEFAULT_ADDRESS_FORMAT = { regionLabel: 'State / Region', regionRequired: false, showRegion: true, postalLabel: 'Postal Code', postalPlaceholder: '', phonePlaceholder: 'Phone number' };

const countyRow = document.getElementById('checkout-county-row');
const countyLabel = document.getElementById('checkout-county-label');
const postcodeLabel = document.getElementById('checkout-postcode-label');

function applyAddressFormat(countryCode) {
  const fmt = ADDRESS_FORMATS[countryCode] || DEFAULT_ADDRESS_FORMAT;

  if (countyRow) countyRow.style.display = fmt.showRegion ? '' : 'none';
  if (countyLabel) {
    countyLabel.textContent = fmt.regionRequired ? fmt.regionLabel : `${fmt.regionLabel} (optional)`;
  }
  if (!fmt.showRegion && shippingFields.county) shippingFields.county.value = '';

  if (postcodeLabel) postcodeLabel.textContent = fmt.postalLabel;
  if (shippingFields.postcode) shippingFields.postcode.placeholder = fmt.postalPlaceholder;

  if (shippingFields.phone) shippingFields.phone.placeholder = fmt.phonePlaceholder;

  // US State becomes a searchable list (same typeahead pattern as Country)
  // instead of free text — every other country's region field stays plain
  // text, since there's no equivalent well-known short list to offer.
  if (shippingFields.county) {
    if (countryCode === 'US') {
      shippingFields.county.setAttribute('list', 'checkout-state-list');
    } else {
      shippingFields.county.removeAttribute('list');
    }
  }
}

applyAddressFormat(shippingFields.country?.value || 'GB');

// ======================================================
// US STATE LIST + PHONE MASK + ZIP AUTOFILL
// ======================================================

if (document.getElementById('checkout-state-list') && Array.isArray(window.S4L_US_STATES)) {
  document.getElementById('checkout-state-list').innerHTML = window.S4L_US_STATES
    .map(s => `<option value="${s.name}"></option>`).join('');
}

// US phone numbers are conventionally written (XXX) XXX-XXXX — format live
// as digits are typed instead of leaving the buyer to type the punctuation
// themselves. Only active while US is selected; switching away leaves
// whatever was typed alone rather than fighting a different country's
// format.
function formatUsPhone(digits) {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

shippingFields.phone?.addEventListener('input', () => {
  if (shippingFields.country?.value !== 'US') return;
  const caretWasAtEnd = shippingFields.phone.selectionStart === shippingFields.phone.value.length;
  shippingFields.phone.value = formatUsPhone(shippingFields.phone.value);
  if (caretWasAtEnd) {
    shippingFields.phone.setSelectionRange(shippingFields.phone.value.length, shippingFields.phone.value.length);
  }
});

// A US ZIP reliably maps to a real city/state (unlike area codes, which
// don't map cleanly to either) — autofill City/State from it instead of
// asking the buyer to pick a city from an unmanageably long list. Buyer
// can still hand-edit either field afterward; this never blocks or
// overwrites a correct manual entry with a failed/slow lookup.
//
// Routed through our own backend (/api/currency/us-zip-lookup/:zip) rather
// than calling the third-party lookup API directly from here — a direct
// browser call was confirmed to silently fail in real testing, almost
// certainly a browser ad-blocker/privacy extension blocking fetches to an
// unfamiliar third-party domain (common, and impossible to control for
// from the frontend). The backend has no such risk.
let lastZipLookup = '';
async function autofillFromUsZip() {
  if (shippingFields.country?.value !== 'US') return;
  const zip = (shippingFields.postcode?.value || '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip) || zip === lastZipLookup) return;
  lastZipLookup = zip;
  try {
    const res = await fetch(`${API_BASE}/currency/us-zip-lookup/${zip}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.found) return;
    if (shippingFields.city && data.city) shippingFields.city.value = data.city;
    if (shippingFields.county) {
      const stateName = window.S4L_US_STATES?.find(s => s.code === data.stateCode)?.name;
      shippingFields.county.value = stateName || data.stateName || shippingFields.county.value;
    }
  } catch {
    // Best-effort only — a failed/offline lookup never blocks checkout,
    // the buyer just fills City/State in by hand as before.
  }
}

shippingFields.postcode?.addEventListener('input', autofillFromUsZip);
shippingFields.postcode?.addEventListener('blur', autofillFromUsZip);

const saveAddressEl = document.getElementById('checkout-save-address');
const shippingEl = document.getElementById('checkout-shipping');
const totalEl = document.getElementById('checkout-total');

const orderBtn = document.getElementById('place-order-btn');
const paymentHost = document.getElementById('payment-element');
const msgEl = document.getElementById('payment-message');

// Sticky Pay Now bar — a clone button shown once the real one scrolls
// out of view. Declared here so disableButton() (below) can mirror
// state onto it without a forward-reference error.
const stickyBar = document.getElementById('checkout-sticky-cta');
const stickyOrderBtn = document.getElementById('sticky-place-order-btn');
const stickyTotalEl = document.getElementById('sticky-cta-total');

// Display-only conversion — the actual Stripe charge is always computed
// server-side in GBP (see orders/create-payment-intent), this just shows
// the buyer the same currency they saw on the product page.
function fmt(n) {
  return window.s4lFormatPrice ? window.s4lFormatPrice(n) : `£${Number(n || 0).toFixed(2)}`;
}

// Set once initPayment() gets the authoritative shipping cost back from
// the server — kept outside renderItems() so a later currency-ready
// re-render can restore it instead of falling back to the £0.00 placeholder.
let lastShipping = null;

if (!itemsWrap || !subtotalEl || !shippingEl || !totalEl || !orderBtn || !paymentHost) {
  console.error('Checkout DOM missing');
}

// ======================================================
// BUY NOW MODE
// ======================================================

const buyNow = localStorage.getItem('buyNow') === 'true';

// ======================================================
// READ CART
// ======================================================
// Buy Now reads from its own separate slot — the real basket (`cart`) is
// never touched, so an abandoned Buy Now can't strand or lose basket items.

function readCart() {
  try {
    if (buyNow) {
      const item = JSON.parse(localStorage.getItem('buyNowItem') || 'null');
      return item && (item.productId || item.id) ? [item] : [];
    }
    const data = JSON.parse(localStorage.getItem('cart') || '[]');
    return Array.isArray(data) ? data.filter((i) => i && (i.productId || i.id)) : [];
  } catch {
    return [];
  }
}

let cart = readCart();

// ======================================================
// UI HELPERS
// ======================================================

function setMessage(text) {
  if (!msgEl) return;

  msgEl.textContent = text || '';
  msgEl.classList.toggle('hidden', !text);
}

function disableButton(disabled, label) {
  if (!orderBtn) return;

  orderBtn.disabled = !!disabled;

  if (disabled) {
    orderBtn.classList.add('s4l-btn-loading');
    orderBtn.innerHTML = `<span class="s4l-btn-spinner"></span>${label || orderBtn.textContent}`;
  } else {
    orderBtn.classList.remove('s4l-btn-loading');
    if (label) orderBtn.textContent = label;
  }

  // Mirror the same disabled/loading state onto the sticky bar's clone
  // button, so it never looks clickable while the real one is mid-payment.
  if (stickyOrderBtn) {
    stickyOrderBtn.disabled = orderBtn.disabled;
    stickyOrderBtn.innerHTML = orderBtn.innerHTML;
  }
}

// ======================================================
// RENDER CHECKOUT ITEMS
// ======================================================

function renderItems() {
  if (!cart.length) {
    itemsWrap.innerHTML = '<p>Your cart is empty.</p>';

    subtotalEl.textContent = fmt(0);
    shippingEl.textContent = fmt(0);
    totalEl.textContent = fmt(0);

    disableButton(true, 'Pay Now');

    return { subtotal: 0 };
  }

  disableButton(false, 'Pay Now');

  let subtotal = 0;

  itemsWrap.innerHTML = cart
    .map((item) => {
      const qty = Number(item.quantity || 1);
      const price = Number(item.price || 0);

      const line = qty * price;

      subtotal += line;

      return `
      <div class="checkout-item">

        <img
          class="checkout-thumb"
          src="${item.image || '/assets/images/products/sell4life-placeholder.png'}"
          alt="${item.name}"
          width="60"
          height="60"
          onerror="this.onerror=null;this.src='/assets/images/products/sell4life-placeholder.png';"
        />

        <div class="checkout-details">
          <div class="checkout-title-wrap">
            <span class="checkout-title">${item.name}</span>
          </div>
          <span class="checkout-qty">Quantity: ${qty}</span>
        </div>

        <span class="checkout-price">${fmt(line)}</span>

      </div>
    `;
    })
    .join('');

  subtotalEl.textContent = fmt(subtotal);
  shippingEl.textContent = fmt(0);
  totalEl.textContent = fmt(subtotal);

  // Scroll long titles — same pattern as cart.js
  requestAnimationFrame(() => {
    document.querySelectorAll('.checkout-title-wrap').forEach((wrap) => {
      const span = wrap.querySelector('.checkout-title');
      if (span && span.scrollWidth > wrap.offsetWidth + 2) {
        span.classList.add('scrollable');
      }
    });
  });

  return { subtotal };
}

renderItems();

// currency.js's GeoIP fetch may still be in flight on first render —
// re-render once it resolves so the buyer isn't left looking at GBP.
// renderItems() resets shipping/total to the £0.00 placeholder, so
// re-apply the authoritative server shipping figure afterward if it's
// already arrived by then.
if (window.S4L_CURRENCY_READY) {
  window.S4L_CURRENCY_READY.then(() => {
    renderItems();
    if (lastShipping !== null) {
      shippingEl.textContent = lastShipping > 0 ? fmt(lastShipping) : 'Free';
      const subtotal = cart.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
      totalEl.textContent = fmt(subtotal + lastShipping);
    }
  });
}

if (cart.length && window.s4lTrack) {
  window.s4lTrack('checkout_start', {
    itemCount: cart.length,
    subtotal: cart.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0),
  });
}

// ======================================================
// AUTH — optional. Signed-in buyers get their saved address prefilled;
// anyone else checks out as a guest via the email field above, which
// silently creates a lightweight account behind the scenes (see
// initPayment()'s guest branch) — no sign-in wall before checkout.
// ======================================================

let token = localStorage.getItem('s4l_token');
const emailField = document.getElementById('checkout-email');
const changeEmailBtn = document.getElementById('checkout-change-email');

// ======================================================
// PREFILL SAVED SHIPPING ADDRESS (signed-in buyers only)
// ======================================================

(async function prefillShippingAddress() {
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/account/me`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (emailField && data.email) {
      emailField.value = data.email;
      emailField.readOnly = true;
    }
    const addr = data.defaultShippingAddress;
    if (!addr) return;
    if (shippingFields.name && addr.name) shippingFields.name.value = addr.name;
    if (shippingFields.phone && addr.phone) shippingFields.phone.value = addr.phone;
    if (shippingFields.address1 && addr.address1) shippingFields.address1.value = addr.address1;
    if (shippingFields.address2 && addr.address2) shippingFields.address2.value = addr.address2;
    if (shippingFields.city && addr.city) shippingFields.city.value = addr.city;
    if (shippingFields.county && addr.county) shippingFields.county.value = addr.county;
    if (shippingFields.postcode && addr.postcode) shippingFields.postcode.value = addr.postcode;
    if (addr.country) setCountryCode(addr.country);
  } catch (_) {
    // Non-fatal — buyer can just type their address in
  } finally {
    // Setting .value programmatically doesn't fire blur/change — without
    // this, a signed-in buyer with a complete saved address would never
    // trigger the readiness check below and the payment element would
    // never mount until they manually clicked into a field.
    maybeInitPayment();
  }
})();

// ======================================================
// STRIPE INITIALIZATION
// ======================================================

const STRIPE_PK = window.STRIPE_PUBLISHABLE_KEY || '';

if (!STRIPE_PK) {
  console.error('Stripe publishable key missing');

  setMessage('Payment unavailable right now.');

  disableButton(true);
}

const stripe = STRIPE_PK ? Stripe(STRIPE_PK) : null;

let elements = null;
let paymentElement = null;
let currentOrder = null;
// Set when the email typed belongs to an existing real account — the order
// still goes through, but this browser was never proven to be that account
// holder, so it doesn't get a login token. The Pay Now handler below then
// authorizes the shipping-address call via the PaymentIntent's own
// clientSecret instead of a Bearer token.
let placedWithoutLogin = false;

// ======================================================
// BUILD ORDER ITEMS PAYLOAD
// ======================================================

function buildOrderItemsPayload() {
  return cart.map((item) => ({
    productId: item.productId || item._id || item.id,
    quantity: Number(item.quantity || 1),
    variantSku: item.variant?.sku || '',
    attributes: item.variant?.attributes || {},
    offerMessageId: item.offerMessageId || undefined,
  }));
}

// ======================================================
// SHIPPING ADDRESS — read + validate (shared by the readiness gate below
// and the Pay Now handler, so the two can never drift out of sync).
// ======================================================

function readShippingAddress() {
  return {
    name: shippingFields.name?.value?.trim() || '',
    phone: shippingFields.phone?.value?.trim() || '',
    address1: shippingFields.address1?.value?.trim() || '',
    address2: shippingFields.address2?.value?.trim() || '',
    city: shippingFields.city?.value?.trim() || '',
    county: shippingFields.county?.value?.trim() || '',
    postcode: shippingFields.postcode?.value?.trim() || '',
    country: shippingFields.country?.value?.trim() || 'GB',
  };
}

function validateShippingAddress(addr) {
  if (!addr.name || !addr.address1 || !addr.city || !addr.postcode) {
    return 'Please fill in your name, address, city and postcode.';
  }
  const addressFormat = ADDRESS_FORMATS[addr.country] || DEFAULT_ADDRESS_FORMAT;
  if (addressFormat.regionRequired && !addr.county) {
    return `Please fill in your ${addressFormat.regionLabel.toLowerCase()}.`;
  }
  if (addressFormat.postalPattern && !addressFormat.postalPattern.test(addr.postcode)) {
    const countryName = countryByCode.get(addr.country) || addr.country;
    return `That doesn't look like a valid ${countryName} ${addressFormat.postalLabel.toLowerCase()} (e.g. ${addressFormat.postalExample}) — please check it.`;
  }
  return null;
}

// ======================================================
// INITIALIZE PAYMENT
// ======================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let paymentInitialized = false;

async function initPayment() {
  if (!stripe) return;

  if (!cart.length) {
    setMessage('Cart is empty');
    disableButton(true);
    return;
  }

  // A previous attempt (e.g. a self-purchase block) may have overwritten
  // the order summary with an error message and never restored it — retry
  // starts from a clean, correct items display every time, not just on a
  // full page reload.
  renderItems();

  // No account yet — don't create a PaymentIntent (and no guest account)
  // until there's a real email to attach it to. The email field's own
  // listener below re-calls initPayment() once one is typed.
  if (!token && !EMAIL_RE.test(emailField?.value?.trim() || '')) {
    setMessage('Enter your email above to continue.');
    disableButton(true);
    return;
  }

  // Don't create the PaymentIntent (or mount the payment element) until a
  // complete shipping address exists — the PaymentIntent's currency is
  // fixed forever at creation, so the real shipping country needs to be
  // known before that call, not filled in afterward alongside an
  // already-mounted payment box. Each shipping field's blur listener
  // (below) re-calls this once the buyer finishes filling the form.
  const shippingAddress = readShippingAddress();
  const addressError = validateShippingAddress(shippingAddress);
  if (addressError) {
    setMessage(addressError);
    disableButton(true);
    return;
  }

  setMessage('');
  disableButton(true, 'Preparing payment…');

  try {
    let order;
    let res;

    // Same analytics session id client-info.js already tracks this browser
    // tab under — carried through to the order so the admin analytics page
    // can link a session to its order directly instead of guessing by
    // "same logged-in account, paid within ~2h" (which breaks the moment
    // checkout happens on a different device/account than whatever was
    // logged in during earlier browsing, e.g. guest checkout, or testing on
    // mobile while a vendor/admin account is logged in on desktop).
    let analyticsSessionId = '';
    try {
      analyticsSessionId = sessionStorage.getItem('s4l_session_id') || '';
    } catch { /* best-effort only */ }

    // The currency/rate/symbol this buyer was actually shown on-screen
    // (currency.js, GeoIP-based) — stored on the order so the confirmation
    // email and thank-you page show the same figure. For an order the
    // backend actually converts (currently just a US shipping address —
    // see utils/chargeCurrency.js), the real charge overrides this rather
    // than the two potentially drifting apart.
    const displayCurrency = window.s4lCurrencyInfo ? window.s4lCurrencyInfo() : { currency: 'GBP', rate: 1, symbol: '£' };

    // The validated shipping country (not the GeoIP-guessed display one) —
    // this is what the backend actually resolves the REAL charge currency
    // from. Stripe fixes a PaymentIntent's currency forever at creation, so
    // this has to be known and sent right here, before that call.
    const country = shippingAddress.country;

    if (token) {
      res = await fetch(`${API_BASE}/orders/create-payment-intent?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ items: buildOrderItemsPayload(), analyticsSessionId, displayCurrency, country }),
      });
    } else {
      // --------------------------------------------------
      // GUEST CHECKOUT — no account required. The backend creates a
      // lightweight account behind the scenes and logs it straight in
      // (same as a real sign-in) so every step after this is identical
      // to the authenticated path.
      // --------------------------------------------------
      // Same UTM/referrer this session already recorded for visit tracking
      // (client-info.js) — reused so a guest-checkout account creation can
      // be attributed to a traffic source/campaign, same as a direct
      // registration (this is a real new account, just created via
      // checkout instead of the signup form).
      let utm = {};
      let referrer = '';
      try {
        utm = JSON.parse(sessionStorage.getItem('s4l_session_utm') || '{}');
        referrer = sessionStorage.getItem('s4l_session_referrer') || '';
      } catch { /* attribution is best-effort only */ }

      res = await fetch(`${API_BASE}/orders/guest-checkout?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailField.value.trim(), items: buildOrderItemsPayload(), utm, referrer, analyticsSessionId, displayCurrency, country }),
      });
    }

    const data = await res.json();

    if (res.status === 401) {
      // Session expired mid-checkout — the cart/items are fine, the token
      // just went stale. Clear it before redirecting: signin.html's
      // "already logged in" check only looks at whether a token is
      // PRESENT, not whether it's still valid — leaving the stale token
      // in place bounces straight back here and 401s again, looping.
      localStorage.removeItem('s4l_token');
      localStorage.removeItem('s4l_user');
      localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
      window.location.href = '/account/signin.html';
      return;
    }

    if (!res.ok) {
      const errorText = data.error || 'Some items are unavailable';
      setMessage(errorText);

      // Show the real reason here too — this box is far more visible than
      // #payment-message (right column vs. buried in the Payment section
      // below an empty Stripe mount) — previously always overwritten with
      // a hardcoded "out of stock" claim regardless of the actual error
      // (e.g. the self-purchase block), which was actively misleading.
      itemsWrap.innerHTML = `<p>${errorText}</p>`;

      disableButton(true, 'Fix cart');

      return;
    }

    if (!token && data.token) {
      // Guest checkout just created (or reused) an account and logged it
      // in — carry on exactly like a normal signed-in checkout from here.
      token = data.token;
      localStorage.setItem('s4l_token', token);
      localStorage.setItem('s4l_user', JSON.stringify(data.user));
      if (emailField) emailField.readOnly = true;
      if (changeEmailBtn) changeEmailBtn.hidden = false;
    } else if (!token && data.accountExists) {
      placedWithoutLogin = true;
      if (emailField) emailField.readOnly = true;
      if (changeEmailBtn) changeEmailBtn.hidden = false;
    }

    order = data;

    // Update shipping + total display with authoritative server values
    if (shippingEl && order.shipping !== undefined) {
      const shipping = Number(order.shipping);
      lastShipping = shipping;
      shippingEl.textContent = shipping > 0 ? fmt(shipping) : 'Free';
      if (totalEl) {
        const subtotal = cart.reduce((s, i) => s + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
        totalEl.textContent = fmt(subtotal + shipping);
      }
    }

    currentOrder = {
      clientSecret: order.clientSecret,
      paymentIntentId: order.paymentIntentId,
    };

    elements = stripe.elements({
      clientSecret: currentOrder.clientSecret,
    });

    // Without this, Stripe's own card form defaults its billing
    // Country/Postal code fields independently of the shipping address
    // already entered above — confirmed in testing to default to United
    // Kingdom regardless of the buyer's real country, which then rejects a
    // US ZIP as an invalid UK postcode. Pre-filling from the shipping
    // address the buyer already gave us keeps the two in sync.
    paymentElement = elements.create('payment', {
      defaultValues: {
        billingDetails: {
          name: shippingAddress.name,
          phone: shippingAddress.phone,
          address: {
            line1: shippingAddress.address1,
            line2: shippingAddress.address2,
            city: shippingAddress.city,
            state: shippingAddress.county,
            postal_code: shippingAddress.postcode,
            country: shippingAddress.country,
          },
        },
      },
    });

    paymentElement.mount('#payment-element');

    paymentInitialized = true;
    disableButton(false, 'Pay Now');
  } catch (err) {
    console.error('INIT PAYMENT ERROR:', err);

    setMessage(err.message || 'Payment setup failed');
    disableButton(true);
  }
}

// Re-checks readiness (email + complete shipping address) and creates the
// PaymentIntent/mounts the payment element the moment both are satisfied —
// safe to call repeatedly (initPayment() itself re-validates and bails
// early if something's still missing), guarded here only so an already-
// mounted payment element doesn't get torn down and recreated on every
// subsequent field edit.
function maybeInitPayment() {
  if (!paymentInitialized) initPayment();
}

maybeInitPayment();

// Neither the email nor any shipping field is filled in at page load for a
// guest (initPayment() above just shows a prompt and stops) — re-check
// readiness as each one is completed, without waiting for the Pay Now
// click. countryNameInput's own blur already resolves the typed name into
// shippingFields.country before this fires, so a completed country
// selection is reflected immediately.
[emailField, ...Object.values(shippingFields), countryNameInput].forEach((el) => {
  el?.addEventListener('blur', maybeInitPayment);
});

// Lets a mistyped email be corrected after guest checkout has already
// created a session for it (or matched an existing account) — that
// session is only ever a lightweight guest account for the wrong address,
// so discarding it locally and starting over is safe. Only ever shown for
// a session created mid-checkout, never for a genuinely pre-existing
// login at page load (that case is handled separately in
// prefillShippingAddress() above, which locks a real account's email on
// purpose — this button is never revealed for it).
changeEmailBtn?.addEventListener('click', () => {
  localStorage.removeItem('s4l_token');
  localStorage.removeItem('s4l_user');
  token = null;
  placedWithoutLogin = false;

  paymentElement?.unmount();
  paymentElement = null;
  elements = null;
  currentOrder = null;
  paymentInitialized = false;

  const container = document.getElementById('payment-element');
  if (container) container.innerHTML = '';

  if (emailField) {
    emailField.readOnly = false;
    emailField.value = '';
    emailField.focus();
  }
  changeEmailBtn.hidden = true;

  setMessage('Enter your email above to continue.');
  disableButton(true);
});

// ======================================================
// PAY NOW BUTTON
// ======================================================

orderBtn?.addEventListener('click', async () => {
  if (!stripe || !elements) {
    setMessage('Payment is not ready.');

    return;
  }

  const shippingAddress = readShippingAddress();
  const addressError = validateShippingAddress(shippingAddress);
  if (addressError) {
    setMessage(addressError);
    return;
  }

  setMessage('');
  disableButton(true, 'Processing…');

  localStorage.setItem(
    'checkout_cleanup_plan',
    JSON.stringify({
      buyNow,
      createdAt: Date.now(),
    })
  );

  try {
    const addrRes = await fetch(`${API_BASE}/orders/shipping-address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({
        paymentIntentId: currentOrder?.paymentIntentId,
        // Only meaningful (and only checked server-side) when there's no
        // token — proves this browser legitimately owns this specific
        // checkout without needing a login session for the account.
        clientSecret: currentOrder?.clientSecret,
        ...shippingAddress,
        saveAsDefault: !!saveAddressEl?.checked,
      }),
    });

    if (addrRes.status === 401 && token) {
      localStorage.removeItem('s4l_token');
      localStorage.removeItem('s4l_user');
      localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
      window.location.href = '/account/signin.html';
      return;
    }

    if (!addrRes.ok) {
      const addrData = await addrRes.json().catch(() => ({}));
      setMessage(addrData.error || 'Could not save shipping address.');
      disableButton(false, 'Pay Now');
      return;
    }

    const result = await stripe.confirmPayment({
      elements,

      confirmParams: {
        return_url: `${window.location.origin}/thankyou/thankyou.html`,
      },
    });

    if (result?.error) {
      console.error('Stripe confirmPayment error:', result.error);

      setMessage(result.error.message || 'Payment failed.');

      disableButton(false, 'Pay Now');

      return;
    }
  } catch (err) {
    console.error('CONFIRM PAYMENT ERROR:', err);

    setMessage('Payment failed.');

    disableButton(false, 'Pay Now');
  }
});

// ======================================================
// STICKY PAY NOW BAR
// ======================================================
// Shows once the real button (inside the order summary card) scrolls out
// of the viewport, so it's reachable at any scroll position — the form
// above it (contact + shipping + Stripe payment element) can be much
// taller than the summary card, and .checkout-right's CSS `position:
// sticky` has proven unreliable for this kind of viewport-anchored
// control on this site before. Never runs its own payment logic —
// clicking it just clicks the real button.
if (orderBtn && stickyBar && stickyOrderBtn) {
  stickyOrderBtn.addEventListener('click', () => orderBtn.click());

  new IntersectionObserver(
    ([entry]) => stickyBar.classList.toggle('is-visible', !entry.isIntersecting),
    { threshold: 0 }
  ).observe(orderBtn);

  if (stickyTotalEl && totalEl) {
    const syncTotal = () => { stickyTotalEl.textContent = totalEl.textContent; };
    new MutationObserver(syncTotal).observe(totalEl, { childList: true, characterData: true, subtree: true });
    syncTotal();
  }
}
