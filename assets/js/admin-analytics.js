// ======================================================
// ADMIN TRAFFIC & ANALYTICS
// ======================================================

const API = window.API_BASE;
let currentPeriod = 'week';
let realtimeTimer = null;

// Palette — validated categorical set (dataviz skill), fixed role→color
// mapping so identity never shifts with rank.
const COLORS = {
  visits: '#2a78d6',
  pageViews: '#1baf7a',
  direct: '#2a78d6',
  search: '#eb6834',
  social: '#1baf7a',
  referral: '#eda100',
  email: '#e87ba4',
  paid: '#008300',
};
const SOURCE_LABELS = {
  direct: 'Direct', search: 'Search', social: 'Social', referral: 'Referral', email: 'Email', paid: 'Paid',
};

function authFetch(url, opts = {}) {
  const token = localStorage.getItem('s4l_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, credentials: 'include', headers });
}

async function apiGet(path, period, extraParams) {
  const params = new URLSearchParams(extraParams || {});
  if (period && period !== 'all') params.set('period', period);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await authFetch(`${API}/admin/analytics${path}${qs}`);
  if (res.status === 401 || res.status === 403) {
    localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
    window.location.href = '/account/admin/signin.html';
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function fmtDuration(sec) {
  sec = Number(sec) || 0;
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

/* ======================================================
   SUMMARY CARDS
====================================================== */
function renderCards(s) {
  const el = document.getElementById('an-cards');
  if (!el) return;
  el.innerHTML = `
    <div class="an-card">
      <div class="an-card-label">Total Visits</div>
      <div class="an-card-value">${s.totalVisits.toLocaleString()}</div>
    </div>
    <div class="an-card">
      <div class="an-card-label">Unique Visitors</div>
      <div class="an-card-value">${s.uniqueVisitors.toLocaleString()}</div>
    </div>
    <div class="an-card">
      <div class="an-card-label">Page Views</div>
      <div class="an-card-value">${s.pageViews.toLocaleString()}</div>
    </div>
    <div class="an-card">
      <div class="an-card-label">Avg. Session Duration</div>
      <div class="an-card-value">${fmtDuration(s.avgSessionDurationSec)}</div>
    </div>
    <div class="an-card">
      <div class="an-card-label">Bounce Rate</div>
      <div class="an-card-value">${s.bounceRate}%</div>
    </div>
    <div class="an-card">
      <div class="an-card-label">New Visitors</div>
      <div class="an-card-value">${s.newVisitorPct}%</div>
      <div class="an-card-sub">${(100 - s.newVisitorPct).toFixed(1)}% returning</div>
    </div>
    <div class="an-card">
      <div class="an-card-label">Orders</div>
      <div class="an-card-value">${(s.orders || 0).toLocaleString()}</div>
    </div>
    <div class="an-card">
      <div class="an-card-label">Revenue</div>
      <div class="an-card-value">£${(s.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>
    <div class="an-card">
      <div class="an-card-label">Conversion Rate</div>
      <div class="an-card-value">${s.conversionRate || 0}%</div>
      <div class="an-card-sub">visits → orders</div>
    </div>
  `;
}

/* ======================================================
   TIME-SERIES LINE CHART (visits + page views, SVG)
   Thin 2px lines, recessive gridlines, crosshair + tooltip.
====================================================== */
function renderTimeseries(rows) {
  const svg = document.getElementById('an-timeseries-svg');
  const wrap = svg?.closest('.an-chart-wrap');
  if (!svg || !wrap) return;

  // Clear previous render (including any tooltip left behind)
  svg.innerHTML = '';
  wrap.querySelectorAll('.an-tooltip').forEach((t) => t.remove());

  if (!rows.length) {
    svg.innerHTML = `<text x="500" y="110" text-anchor="middle" fill="#9ca3af" font-size="13">No data for this period</text>`;
    return;
  }

  const W = 1000, H = 220, padL = 44, padR = 12, padT = 12, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVisits = Math.max(1, ...rows.map((r) => Math.max(r.visits, r.pageViews)));
  const xStep = rows.length > 1 ? plotW / (rows.length - 1) : 0;
  const xOf = (i) => padL + i * xStep;
  const yOf = (v) => padT + plotH - (v / maxVisits) * plotH;

  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');

  // Gridlines (recessive, hairline) — 4 horizontal steps
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH / 4) * i;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', padL); line.setAttribute('x2', W - padR);
    line.setAttribute('y1', y); line.setAttribute('y2', y);
    line.setAttribute('stroke', '#e1e0d9'); line.setAttribute('stroke-width', '1');
    g.appendChild(line);

    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', padL - 8); label.setAttribute('y', y + 4);
    label.setAttribute('text-anchor', 'end'); label.setAttribute('font-size', '10');
    label.setAttribute('fill', '#898781');
    label.textContent = Math.round(maxVisits * (1 - i / 4));
    g.appendChild(label);
  }

  // X-axis date labels — thin out if too many points
  const labelEvery = Math.max(1, Math.ceil(rows.length / 8));
  rows.forEach((r, i) => {
    if (i % labelEvery !== 0 && i !== rows.length - 1) return;
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', xOf(i)); label.setAttribute('y', H - 8);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('font-size', '10');
    label.setAttribute('fill', '#898781');
    label.textContent = r.bucket.length > 10 ? r.bucket.slice(5) : r.bucket.slice(11, 16);
    g.appendChild(label);
  });

  function pathFor(key) {
    return rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(r[key])}`).join(' ');
  }

  [{ key: 'pageViews', color: COLORS.pageViews }, { key: 'visits', color: COLORS.visits }].forEach(({ key, color }) => {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathFor(key));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    g.appendChild(path);
  });

  svg.appendChild(g);

  // Crosshair + tooltip
  const crosshair = document.createElementNS(ns, 'line');
  crosshair.setAttribute('y1', padT); crosshair.setAttribute('y2', H - padB);
  crosshair.setAttribute('stroke', '#c3c2b7'); crosshair.setAttribute('stroke-width', '1');
  crosshair.setAttribute('visibility', 'hidden');
  svg.appendChild(crosshair);

  const tooltip = document.createElement('div');
  tooltip.className = 'an-tooltip';
  tooltip.style.cssText = 'position:absolute;pointer-events:none;background:#0b0b0b;color:#fff;font-size:12px;padding:6px 10px;border-radius:6px;line-height:1.5;display:none;z-index:5;white-space:nowrap;';
  wrap.style.position = 'relative';
  wrap.appendChild(tooltip);

  const hitLayer = document.createElementNS(ns, 'rect');
  hitLayer.setAttribute('x', padL); hitLayer.setAttribute('y', padT);
  hitLayer.setAttribute('width', plotW); hitLayer.setAttribute('height', plotH);
  hitLayer.setAttribute('fill', 'transparent');
  svg.appendChild(hitLayer);

  function showAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    let idx = Math.round((relX - padL) / (xStep || 1));
    idx = Math.max(0, Math.min(rows.length - 1, idx));
    const r = rows[idx];

    crosshair.setAttribute('x1', xOf(idx)); crosshair.setAttribute('x2', xOf(idx));
    crosshair.setAttribute('visibility', 'visible');

    tooltip.style.display = 'block';
    tooltip.innerHTML =
      `<div style="opacity:.7">${esc(r.bucket)}</div>` +
      `<div><strong>${r.visits}</strong> visits</div>` +
      `<div><strong>${r.pageViews}</strong> page views</div>`;
    const px = (xOf(idx) / W) * rect.width;
    tooltip.style.left = `${Math.min(rect.width - 140, Math.max(0, px + 10))}px`;
    tooltip.style.top = '4px';
  }

  hitLayer.addEventListener('pointermove', (e) => showAt(e.clientX));
  hitLayer.addEventListener('pointerleave', () => {
    crosshair.setAttribute('visibility', 'hidden');
    tooltip.style.display = 'none';
  });
}

/* ======================================================
   TOP PAGES
====================================================== */
function renderTopPages(rows) {
  const el = document.getElementById('an-top-pages');
  if (!el) return;
  if (!rows.length) { el.innerHTML = `<tr><td colspan="3" class="an-empty">No page views yet</td></tr>`; return; }
  el.innerHTML = rows.map((r) => `
    <tr>
      <td>${esc(r.path) || '<em>(unknown)</em>'}</td>
      <td class="an-num">${r.views.toLocaleString()}</td>
      <td class="an-num">${r.avgTimeOnPageSec != null ? fmtDuration(r.avgTimeOnPageSec) : '—'}</td>
    </tr>`).join('');
}

/* ======================================================
   TOP PRODUCTS — most-viewed, from product_view events
====================================================== */
function renderTopProducts(rows) {
  const el = document.getElementById('an-top-products');
  if (!el) return;
  if (!rows.length) { el.innerHTML = `<tr><td colspan="3" class="an-empty">No product views yet</td></tr>`; return; }
  el.innerHTML = rows.map((r) => `
    <tr>
      <td>${esc(r.name)}</td>
      <td class="an-num">${r.price != null ? `£${r.price.toFixed(2)}` : '—'}</td>
      <td class="an-num">${r.views.toLocaleString()}</td>
    </tr>`).join('');
}

/* ======================================================
   TOP SEARCHES
====================================================== */
function renderSearches(rows) {
  const el = document.getElementById('an-searches');
  if (!el) return;
  if (!rows.length) { el.innerHTML = `<tr><td colspan="2" class="an-empty">No searches yet</td></tr>`; return; }
  el.innerHTML = rows.map((r) => `<tr><td>${esc(r.query)}</td><td class="an-num">${r.count.toLocaleString()}</td></tr>`).join('');
}

/* ======================================================
   TRAFFIC SOURCES — horizontal bar chart + tables
====================================================== */
function renderSources(data) {
  const svg = document.getElementById('an-sources-svg');
  const legendEl = document.getElementById('an-sources-legend');
  const referrersEl = document.getElementById('an-referrers');
  const campaignsEl = document.getElementById('an-campaigns');

  const breakdown = data.breakdown || [];
  const total = breakdown.reduce((s, r) => s + r.visits, 0);

  if (svg) {
    svg.innerHTML = '';
    if (!total) {
      svg.innerHTML = `<text x="500" y="70" text-anchor="middle" fill="#9ca3af" font-size="13">No data for this period</text>`;
    } else {
      const ns = 'http://www.w3.org/2000/svg';
      const W = 1000, rowH = 26, gap = 8;
      breakdown.forEach((r, i) => {
        const y = i * (rowH + gap) + 4;
        const barMaxW = 780;
        const w = Math.max(3, (r.visits / total) * barMaxW);

        const label = document.createElementNS(ns, 'text');
        label.setAttribute('x', 0); label.setAttribute('y', y + rowH / 2 + 4);
        label.setAttribute('font-size', '12'); label.setAttribute('fill', '#0b0b0b');
        label.textContent = SOURCE_LABELS[r.source] || r.source;
        svg.appendChild(label);

        const track = document.createElementNS(ns, 'rect');
        track.setAttribute('x', 130); track.setAttribute('y', y);
        track.setAttribute('width', barMaxW); track.setAttribute('height', rowH);
        track.setAttribute('rx', 4); track.setAttribute('fill', '#f3f4f6');
        svg.appendChild(track);

        const bar = document.createElementNS(ns, 'rect');
        bar.setAttribute('x', 130); bar.setAttribute('y', y);
        bar.setAttribute('width', w); bar.setAttribute('height', rowH);
        bar.setAttribute('rx', 4); bar.setAttribute('fill', COLORS[r.source] || '#898781');
        svg.appendChild(bar);

        const valueLabel = document.createElementNS(ns, 'text');
        valueLabel.setAttribute('x', 130 + barMaxW + 10); valueLabel.setAttribute('y', y + rowH / 2 + 4);
        valueLabel.setAttribute('font-size', '12'); valueLabel.setAttribute('fill', '#52514e');
        valueLabel.textContent = `${r.visits.toLocaleString()} (${Math.round((r.visits / total) * 100)}%)`;
        svg.appendChild(valueLabel);
      });
      svg.setAttribute('viewBox', `0 0 1000 ${breakdown.length * (rowH + gap) + 10}`);
    }
  }

  if (legendEl) {
    legendEl.innerHTML = breakdown.map((r) => `
      <span class="an-legend-item">
        <span class="an-legend-swatch" style="background:${COLORS[r.source] || '#898781'}"></span>
        ${esc(SOURCE_LABELS[r.source] || r.source)}
      </span>`).join('');
  }

  if (referrersEl) {
    const refs = data.topReferrers || [];
    referrersEl.innerHTML = refs.length
      ? refs.map((r) => `<tr><td>${esc(r.domain)}</td><td class="an-num">${r.visits.toLocaleString()}</td></tr>`).join('')
      : `<tr><td colspan="2" class="an-empty">No referrer traffic yet</td></tr>`;
  }

  if (campaignsEl) {
    const camps = data.topCampaigns || [];
    campaignsEl.innerHTML = camps.length
      ? camps.map((r) => `
          <tr>
            <td>${esc(r.utmCampaign)}</td>
            <td>${esc(r.utmSource)} / ${esc(r.utmMedium)}</td>
            <td class="an-num">${r.visits.toLocaleString()}</td>
          </tr>`).join('')
      : `<tr><td colspan="3" class="an-empty">No campaign traffic yet</td></tr>`;
  }
}

/* ======================================================
   DEVICES / BROWSERS
====================================================== */
function renderBarTable(elId, rows, keyName) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!rows.length) { el.innerHTML = `<tr><td colspan="2" class="an-empty">No data yet</td></tr>`; return; }
  const max = Math.max(...rows.map((r) => r.count));
  el.innerHTML = rows.map((r) => `
    <tr>
      <td>
        <div class="an-bar-cell">
          <span>${esc(r[keyName]) || '—'}</span>
        </div>
      </td>
      <td class="an-num">
        <div class="an-bar-cell">
          <div class="an-bar-track"><div class="an-bar-fill" style="width:${Math.round((r.count / max) * 100)}%"></div></div>
          <span>${r.count.toLocaleString()}</span>
        </div>
      </td>
    </tr>`).join('');
}

/* ======================================================
   COUNTRIES
====================================================== */
function renderCountries(rows) {
  const el = document.getElementById('an-countries');
  if (!el) return;
  if (!rows.length) { el.innerHTML = `<tr><td colspan="2" class="an-empty">No country data yet — GeoIP database not loaded, or no visits</td></tr>`; return; }
  el.innerHTML = rows.map((r) => `<tr><td>${esc(r.country)}</td><td class="an-num">${r.visits.toLocaleString()}</td></tr>`).join('');
}

/* ======================================================
   TOP CITIES — directional, not precise (see backend route comment)
====================================================== */
function renderCities(rows) {
  const el = document.getElementById('an-cities');
  if (!el) return;
  if (!rows.length) { el.innerHTML = `<tr><td colspan="4" class="an-empty">No city data yet</td></tr>`; return; }
  el.innerHTML = rows.map((r) => `
    <tr>
      <td>${esc(r.city)}</td>
      <td>${esc(r.region) || '—'}</td>
      <td>${esc(r.country)}</td>
      <td class="an-num">${r.visits.toLocaleString()}</td>
    </tr>`).join('');
}

/* ======================================================
   REGISTRATIONS — new accounts + new vendor stores, attributed to
   traffic source/campaign (see backend route comment for why totals
   and by-source breakdowns can legitimately not add up: pre-tracking
   accounts count toward the total but aren't in the breakdown).
====================================================== */
function renderRegSourceTable(elId, rows) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!rows.length) { el.innerHTML = `<tr><td colspan="2" class="an-empty">No attributed registrations yet</td></tr>`; return; }
  el.innerHTML = rows.map((r) => `<tr><td>${esc(SOURCE_LABELS[r.source] || r.source)}</td><td class="an-num">${r.count.toLocaleString()}</td></tr>`).join('');
}

function renderRegCampaignsTable(elId, rows) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!rows.length) { el.innerHTML = `<tr><td colspan="3" class="an-empty">No campaign registrations yet</td></tr>`; return; }
  el.innerHTML = rows.map((r) => `
    <tr>
      <td>${esc(r.utmCampaign)}</td>
      <td>${esc(r.utmSource)} / ${esc(r.utmMedium)}</td>
      <td class="an-num">${r.count.toLocaleString()}</td>
    </tr>`).join('');
}

function renderRegistrations(data) {
  const buyers = data.buyers || { total: 0, bySource: [], topCampaigns: [] };
  const vendors = data.vendors || { total: 0, bySource: [], topCampaigns: [] };

  const accTotalEl = document.getElementById('an-reg-accounts-total');
  if (accTotalEl) accTotalEl.textContent = `— ${buyers.total.toLocaleString()} total`;
  const vendTotalEl = document.getElementById('an-reg-vendors-total');
  if (vendTotalEl) vendTotalEl.textContent = `— ${vendors.total.toLocaleString()} total`;

  renderRegSourceTable('an-reg-accounts-source', buyers.bySource);
  renderRegCampaignsTable('an-reg-accounts-campaigns', buyers.topCampaigns);
  renderRegSourceTable('an-reg-vendors-source', vendors.bySource);
  renderRegCampaignsTable('an-reg-vendors-campaigns', vendors.topCampaigns);
}

/* ======================================================
   CONVERSION FUNNEL
====================================================== */
function renderFunnel(data) {
  const el = document.getElementById('an-funnel');
  if (!el) return;
  const stages = data.stages || [];
  if (!stages.length || !stages[0].count) {
    el.innerHTML = `<div class="an-empty">No visits in this period</div>`;
    return;
  }
  const max = stages[0].count;
  el.innerHTML = stages.map((s) => `
    <div class="an-funnel-stage">
      <div class="an-funnel-label">${esc(s.label)}</div>
      <div class="an-funnel-track">
        <div class="an-funnel-fill" style="width:${max ? Math.round((s.count / max) * 100) : 0}%"></div>
      </div>
      <div class="an-funnel-value">${s.count.toLocaleString()}</div>
      <div class="an-funnel-dropoff">${s.dropOffPct != null ? `-${s.dropOffPct}%` : ''}</div>
    </div>`).join('');
}

/* ======================================================
   SESSION DRILL-DOWN — recent sessions matching the selected minimum
   funnel stage, each expandable to its full event trail. Lets a specific
   drop-off (e.g. "who abandoned checkout") be diagnosed directly instead
   of guessed at from the separate aggregate tables above.
====================================================== */
const STAGE_LABELS = {
  pageview: 'Page View', product_view: 'Product View', add_to_cart: 'Add to Cart', checkout_start: 'Checkout Started',
};
let currentSessionsStage = 'add_to_cart';
let sessionRows = [];

function furthestStage(events) {
  const order = ['pageview', 'product_view', 'add_to_cart', 'checkout_start'];
  let best = -1;
  events.forEach((e) => { const i = order.indexOf(e.type); if (i > best) best = i; });
  return best >= 0 ? order[best] : null;
}

function eventDetailLine(e) {
  const t = new Date(e.timestamp);
  const time = t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  let extra = '';
  if (e.type === 'checkout_start' && e.metadata) {
    extra = ` — ${e.metadata.itemCount ?? '?'} item(s), £${Number(e.metadata.subtotal || 0).toFixed(2)}`;
  } else if ((e.type === 'product_view' || e.type === 'add_to_cart') && e.metadata?.name) {
    extra = ` — ${esc(e.metadata.name)}${e.metadata.price != null ? ` (£${Number(e.metadata.price).toFixed(2)})` : ''}`;
  } else if (e.type === 'search' && e.metadata?.query) {
    extra = ` — "${esc(e.metadata.query)}"`;
  }
  return `<div style="padding:3px 0;font-size:12px"><span style="opacity:.6">${time}</span> · <strong>${esc(STAGE_LABELS[e.type] || e.type)}</strong> · ${esc(e.path) || '—'}${extra}</div>`;
}

function renderSessions(rows) {
  sessionRows = rows;
  const el = document.getElementById('an-sessions');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<tr><td colspan="7" class="an-empty">No sessions reached this stage in this period</td></tr>`;
    return;
  }
  el.innerHTML = rows.map((s, i) => {
    const stage = furthestStage(s.events);
    const started = new Date(s.startedAt).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return `
      <tr>
        <td>${started}</td>
        <td>${esc(s.country) || '—'}</td>
        <td>${esc(s.device)}${s.browser ? ` / ${esc(s.browser)}` : ''}</td>
        <td>${esc(s.entryPage) || '—'}</td>
        <td>${esc(STAGE_LABELS[stage] || '—')}</td>
        <td>${s.purchasedNearby ? '<svg class="s4l-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;flex-shrink:0;"><path d="M5 13l4 4L19 7"/></svg> Yes' : (s.loggedIn ? 'No' : 'Not signed in')}</td>
        <td><button type="button" class="an-session-toggle" data-i="${i}" style="padding:3px 10px;font-size:11px;border:1px solid #d1d5db;border-radius:5px;background:#fff;cursor:pointer">Details</button></td>
      </tr>
      <tr class="an-session-detail" data-i="${i}" hidden>
        <td colspan="7" style="background:#f9fafb">
          ${s.events.length ? s.events.map(eventDetailLine).join('') : '<span class="an-empty">No events recorded</span>'}
        </td>
      </tr>`;
  }).join('');
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.an-session-toggle');
  if (!btn) return;
  const detail = document.querySelector(`.an-session-detail[data-i="${btn.dataset.i}"]`);
  if (!detail) return;
  detail.hidden = !detail.hidden;
  btn.textContent = detail.hidden ? 'Details' : 'Hide';
});

