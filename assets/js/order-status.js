// =====================================================
// Shared order/item status badge rendering — buyer, vendor,
// admin all call into this so "Delivered" is always the same
// shade of green wherever it's shown. Class name is prefixed
// s4l- to avoid colliding with admin.css's unrelated vendor
// account-approval classes (.status-pending/.status-approved/
// .status-suspended already mean something else there).
// =====================================================
(function () {
  const FULFILLMENT_STATUS = {
    'Pending':             { label: 'Pending',             color: '#92400e', bg: '#fef3c7' },
    'Processing':          { label: 'Processing',          color: '#1d4ed8', bg: '#dbeafe' },
    'Shipped':             { label: 'Shipped',             color: '#6d28d9', bg: '#ede9fe' },
    'Delivered':           { label: 'Delivered',           color: '#15803d', bg: '#dcfce7' },
    'Partially Delivered': { label: 'Partially Delivered', color: '#0e7490', bg: '#cffafe' },
    'Cancel Requested':    { label: 'Cancel Requested',    color: '#c2410c', bg: '#ffedd5' },
    'Cancel Approved':     { label: 'Cancelled',           color: '#b91c1c', bg: '#fee2e2' },
    'Cancel Rejected':     { label: 'Cancel Rejected',     color: '#475569', bg: '#f1f5f9' },
    'Cancelled':           { label: 'Cancelled',           color: '#b91c1c', bg: '#fee2e2' },
  };

  const RETURN_STATUS = {
    requested:          { label: 'Return Requested',   color: '#92400e', bg: '#fef3c7' },
    approved:           { label: 'Return Approved',    color: '#1d4ed8', bg: '#dbeafe' },
    rejected:           { label: 'Return Rejected',    color: '#b91c1c', bg: '#fee2e2' },
    partially_returned: { label: 'Partially Returned', color: '#c2410c', bg: '#ffedd5' },
    returned:           { label: 'Returned',           color: '#15803d', bg: '#dcfce7' },
  };

  const REFUND_STATUS = {
    scheduled:          { label: 'Refund Scheduled',   color: '#1d4ed8', bg: '#dbeafe' },
    processing:         { label: 'Refund Processing',  color: '#6d28d9', bg: '#ede9fe' },
    processed:          { label: 'Refunded <svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg>',    color: '#15803d', bg: '#dcfce7' },
    partially_refunded: { label: 'Partially Refunded', color: '#c2410c', bg: '#ffedd5' },
    failed:             { label: 'Refund Failed',      color: '#b91c1c', bg: '#fee2e2' },
  };

  function badgeHTML(entry, fallbackLabel) {
    if (!entry) {
      return fallbackLabel
        ? `<span class="s4l-status-badge" style="color:#374151;background:#f3f4f6">${fallbackLabel}</span>`
        : '';
    }
    return `<span class="s4l-status-badge" style="color:${entry.color};background:${entry.bg}">${entry.label}</span>`;
  }

  window.s4lStatusBadge = function (status) {
    return badgeHTML(FULFILLMENT_STATUS[status], status);
  };
  window.s4lReturnBadge = function (status) {
    return badgeHTML(RETURN_STATUS[status]);
  };
  window.s4lRefundBadge = function (status) {
    return badgeHTML(REFUND_STATUS[status]);
  };
})();
