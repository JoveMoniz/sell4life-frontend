// =====================================================
// Shared line-icon set — replaces emoji across the site with a
// consistent, single-stroke SVG look (same style as the homepage
// category badges in home.js). Default color is brand teal.
// =====================================================
(function () {
  const PATHS = {
    check:    '<path d="M5 13l4 4L19 7"/>',
    close:    '<path d="M6 6l12 12M18 6L6 18"/>',
    warning:  '<path d="M12 3l9 16H3L12 3z"/><path d="M12 10v4M12 17h.01"/>',
    lock:     '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    link:     '<path d="M9 15l6-6"/><path d="M13 5l1.5-1.5a3.5 3.5 0 015 5L18 10"/><path d="M11 19l-1.5 1.5a3.5 3.5 0 01-5-5L6 14"/>',
    tag:      '<path d="M3 11V5a2 2 0 012-2h6l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/>',
    sparkle:  '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>',
    camera:   '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.3"/>',
    video:    '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    truck:    '<rect x="2" y="8" width="12" height="8" rx="1"/><path d="M14 11h4l3 3v2h-7z"/><circle cx="6.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/>',
    award:    '<circle cx="12" cy="8" r="5"/><path d="M9 12.5L7 21l5-3 5 3-2-8.5"/>',
    chat:     '<path d="M4 5h16v11H8l-4 4V5z"/>',
    phone:    '<path d="M5 4h3.5l1.5 4-2 1.5c1 2.2 2.8 4 5 5l1.5-2 4 1.5V17a1.5 1.5 0 01-1.6 1.5A15 15 0 015 5.6 1.5 1.5 0 015 4z"/>',
    wrench:   '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.3 2.3-2-2 2.3-2.3z"/>',
    pencil:   '<path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z"/><path d="M13 7l3.5 3.5"/>',
    trash:    '<path d="M4 7h16"/><path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13"/><path d="M9 7V4h6v3"/>',
    volume:   '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9a4 4 0 010 6"/>',
    download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/>',
    pin:      '<path d="M12 21s-6-5.5-6-10a6 6 0 1112 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
    monitor:  '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
    box:      '<path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M3 8v9l9 4 9-4V8"/><path d="M12 12v9"/>',
    home:     '<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
    sync:     '<path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3"/><path d="M18 3v5h-5M6 21v-5h5"/>',
    bolt:     '<path d="M13 3L4 14h6l-1 7 9-11h-6l1-7z"/>',
    checkbox: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
    money:    '<circle cx="12" cy="12" r="9"/><path d="M9.5 15.5a2.5 2.5 0 003.5.6c1.3-.9 1-2.4-.5-2.9l-1-.3c-1.5-.5-1.8-2-.5-2.9a2.5 2.5 0 013.5.6"/><path d="M12 7.5v1M12 15.5v1"/>',
    chart:    '<path d="M4 19h16"/><path d="M6 16l4-5 3.5 2.5L18 7"/><path d="M14 7h4v4"/>',
    save:     '<path d="M5 4h11l3 3v13H5V4z"/><path d="M8 4v5h7V4"/><path d="M8 14h8v6H8z"/>',
    mail:     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 6.5l9 6 9-6"/>',
    folder:   '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>',
    ban:      '<circle cx="12" cy="12" r="9"/><path d="M6.5 6.5l11 11"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 19M8 16.5L20 5"/>',
    star:     '<path d="M12 4l2.5 5.5L20 10l-4.2 4 1 5.8L12 17l-4.8 2.8 1-5.8L4 10l5.5-.5L12 4z"/>',
  };

  // Returns an inline <svg> string. size in px; color defaults to currentColor
  // so the icon always matches its surrounding text (teal on a teal link,
  // white on a solid-teal button) — pass color explicitly only when the
  // icon sits somewhere with no useful inherited text color.
  window.s4lIcon = function (name, { size = 18, color = 'currentColor', style = '' } = {}) {
    const inner = PATHS[name];
    if (!inner) return '';
    return `<svg class="s4l-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;${style}">${inner}</svg>`;
  };
})();
