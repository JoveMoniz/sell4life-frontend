// Single source of truth for formatting an order item's selected variant
// attributes (e.g. { Colour: "Golden Brown", Model: "AirPods3 Generation" })
// into a short readable label — just the values (e.g. "Golden Brown, AirPods3
// Generation"), not the attribute names, to keep it compact on order rows.
// Every known caller interpolates this straight into innerHTML, so the
// result is HTML-escaped here (vendor-set variant values, e.g. a crafted
// "Colour" option, would otherwise execute in a buyer's/vendor's browser).
window.s4lVariantLabel = function (attributes) {
  if (!attributes || typeof attributes !== 'object') return '';
  const label = Object.values(attributes)
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .join(', ');
  return escHtml(label);
};
