// =======================================================
// SELL4LIFE – THANK YOU PAGE (FINAL STABLE VERSION)
// Stripe → Webhook → Order → Render → Cleanup
// =======================================================

// =======================================================
// IMMEDIATE CART CLEAR
// Runs synchronously before cart.js loads, so cart.js
// reads an empty cart from localStorage from the start.
// =======================================================

(function () {
  if (!new URLSearchParams(location.search).get('payment_intent')) return;

  try {
    const planRaw = localStorage.getItem('checkout_cleanup_plan');
    const plan = planRaw ? JSON.parse(planRaw) : null;

    if (plan && plan.buyNow) {
      const backup = localStorage.getItem('cart_backup');
      if (backup) localStorage.setItem('cart', backup);
      else localStorage.removeItem('cart');
      localStorage.removeItem('cart_backup');
      localStorage.removeItem('buyNow');
    } else {
      localStorage.removeItem('cart');
    }
  } catch {
    localStorage.removeItem('cart');
  }

  localStorage.removeItem('checkout_cleanup_plan');
})();

// =======================================================
// BACK-FORWARD CACHE PROTECTION
// =======================================================

(function () {
  window.addEventListener('pageshow', function (event) {
    const done = localStorage.getItem('checkout_completed') === 'true';

    if (event.persisted && done) {
      window.location.replace('/index.html');
    }
  });
})();

// =======================================================
// MAIN
// =======================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔥 Thankyou started');

  const API = window.API_BASE;

  const params = new URLSearchParams(window.location.search);
  const paymentIntentId = params.get('payment_intent');

  // 🔥 STORE PAYMENT INTENT FOR GLOBAL CLEANUP
  localStorage.setItem('last_payment_intent', paymentIntentId);
  localStorage.removeItem('checkout_completed');

  const idEl = document.getElementById('order-id');
  const dateEl = document.getElementById('order-date');
  const itemsEl = document.getElementById('order-items');
  const totalEl = document.getElementById('order-total');
  const statusMsg = document.getElementById('payment-status-message');
  const loadingEl = document.getElementById('ty-loading');
  const cardEl = document.getElementById('thankyou-card');

  function showCard() {
    if (loadingEl) loadingEl.style.display = 'none';
    if (cardEl) {
      cardEl.style.display = 'block';
      // next frame so display:block is painted before opacity transition starts
      requestAnimationFrame(() => cardEl.classList.add('ty-ready'));
    }
  }

  // =====================================================
  // VALIDATION
  // =====================================================
  if (!paymentIntentId || paymentIntentId.length < 10) {
    console.warn('Invalid payment_intent');
    if (itemsEl) itemsEl.innerHTML = '<p>Payment not found.</p>';
    showCard();
    return;
  }

  // =====================================================
  // AUTH
  // =====================================================

  const token = localStorage.getItem('s4l_token');

  if (!token) {
    window.location.href = '/account/signin.html';
    return;
  }

  // Card stays hidden — spinner is visible via #ty-loading until data arrives

  // =====================================================
  // WAIT FOR WEBHOOK
  // =====================================================

  async function waitForPaid() {
    const maxMs = 90000;
    const stepMs = 1500;
    const started = Date.now();

    while (Date.now() - started < maxMs) {
      try {
        const res = await fetch(`${API}/orders/by-payment/${paymentIntentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const order = await res.json();

          console.log('🔄 Status:', order.paymentStatus);

          if (order && order.paymentStatus === 'paid') {
            return order;
          }
        } else if (res.status !== 404) {
          console.warn('Unexpected status:', res.status);
        }
      } catch (err) {
        console.warn('Retry…', err);
      }

      await new Promise((r) => setTimeout(r, stepMs));
    }

    return null;
  }

  // =====================================================
  // CLEAN CART (ONLY AFTER PAID)
  // =====================================================

  function cleanupCart(order) {
    if (!order || order.paymentStatus !== 'paid') return;
    // Cart was already cleared synchronously at page load.
    // Just mark complete and update the badge.
    localStorage.setItem('checkout_completed', 'true');
    document.dispatchEvent(new Event('cartUpdated'));
  }

  // =====================================================
  // RENDER ORDER (SAFE ZONE)
  // =====================================================

  function renderOrder(order) {
    if (!order) return;

    const displayId = order.shortId || order.id || '—';

    if (idEl) idEl.textContent = displayId;

    if (dateEl) {
      dateEl.textContent = order.createdAt ? new Date(order.createdAt).toLocaleString() : '-';
    }

    if (itemsEl) {
      itemsEl.innerHTML = (order.items || [])
        .map((item) => {
          const qty = Number(item.quantity || 1);
          const price = Number(item.price || 0);
          const total = qty * price;

          return `
            <div class="ty-item">
              <div class="ty-item-left">
                <div class="ty-name-wrap"><span>${item.name}</span></div>
                <span class="ty-item-qty">×${qty}</span>
              </div>
              <span class="ty-item-subtotal">
                £${total.toFixed(2)}
              </span>
            </div>
          `;
        })
        .join('');
    }

    if (totalEl) {
      totalEl.textContent = `£${Number(order.total || 0).toFixed(2)}`;
    }

    // =====================================================
    // ✅ SAFE STATUS UPDATE (THIS WAS MISSING)
    // =====================================================

    if (statusMsg) {
      if (order.paymentStatus === 'paid') {
        statusMsg.textContent = 'Payment successful. Thank you!';
      } else {
        statusMsg.textContent = 'Processing your payment...';
      }
    }
  }

  // =====================================================
  // FETCH + WAIT FLOW
  // =====================================================

  try {
    let order = null;

    // fast attempt
    try {
      const res = await fetch(`${API}/orders/by-payment/${paymentIntentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        order = await res.json();
      }
    } catch (err) {
      console.warn('Initial fetch failed');
    }

    // 🔥 THIS IS THE FIX
    if (!order || order.paymentStatus !== 'paid') {
      order = await waitForPaid();
    }

    // still nothing after polling
    if (!order) {
      console.warn('⏳ Order not ready yet');
      if (itemsEl) itemsEl.innerHTML = '<p>Payment received. Your order will appear in My Orders shortly.</p>';
      localStorage.setItem('checkout_completed', 'true');
      showCard();
      return;
    }

    // ✅ render everything, then reveal card all at once
    renderOrder(order);
    cleanupCart(order);
    showCard();
    initTrackPanel(token, API);

    console.log('✅ Thankyou complete');
  } catch (err) {
    console.error('Thankyou error:', err);
    if (itemsEl) itemsEl.innerHTML = '<p>Something went wrong. Please check your orders.</p>';
    showCard();
  }
});