async function loadSessions(period) {
  try {
    renderSessions(await apiGet('/sessions', period, { minStage: currentSessionsStage }));
  } catch (err) {
    console.error('Analytics load error (sessions):', err);
  }
}

document.getElementById('an-sessions-stage')?.addEventListener('change', (e) => {
  currentSessionsStage = e.target.value;
  loadSessions(currentPeriod);
});

/* ======================================================
   REALTIME
====================================================== */
async function loadRealtime() {
  try {
    const data = await apiGet('/realtime');
    const el = document.getElementById('an-realtime-count');
    if (el) el.textContent = `${data.activeVisitors} active visitor${data.activeVisitors === 1 ? '' : 's'} right now`;
  } catch { /* non-fatal, next poll retries */ }
}

/* ======================================================
   LOAD ALL
====================================================== */
async function loadAll(period) {
  // Each section fetches and renders independently — one endpoint failing
  // (network blip, rate limit, whatever) shouldn't blank out every other
  // section that succeeded.
  const sections = [
    { name: 'summary', run: async () => renderCards(await apiGet('/summary', period)) },
    { name: 'timeseries', run: async () => renderTimeseries(await apiGet('/timeseries', period)) },
    { name: 'top-pages', run: async () => renderTopPages(await apiGet('/top-pages', period)) },
    { name: 'top-products', run: async () => renderTopProducts(await apiGet('/top-products', period)) },
    { name: 'searches', run: async () => renderSearches(await apiGet('/searches', period)) },
    { name: 'sources', run: async () => renderSources(await apiGet('/sources', period)) },
    {
      name: 'devices',
      run: async () => {
        const devices = await apiGet('/devices', period);
        renderBarTable('an-devices', devices.devices || [], 'device');
        renderBarTable('an-browsers', devices.browsers || [], 'browser');
        renderBarTable('an-os', devices.os || [], 'os');
      },
    },
    { name: 'countries', run: async () => renderCountries(await apiGet('/countries', period)) },
    { name: 'cities', run: async () => renderCities(await apiGet('/top-cities', period)) },
    { name: 'registrations', run: async () => renderRegistrations(await apiGet('/registrations', period)) },
    { name: 'funnel', run: async () => renderFunnel(await apiGet('/funnel', period)) },
    { name: 'sessions', run: async () => loadSessions(period) },
  ];

  const results = await Promise.allSettled(sections.map((s) => s.run()));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`Analytics load error (${sections[i].name}):`, r.reason);
  });
}

