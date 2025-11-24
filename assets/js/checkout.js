// checkout.js

document.addEventListener("DOMContentLoaded", () => {
  
  const itemsWrap = document.getElementById("checkout-items");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const totalEl = document.getElementById("checkout-total");
  const orderBtn = document.getElementById("place-order-btn");

  // Load cart from localStorage
  let cart = JSON.parse(localStorage.getItem("sell4life_cart")) || [];

  function formatPrice(num) {
    return "£" + Number(num).toFixed(2);
  }

  function renderItems() {
    if (!cart.length) {
      itemsWrap.innerHTML = `<p>Your cart is empty.</p>`;
      subtotalEl.textContent = "£0.00";
      totalEl.textContent = "£0.00";
      return;
    }

    let subtotal = 0;

    itemsWrap.innerHTML = cart.map(item => {
      const line = item.price * item.qty;
      subtotal += line;

      return `
        <div class="checkout-item">
          <span>${item.name} (x${item.qty})</span>
          <span>${formatPrice(line)}</span>
        </div>
      `;
    }).join("");

    subtotalEl.textContent = formatPrice(subtotal);
    totalEl.textContent = formatPrice(subtotal); // No shipping yet
  }

  renderItems();

  // Order button
  orderBtn.addEventListener("click", () => {
    if (!cart.length) {
      alert("Your cart is empty.");
      return;
    }

    alert("Order placed successfully! (Fake checkout for now)");
    
   // save last order for thankyou page
localStorage.setItem("sell4life_last_order", JSON.stringify({
  items: cart
}));

// Clear cart
localStorage.removeItem("sell4life_cart");

// Redirect to thank you page
window.location.href = "/checkout/thankyou.html";

  });

});


// Read cart safely
function readCart() {
  try {
    const arr = JSON.parse(localStorage.getItem("cart") || "[]");
    return Array.isArray(arr) ? arr.filter(x => x && x.id) : [];
  } catch {
    return [];
  }
}

// Render checkout totals
function renderCheckoutTotals() {
  const cart = readCart();
  const subtotalEl = document.getElementById("checkout-subtotal");
  const shippingEl = document.getElementById("checkout-shipping");
  const totalEl = document.getElementById("checkout-total");

  if (!cart.length) {
    subtotalEl.textContent = "£0.00";
    shippingEl.textContent = "£0.00";
    totalEl.textContent = "£0.00";
    return;
  }

  let subtotal = 0;
  cart.forEach(item => {
    subtotal += Number(item.price) * Number(item.quantity);
  });

  const shipping = 0; // for now

  subtotalEl.textContent = "£" + subtotal.toFixed(2);
  shippingEl.textContent = "£" + shipping.toFixed(2);
  totalEl.textContent = "£" + (subtotal + shipping).toFixed(2);
}

document.addEventListener("DOMContentLoaded", renderCheckoutTotals);