// =======================================================
// TRACK-YOUR-ORDER PANEL — only shown to a guest-checkout buyer
// (passwordSet:false) who hasn't claimed their account yet. Setting a
// password here uses the CURRENT session token, already logged in from
// checkout — no email round-trip needed at this moment.
// =======================================================
async function initTrackPanel(token, API) {
  const panel = document.getElementById('ty-track-panel');
  const input = document.getElementById('ty-track-password');
  const submitBtn = document.getElementById('ty-track-submit');
  const msg = document.getElementById('ty-track-message');
  if (!panel || !token) return;

  try {
    const res = await fetch(`${API}/account/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.passwordSet) return; // already a real/claimed account — nothing to prompt

    panel.hidden = false;
  } catch (err) {
    console.warn('Track panel check failed:', err);
    return;
  }

  submitBtn?.addEventListener('click', async () => {
    const password = input?.value || '';
    if (password.length < 8) {
      msg.textContent = 'Password must be at least 8 characters.';
      msg.className = 'ty-track-message ty-track-error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const res = await fetch(`${API}/account/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        msg.textContent = data.error || 'Could not set password.';
        msg.className = 'ty-track-message ty-track-error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Set Password & Track Order';
        return;
      }

      msg.textContent = 'Password set — you can track this order any time from My Orders.';
      msg.className = 'ty-track-message ty-track-success';
      if (input) input.hidden = true;
      submitBtn.hidden = true;
    } catch (err) {
      console.error('Set-password error:', err);
      msg.textContent = 'Something went wrong. Please try again.';
      msg.className = 'ty-track-message ty-track-error';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Set Password & Track Order';
    }
  });
}
