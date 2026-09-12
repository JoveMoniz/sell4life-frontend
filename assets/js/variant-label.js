// Single source of truth for formatting an order item's selected variant
// attributes (e.g. { Colour: "Golden Brown", Model: "AirPods3 Generation" })
// into a short readable label — just the values (e.g. "Golden Brown, AirPods3
// Generation"), not the attribute names, to keep it compact on order rows.
window.s4lVariantLabel = function (attributes) {
  if (!attributes || typeof attributes !== 'object') return '';
  return Object.values(attributes)
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .join(', ');
};
