// Markup calculator — wires up #ap-markup-calc on any page that has
// #product-cost-price, #product-price, #product-shipping-cost
//
// "+ shipping" checkbox:
//   CHECKED  → shipping baked into retail price. Calculation base = cost + shipping field.
//              The shipping field remains EDITABLE so the vendor can always see/enter the cost.
//              Save sends shippingCost: 0 (checkout free) regardless of what the field shows.
//   UNCHECKED → buyer pays shipping separately. Calculation base = cost only.
//              Save sends shippingCost from the field value.

(function () {
  function init() {
    const costInput   = document.getElementById('product-cost-price');
    const priceInput  = document.getElementById('product-price');
    const shipInput   = document.getElementById('product-shipping-cost');
    const calcWrap    = document.getElementById('ap-markup-calc');
    const markupInput = document.getElementById('ap-markup-pct');
    const includeShip = document.getElementById('ap-include-ship');
    const applyBtn    = document.getElementById('ap-apply-markup');
    const preview     = document.getElementById('ap-calc-preview');

    if (!costInput || !calcWrap) return;

    const _pid   = new URLSearchParams(window.location.search).get('id');
    const _lsKey = _pid ? `s4l_mc_${_pid}` : null;

    let _userEditedMarkup = false;

    function getShip() {
      return includeShip?.checked ? (parseFloat(shipInput?.value) || 0) : 0;
    }

    function loadStored() {
      if (!_lsKey) return null;
      try { return JSON.parse(localStorage.getItem(_lsKey)) || null; } catch { return null; }
    }

    function saveStored() {
      if (!_lsKey) return;
      const ship = parseFloat(shipInput?.value) || 0;
      const mu   = parseFloat(markupInput?.value) || 0;
      // Only persist when we have a real markup value — avoids clobbering with 0 on bootstrap
      if (mu > 0 || _userEditedMarkup) {
        localStorage.setItem(_lsKey, JSON.stringify({ costShip: ship, markup: mu }));
      }
    }

    function getCalcPrice() {
      const cost   = parseFloat(costInput.value) || 0;
      const ship   = getShip();
      const markup = parseFloat(markupInput?.value) || 0;
      if (cost <= 0) return null;
      return (cost + ship) * (1 + markup / 100);
    }

    function syncShipNote() {
      let note = document.getElementById('_ship-incl-note');
      if (includeShip?.checked) {
        if (!note) {
          note = document.createElement('span');
          note.id = '_ship-incl-note';
          note.style.cssText = 'display:block;font-size:0.73rem;color:#6b7280;margin-top:4px';
          shipInput?.insertAdjacentElement('afterend', note);
        }
        const ship = parseFloat(shipInput?.value) || 0;
        note.textContent = ship > 0
          ? `£${ship.toFixed(2)} shipping included in retail price · checkout shipping: £0`
          : 'Enter your supplier shipping cost above · checkout shipping: £0';
      } else {
        note?.remove();
      }
    }

    function deriveMarkup() {
      if (_userEditedMarkup) return;
      const price = parseFloat(priceInput?.value) || 0;
      const cost  = parseFloat(costInput.value)   || 0;
      if (cost <= 0 || price <= 0) return;

      const ship = getShip();
      const base = cost + ship;

      if (base > 0 && (!includeShip?.checked || ship > 0)) {
        const derived = Math.round((price / base - 1) * 1000) / 10;
        if (derived >= 0 && markupInput) {
          markupInput.value = derived;
          saveStored();
          return;
        }
      }

      // Can't derive — restore markup from localStorage
      const stored = loadStored();
      if (stored?.markup != null && markupInput) {
        markupInput.value = stored.markup;
        if (stored.costShip > 0 && (!shipInput?.value || parseFloat(shipInput.value) === 0)) {
          if (shipInput) { shipInput.value = stored.costShip.toFixed(2); syncShipNote(); }
        }
      }
    }

    function updatePreview() {
      if (!preview) return;
      const p = getCalcPrice();
      preview.textContent = p != null ? `→ £${p.toFixed(2)}` : '';
    }

    function updateVisibility() {
      const cost = parseFloat(costInput.value) || 0;
      calcWrap.style.display = cost > 0 ? 'flex' : 'none';
      if (cost > 0) { deriveMarkup(); updatePreview(); }
    }

    costInput.addEventListener('input', updateVisibility);

    shipInput?.addEventListener('input', () => {
      syncShipNote();
      saveStored();
      updatePreview();
    });

    markupInput?.addEventListener('input', () => {
      _userEditedMarkup = true;
      saveStored();
      updatePreview();
    });

    includeShip?.addEventListener('change', () => {
      syncShipNote();
      saveStored();
      updatePreview();
    });

    applyBtn?.addEventListener('click', () => {
      const p = getCalcPrice();
      if (p == null) return;
      priceInput.value = p.toFixed(2);
      priceInput.dispatchEvent(new Event('input'));
      saveStored();
      preview.textContent = `Applied £${p.toFixed(2)}`;
      preview.style.color = '#15803d';
      setTimeout(() => { preview.style.color = '#6b7280'; updatePreview(); }, 2000);
    });

    function fullInit() {
      syncShipNote();
      updateVisibility();
    }

    fullInit();
    setTimeout(fullInit, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