/* ======================================================
   PERIOD FILTER
====================================================== */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.an-period-btn');
  if (!btn) return;
  document.querySelectorAll('.an-period-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentPeriod = btn.dataset.period;
  loadAll(currentPeriod);
});

/* ======================================================
   MANUAL ROLLUP TRIGGER — runs the same job the nightly worker runs,
   for verifying it works without waiting for the scheduled tick.
====================================================== */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#an-run-rollup');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Running…';
  try {
    const res = await authFetch(`${API}/admin/analytics/run-rollup`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Rollup failed');
    alert(`Rolled up ${data.rolledUp} day(s). Pruned raw data for ${data.prunedDays} day(s) (${data.prunedSessions} sessions, ${data.prunedEvents} events).`);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Rollup Now';
  }
});

/* ======================================================
   ONE-OFF TEST DATA CLEANUP (temporary — remove button + this
   handler once run)
====================================================== */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#an-cleanup-test-data');
  if (!btn) return;
  if (!confirm('Delete known test data (test-page, cors-test, inline-static-test, and their sessions)?')) return;
  btn.disabled = true;
  btn.textContent = 'Cleaning…';
  try {
    const res = await authFetch(`${API}/admin/analytics/test-data`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Cleanup failed');
    alert(`Deleted ${data.eventsDeleted} events and ${data.sessionsDeleted} sessions.`);
    loadAll(currentPeriod);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Clean Test Data';
  }
});

/* ======================================================
   INIT
====================================================== */
loadAll(currentPeriod);
loadRealtime();
realtimeTimer = setInterval(loadRealtime, 20000);
