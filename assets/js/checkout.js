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
const shippingFields = {
  name: document.getElementById('checkout-name'),
  phone: document.getElementById('checkout-phone'),
  address1: document.getElementById('checkout-address'),
  address2: document.getElementById('checkout-address2'),
  city: document.getElementById('checkout-city'),
  county: document.getElementById('checkout-county'),
  postcode: document.getElementById('checkout-postcode'),
  country: document.getElementById('checkout-country'),
};
// Populate the country dropdown with real ISO codes as values — replaces
// the old free-text field, whose typed value was silently discarded
// server-side anyway (shipping-address always forced country to 'GB'
// regardless of what was typed). GB is selected by default since that's
// still the primary market.
if (shippingFields.country && Array.isArray(window.S4L_COUNTRIES)) {
  shippingFields.country.innerHTML = window.S4L_COUNTRIES
    .map(c => `<option value="${c.code}">${c.name}</option>`).join('');
  shippingFields.country.value = 'GB';
}

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
    if (shippingFields.country && addr.country) shippingFields.country.value = addr.country;
  } catch (_) {
    // Non-fatal — buyer can just type their address in
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
let currentOrder = null;

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

  // No account yet — don't create a PaymentIntent (and no guest account)
  // until there's a real email to attach it to. The email field's own
  // listener below re-calls initPayment() once one is typed.
  if (!token && !EMAIL_RE.test(emailField?.value?.trim() || '')) {
    setMessage('Enter your email above to continue.');
    disableButton(true);
    return;
  }

  setMessage('');
  disableButton(true, 'Preparing payment…');

  try {
    let order;
    let res;

    if (token) {
      res = await fetch(`${API_BASE}/orders/create-payment-intent?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ items: buildOrderItemsPayload() }),
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
        body: JSON.stringify({ email: emailField.value.trim(), items: buildOrderItemsPayload(), utm, referrer }),
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

    if (res.status === 409 && data.code === 'ACCOUNT_EXISTS') {
      setMessage(data.error + ' ');
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = 'Sign in';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
        window.location.href = '/account/signin.html';
      });
      msgEl?.appendChild(link);
      disableButton(true, 'Fix cart');
      return;
    }

    if (!res.ok) {
      setMessage(data.error || 'Some items are unavailable');

      itemsWrap.innerHTML = '<p>Some items are out of stock. Please update your cart.</p>';

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

    const paymentElement = elements.create('payment');

    paymentElement.mount('#payment-element');

    paymentInitialized = true;
    disableButton(false, 'Pay Now');
  } catch (err) {
    console.error('INIT PAYMENT ERROR:', err);

    setMessage(err.message || 'Payment setup failed');
    disableButton(true);
  }
}

initPayment();

// A guest hasn't typed their email yet at page load (initPayment() above
// just shows the "enter your email" prompt and stops) — this fires it for
// real the moment they provide one, without waiting for the Pay Now click.
if (emailField && !token) {
  emailField.addEventListener('blur', () => {
    if (!paymentInitialized && EMAIL_RE.test(emailField.value.trim())) initPayment();
  });
}

// ======================================================
// PAY NOW BUTTON
// ======================================================

orderBtn?.addEventListener('click', async () => {
  if (!stripe || !elements) {
    setMessage('Payment is not ready.');

    return;
  }

  const shippingAddress = {
    name: shippingFields.name?.value?.trim() || '',
    phone: shippingFields.phone?.value?.trim() || '',
    address1: shippingFields.address1?.value?.trim() || '',
    address2: shippingFields.address2?.value?.trim() || '',
    city: shippingFields.city?.value?.trim() || '',
    county: shippingFields.county?.value?.trim() || '',
    postcode: shippingFields.postcode?.value?.trim() || '',
    country: shippingFields.country?.value?.trim() || 'GB',
  };

  if (!shippingAddress.name || !shippingAddress.address1 || !shippingAddress.city || !shippingAddress.postcode) {
    setMessage('Please fill in your name, address, city and postcode.');
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
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({
        paymentIntentId: currentOrder?.paymentIntentId,
        ...shippingAddress,
        saveAsDefault: !!saveAddressEl?.checked,
      }),
    });

    if (addrRes.status === 401) {
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
