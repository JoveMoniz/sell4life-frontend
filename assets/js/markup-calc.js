// Markup calculator — wires up #ap-markup-calc on any page that has
// #product-cost-price, #product-price, #product-shipping-cost
//
// Whether shipping is "included" (baked into the retail price, so checkout
// is free) or charged separately is driven entirely by the same "Charge for
// shipping" control used elsewhere on the page — see product-shipping-mode's
// value ('charge' = charged separately to the buyer, anything else =
// included/free). There used to be a second, independent checkbox here
// (#ap-include-ship) that could silently disagree with "Charge for
// shipping" — the two were saved to different fields with no reconciliation,
// so a product could show "Charge for shipping" on but still charge the
// buyer £0 at checkout. Removed; this file now just reflects the one real
// setting instead of tracking its own copy of it.
//
// The shipping cost field itself always stays visible now (used as the
// markup calculation base regardless of whether it's actually charged).

(function () {
  function init() {
    const costInput   = document.getElementById('product-cost-price');
    const priceInput  = document.getElementById('product-price');
    const shipInput   = document.getElementById('product-shipping-cost');
    const calcWrap    = document.getElementById('ap-markup-calc');
    const markupInput = document.getElementById('ap-markup-pct');
    const shipModeEl  = document.getElementById('product-shipping-mode');
    const applyBtn    = document.getElementById('ap-apply-markup');
    const preview     = document.getElementById('ap-calc-preview');

    if (!costInput || !calcWrap) return;

    const _pid   = new URLSearchParams(window.location.search).get('id');
    const _lsKey = _pid ? `s4l_mc_${_pid}` : null;

    let _userEditedMarkup = false;

    function shippingIncluded() {
      return (shipModeEl?.value || 'free') !== 'charge';
    }

    function getShip() {
      return shippingIncluded() ? (parseFloat(shipInput?.value) || 0) : 0;
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
      if (shippingIncluded()) {
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

      if (base > 0 && (!shippingIncluded() || ship > 0)) {
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

    // Direct price edits should feed back into markup — un-derive it and
    // recompute from the price the vendor just typed, so either field can
    // drive the other depending on which one was edited most recently.
    priceInput?.addEventListener('input', () => {
      _userEditedMarkup = false;
      deriveMarkup();
      updatePreview();
    });

    // "Charge for shipping" changing (either the checkbox, on
    // professional/enterprise, or the Free/Charge/Collection button grid,
    // on casual/refurbished) changes shippingIncluded()'s answer. Deferred
    // with setTimeout so this always runs after the page's own click/change
    // handler has updated product-shipping-mode's value first, regardless
    // of which script's listener was attached first.
    const refreshAfterModeChange = () => setTimeout(() => {
      syncShipNote();
      saveStored();
      updatePreview();
    }, 0);
    document.getElementById('product-ship-charge-toggle')?.addEventListener('change', refreshAfterModeChange);
    document.getElementById('ap-ship-grid')?.addEventListener('click', (e) => {
      if (e.target.closest('.ap-ship-btn')) refreshAfterModeChange();
    });

    applyBtn?.addEventListener('click', () => {
      const p = getCalcPrice();
      if (p == null) return;

      // Scale variant prices by the ratio between the new calculated price and
      // the variants' own current minimum — NOT the Price field's displayed
      // value. The Price field can already be out of sync with the variants
      // (e.g. right after a CJ sync updated variants directly, or after any
      // save that didn't touch pricing), and anchoring the scale to a stale
      // field produces a cascading wrong number for every variant. Variants
      // are the source of truth for "the" base price everywhere else in this
      // codebase (see deriveBasePriceFromVariants on the backend) — matching
      // that convention here keeps the scale meaningful regardless of what
      // the Price field currently shows.
      const variantPriceInputs = document.querySelectorAll('[name="vr-price"]');
      const variantPrices = Array.from(variantPriceInputs)
        .map((input) => parseFloat(input.value) || 0)
        .filter((v) => v > 0);
      const oldBase = variantPrices.length ? Math.min(...variantPrices) : (parseFloat(priceInput.value) || 0);
      const scale = oldBase > 0 ? p / oldBase : null;

      priceInput.value = p.toFixed(2);
      priceInput.dispatchEvent(new Event('input'));

      variantPriceInputs.forEach((input) => {
        const oldVariantPrice = parseFloat(input.value) || 0;
        const newVariantPrice = (scale != null && oldVariantPrice > 0) ? oldVariantPrice * scale : p;
        input.value = newVariantPrice.toFixed(2);
        input.dispatchEvent(new Event('input'));
      });

      saveStored();
      const variantNote = variantPriceInputs.length
        ? ` (+ ${variantPriceInputs.length} variant${variantPriceInputs.length === 1 ? '' : 's'})`
        : '';
      preview.textContent = `Applied £${p.toFixed(2)}${variantNote}`;
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
