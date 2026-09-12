// Single source of truth for the free/paid/collection shipping label text,
// shared by every page that renders a product card (shop, store, etc).
window.s4lShippingText = function (shippingCost, collectionOnly) {
  if (collectionOnly) return 'Collection only';
  var cost = Number(shippingCost || 0);
  return cost === 0 ? 'Free shipping' : '+ £' + cost.toFixed(2) + ' shipping';
};