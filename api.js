/**
 * Lesson Tree Planner — API client
 * Works when the app is hosted on GitHub Pages / any static host.
 *
 * Transport 1: fetch POST with a text/plain body (a "simple" CORS request,
 *              so no preflight is sent to Apps Script).
 * Transport 2: JSONP GET, used automatically as a fallback when a browser
 *              blocks the POST (for example behind a strict proxy).
 */
(function () {
  'use strict';

  var SESSION_KEY = 'planner_session';   // remembered (localStorage)
  var DEFAULT_TIMEOUT = 60000;

  function cfg() {
    return window.PLANNER_CONFIG || {};
  }

  function apiUrl() {
    return String(cfg().apiUrl || '').trim();
  }

  function hasBackend() {
    return !!apiUrl();
  }

  function readSession() {
    var raw = null;
    try { raw = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    if (!raw) { try { raw = localStorage.getItem(SESSION_KEY); } catch (e) {} }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function saveSession(token, user, remember) {
    var payload = JSON.stringify({ token: token, user: user, savedAt: Date.now() });
    try {
      if (remember) {
        localStorage.setItem(SESSION_KEY, payload);
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(SESSION_KEY, payload);
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {}
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function token() {
    var s = readSession();
    return s && s.token ? s.token : '';
  }

  function b64url(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function apiError(message) {
    var e = new Error(message || 'Request failed');
    e.api = true;
    return e;
  }

  function jsonp(action, body, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var base = apiUrl();
      if (!base) { reject(new Error('No backend URL configured.')); return; }

      var cb = 'planner_cb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var payload;
      try { payload = b64url(JSON.stringify(body)); }
      catch (e) { reject(e); return; }

      var src = base +
        (base.indexOf('?') >= 0 ? '&' : '?') +
        'action=' + encodeURIComponent(action) +
        '&payload=' + payload +
        '&callback=' + cb;

      var script = document.createElement('script');
      var timer = setTimeout(function () { done(new Error('The backend took too long to reply.')); }, timeoutMs || DEFAULT_TIMEOUT);
      var finished = false;

      function done(err, data) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
        if (err) reject(err);
        else if (data && data.ok === false) reject(apiError(data.error));
        else resolve(data ? data.data : null);
      }

      window[cb] = function (data) { done(null, data); };
      script.onerror = function () {
        done(new Error('Could not reach the backend. Check the Web App URL and that access is set to "Anyone".'));
      };
      script.src = src;
      document.head.appendChild(script);
    });
  }

  /**
   * call('login', { email, password })
   * Resolves with the action's data. Rejects with Error(message).
   */
  function call(action, payload, opts) {
    opts = opts || {};
    var url = apiUrl();
    if (!url) return Promise.reject(new Error('No backend URL configured yet.'));

    var body = Object.assign({ action: action, token: token() }, payload || {});
    var timeoutMs = opts.timeout || DEFAULT_TIMEOUT;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, timeoutMs);

    var request = fetch(url, {
      method: 'POST',
      // text/plain keeps this a CORS "simple request" (no preflight).
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try { data = JSON.parse(text); }
        catch (e) {
          var bad = new Error('Unexpected reply from the backend (HTTP ' + res.status + ').');
          bad.transport = true;
          throw bad;
        }
        if (data && data.ok === false) throw apiError(data.error);
        if (!data || data.ok !== true) {
          var odd = new Error('Unexpected reply from the backend.');
          odd.transport = true;
          throw odd;
        }
        return data.data;
      });
    }).catch(function (err) {
      // Only fall back for transport problems, never for a rejected login/action.
      if (err && err.api) throw err;
      var isTransport = err && (err.transport || err.name === 'TypeError');
      if (!isTransport) throw err;
      if (opts.noFallback) throw err;
      return jsonp(action, body, timeoutMs);
    });

    return request.then(function (value) {
      clearTimeout(timer);
      return value;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  window.PlannerAPI = {
    hasBackend: hasBackend,
    apiUrl: apiUrl,
    call: call,
    token: token,
    readSession: readSession,
    saveSession: saveSession,
    clearSession: clearSession
  };
})();
