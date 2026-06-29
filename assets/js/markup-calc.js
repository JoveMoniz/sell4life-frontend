// Markup calculator — wires up #ap-markup-calc on any page that has
// #product-cost-price, #product-price, #product-shipping-cost

(function () {
  function init() {
    const costInput     = document.getElementById('product-cost-price');
    const priceInput    = document.getElementById('product-price');
    const shipInput     = document.getElementById('product-shipping-cost');
    const calcWrap      = document.getElementById('ap-markup-calc');
    const markupInput   = document.getElementById('ap-markup-pct');
    const includeShip   = document.getElementById('ap-include-ship');
    const applyBtn      = document.getElementById('ap-apply-markup');
    const preview       = document.getElementById('ap-calc-preview');

    if (!costInput || !calcWrap) return;

    function getCalcPrice() {
      const cost   = parseFloat(costInput.value)  || 0;
      const ship   = (includeShip?.checked ? parseFloat(shipInput?.value) || 0 : 0);
      const markup = parseFloat(markupInput?.value) || 0;
      if (cost <= 0) return null;
      return ((cost + ship) * (1 + markup / 100));
    }

    function updateVisibility() {
      const cost = parseFloat(costInput.value) || 0;
      calcWrap.style.display = cost > 0 ? 'flex' : 'none';
      updatePreview();
    }

    function updatePreview() {
      if (!preview) return;
      const p = getCalcPrice();
      preview.textContent = p != null ? `→ £${p.toFixed(2)}` : '';
    }

    costInput.addEventListener('input', updateVisibility);
    shipInput?.addEventListener('input', updatePreview);
    markupInput?.addEventListener('input', updatePreview);
    includeShip?.addEventListener('change', updatePreview);

    applyBtn?.addEventListener('click', () => {
      const p = getCalcPrice();
      if (p == null) return;
      priceInput.value = p.toFixed(2);
      priceInput.dispatchEvent(new Event('input'));
      preview.textContent = `Applied £${p.toFixed(2)}`;
      preview.style.color = '#15803d';
      setTimeout(() => { preview.style.color = '#6b7280'; updatePreview(); }, 2000);
    });

    // Init visibility — also re-check after async data loads on edit page
    updateVisibility();
    setTimeout(updateVisibility, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
