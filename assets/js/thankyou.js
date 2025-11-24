document.addEventListener("DOMContentLoaded", () => {

  const itemsWrap = document.getElementById("ty-items");
  const totalEl = document.getElementById("ty-total");

  // This data comes from checkout.js before redirecting
  let lastOrder = JSON.parse(localStorage.getItem("sell4life_last_order")) || null;

  if (!lastOrder) {
    itemsWrap.innerHTML = `<p>No order found.</p>`;
    totalEl.textContent = "£0.00";
    return;
  }

  // Render order items
  let subtotal = 0;
  itemsWrap.innerHTML = lastOrder.items.map(item => {
    const line = item.qty * item.price;
    subtotal += line;

    return `
      <div class="ty-item">
        <span>${item.name} (x${item.qty})</span>
        <span>£${line.toFixed(2)}</span>
      </div>
    `;
  }).join("");

  totalEl.textContent = "£" + subtotal.toFixed(2);

  // Clear it so page cannot be reloaded with old data
  localStorage.removeItem("sell4life_last_order");
});
