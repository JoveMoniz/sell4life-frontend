// ======================================================
// SELL4LIFE FIRST-PARTY TRAFFIC TRACKER
// No cookies, no cross-site tracking — just an anonymous
// localStorage visitor id + a sessionStorage session id.
// Must never break the page: everything wrapped in try/catch.
// ======================================================
(function () {
  // ---- TEMPORARY on-page debug badge (safe to remove once diagnosed) ----
  var _dbg;
  function dbg(msg) {
    try {
      if (!_dbg) {
        _dbg = document.createElement('div');
        _dbg.id = 's4l-track-debug';
        _dbg.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:999999;background:#111;color:#0f0;font:11px monospace;padding:8px 10px;border-radius:6px;max-width:380px;max-height:200px
        
        ;overflow:auto;white-space:pre-wrap;box-shadow:0 2px 10px rgba(0,0,0,.4)';
        (document.body || document.documentElement).appendChild(_dbg);
      }
      var line = document.createElement('div');
      line.textContent = msg;
      _dbg.appendChild(line);
    } catch (_) { /* never let the debug badge itself break anything */ }
  }

  dbg('tracker starting, API_BASE=' + window.API_BASE);
  try {
    const API = window.API_BASE;
    if (!API) { dbg('ABORT: no API_BASE'); return; }

    const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min

    function uuid() {
      if (window.crypto?.randomUUID) return window.crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    function getVisitorId() {
      let id = localStorage.getItem('s4l_visitor_id');
      if (!id) {
        id = uuid();
        localStorage.setItem('s4l_visitor_id', id);
      }
      return id;
    }

    function getSession() {
      const now = Date.now();
      const lastActive = Number(sessionStorage.getItem('s4l_session_last_active') || 0);
      let id = sessionStorage.getItem('s4l_session_id');
      let isNewSession = false;

      if (!id || now - lastActive > SESSION_IDLE_MS) {
        id = uuid();
        isNewSession = true;
        sessionStorage.setItem('s4l_session_id', id);
        sessionStorage.removeItem('s4l_session_utm');
        sessionStorage.removeItem('s4l_session_referrer');
      }
      sessionStorage.setItem('s4l_session_last_active', String(now));

      return { id, isNewSession };
    }

    function getUtmAndReferrer(isNewSession) {
      // Only the entry page of a session should "own" the UTM tag and
      // referrer — later internal pageviews would just report the
      // previous on-site page, which isn't useful for source attribution.
      if (!isNewSession) {
        return {
          utm: JSON.parse(sessionStorage.getItem('s4l_session_utm') || '{}'),
          referrer: sessionStorage.getItem('s4l_session_referrer') || '',
        };
      }

      const params = new URLSearchParams(location.search);
      const utm = {
        source: params.get('utm_source') || '',
        medium: params.get('utm_medium') || '',
        campaign: params.get('utm_campaign') || '',
        term: params.get('utm_term') || '',
        content: params.get('utm_content') || '',
      };
      const referrer = document.referrer || '';

      sessionStorage.setItem('s4l_session_utm', JSON.stringify(utm));
      sessionStorage.setItem('s4l_session_referrer', referrer);

      return { utm, referrer };
    }

    function getUserContext() {
      let userId = null;
      let isInternal = false;
      try {
        const u = JSON.parse(localStorage.getItem('s4l_user') || 'null');
        if (u?.id) userId = u.id;
        if (u?.role === 'admin' || u?.role === 'vendor') isInternal = true;
      } catch { /* not logged in / unreadable — treat as anonymous */ }
      return { userId, isInternal };
    }

    function send(payload) {
      try {
        const body = JSON.stringify(payload);
        const url = `${API}/track/event`;
        // fetch+keepalive is the primary transport, not sendBeacon — the API
        // lives on a different origin, and cross-origin sendBeacon() with a
        // non-"simple" content type (application/json) gets its content-type
        // silently coerced by some browsers, which makes express.json() fail
        // to parse the body server-side and silently drops every event.
        // fetch goes through the exact same CORS path every other API call
        // on the site already uses successfully. keepalive:true keeps it
        // reliable even from a pagehide/unload handler in modern browsers.
        dbg('sending ' + payload.type + ' -> ' + url);
        if (window.fetch) {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
          })
            .then((res) => { dbg('response: ' + res.status); })
            .catch((err) => dbg('FETCH FAILED: ' + (err?.message || err)));
        } else if (navigator.sendBeacon) {
          dbg('using sendBeacon fallback');
          navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        } else {
          dbg('ABORT: no fetch and no sendBeacon available');
        }
      } catch (err) { dbg('send() THREW: ' + (err?.message || err)); }
    }

    const visitorId = getVisitorId();
    const { id: sessionId, isNewSession } = getSession();
    const { utm, referrer } = getUtmAndReferrer(isNewSession);
    const { userId, isInternal } = getUserContext();
    dbg('ids ok: visitor=' + visitorId.slice(0, 8) + ' session=' + sessionId.slice(0, 8) + ' new=' + isNewSession);

    function baseEnvelope(type, extra) {
      return {
        sessionId,
        visitorId,
        userId,
        isInternal,
        type,
        path: location.pathname,
        title: document.title,
        referrer,
        utm,
        screen: { width: window.screen?.width || null, height: window.screen?.height || null },
        ...extra,
      };
    }

    // Fire the pageview immediately — never delay this to unload, so a
    // fast bounce still counts as a real visit.
    const pageLoadTime = performance.now();
    send(baseEnvelope('pageview'));

    // Best-effort time-on-page beacon. pagehide is preferred over
    // beforeunload for bfcache compatibility.
    let exitSent = false;
    function sendExit() {
      if (exitSent) return;
      exitSent = true;
      const seconds = Math.round((performance.now() - pageLoadTime) / 1000);
      send(baseEnvelope('custom', {
        metadata: { kind: 'time_on_page', seconds },
        timeOnPageSec: seconds,
      }));
    }
    window.addEventListener('pagehide', sendExit);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sendExit();
    });

    // Exposed for later custom-event wiring (product views, add-to-cart,
    // checkout, purchase, search, signup, etc.) — no other change needed
    // in this file when that's built.
    window.s4lTrack = function (eventType, metadata) {
      try {
        send(baseEnvelope(eventType || 'custom', { metadata: metadata || {} }));
      } catch { /* never throw */ }
    };
  } catch (err) {
    dbg('TRACKER CRASHED: ' + (err?.message || err));
  }
})();
