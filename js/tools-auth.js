/**
 * Shared Keyweaver Tools auth — same session as /account and plugins.
 * Token: localStorage cc_token → Authorization: Bearer → keyweaver-backend.
 */
(function (global) {
  'use strict';

  var BACKEND = 'https://keyweaver-backend.vercel.app';
  var TOKEN_KEY = 'cc_token';
  var NEXT_KEY = 'cc_login_next';

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* ignore */ }
  }

  function clearToken() {
    setToken('');
  }

  function isSignedIn() {
    return !!getToken();
  }

  function safeNextPath(next) {
    if (!next || typeof next !== 'string') return '';
    if (!next.startsWith('/') || next.startsWith('//')) return '';
    return next;
  }

  function rememberLoginNext(next) {
    var path = safeNextPath(next);
    try {
      if (path) sessionStorage.setItem(NEXT_KEY, path);
      else sessionStorage.removeItem(NEXT_KEY);
    } catch (e) { /* ignore */ }
  }

  function consumeLoginNext(fallback) {
    var stored = '';
    try {
      stored = sessionStorage.getItem(NEXT_KEY) || '';
      sessionStorage.removeItem(NEXT_KEY);
    } catch (e) {
      stored = '';
    }
    return safeNextPath(stored) || safeNextPath(fallback) || '/account';
  }

  function loginUrl(nextPath) {
    var next = safeNextPath(nextPath) || '/account';
    rememberLoginNext(next);
    return '/login?next=' + encodeURIComponent(next);
  }

  /**
   * @returns {Promise<{
   *   ok: boolean,
   *   status: number,
   *   signedIn: boolean,
   *   unauthorized: boolean,
   *   remaining: number,
   *   total: number,
   *   paidRemaining: number,
   *   paidTotal: number,
   *   hasPaid: boolean,
   *   raw: object|null
   * }>}
   */
  function fetchCredits() {
    var token = getToken();
    if (!token) {
      return Promise.resolve({
        ok: false,
        status: 0,
        signedIn: false,
        unauthorized: false,
        remaining: 0,
        total: 0,
        paidRemaining: 0,
        paidTotal: 0,
        hasPaid: false,
        raw: null
      });
    }

    return fetch(BACKEND + '/api/captio/credits', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (res) {
        if (res.status === 401) {
          clearToken();
          return {
            ok: false,
            status: 401,
            signedIn: false,
            unauthorized: true,
            remaining: 0,
            total: 0,
            paidRemaining: 0,
            paidTotal: 0,
            hasPaid: false,
            raw: null
          };
        }
        return res.json().then(function (data) {
          if (!res.ok || !data) {
            return {
              ok: false,
              status: res.status,
              signedIn: true,
              unauthorized: false,
              remaining: 0,
              total: 0,
              paidRemaining: 0,
              paidTotal: 0,
              hasPaid: false,
              raw: data || null
            };
          }
          var paid = Number(data.paid_credits_remaining != null ? data.paid_credits_remaining : 0);
          var paidTotal = Number(data.paid_credits_total != null ? data.paid_credits_total : 0);
          return {
            ok: true,
            status: res.status,
            signedIn: true,
            unauthorized: false,
            remaining: Number(data.credits_remaining || 0),
            total: Number(data.credits_total || 0),
            paidRemaining: paid,
            paidTotal: paidTotal,
            hasPaid: paid > 0 || !!data.has_paid_credits,
            raw: data
          };
        });
      })
      .catch(function () {
        return {
          ok: false,
          status: 0,
          signedIn: !!getToken(),
          unauthorized: false,
          remaining: 0,
          total: 0,
          paidRemaining: 0,
          paidTotal: 0,
          hasPaid: false,
          raw: null
        };
      });
  }

  /** Validate existing token; clears it if dead. */
  function validateSession() {
    var token = getToken();
    if (!token) return Promise.resolve({ ok: false, signedIn: false });
    return fetch(BACKEND + '/api/captio/account', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (res) {
        if (res.status === 401) {
          clearToken();
          return { ok: false, signedIn: false };
        }
        return { ok: res.ok, signedIn: res.ok };
      })
      .catch(function () {
        return { ok: false, signedIn: !!getToken() };
      });
  }

  /**
   * Wire credit CTA buttons: sign-in / buy / account.
   * @param {{ signin?: HTMLElement|null, buy?: HTMLElement|null, account?: HTMLElement|null, nextPath?: string, signedIn?: boolean, paidRemaining?: number|null }} opts
   */
  function syncCreditActions(opts) {
    opts = opts || {};
    var signedIn = opts.signedIn != null ? !!opts.signedIn : isSignedIn();
    var paidRemaining = opts.paidRemaining;
    var zeroPaid = signedIn && paidRemaining != null && Number(paidRemaining) <= 0;
    var nextPath = opts.nextPath || '/account';

    if (opts.signin) {
      opts.signin.hidden = signedIn;
      opts.signin.setAttribute('aria-hidden', signedIn ? 'true' : 'false');
      if (!signedIn) {
        opts.signin.href = loginUrl(nextPath);
        opts.signin.textContent = opts.signinLabel || 'Sign in';
        opts.signin.className = 'btn btn-primary';
      }
    }
    if (opts.buy) {
      opts.buy.hidden = false;
      opts.buy.href = '/pricing';
      opts.buy.textContent = 'Buy credits';
      opts.buy.className = zeroPaid ? 'btn btn-primary' : 'btn btn-ghost';
    }
    if (opts.account) {
      opts.account.hidden = !signedIn;
      opts.account.setAttribute('aria-hidden', signedIn ? 'false' : 'true');
      opts.account.href = '/account';
    }
  }

  function authHeaders(extra) {
    var headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
    var token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  global.KeyweaverToolsAuth = {
    BACKEND: BACKEND,
    TOKEN_KEY: TOKEN_KEY,
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    isSignedIn: isSignedIn,
    safeNextPath: safeNextPath,
    rememberLoginNext: rememberLoginNext,
    consumeLoginNext: consumeLoginNext,
    loginUrl: loginUrl,
    fetchCredits: fetchCredits,
    validateSession: validateSession,
    syncCreditActions: syncCreditActions,
    authHeaders: authHeaders
  };
})(typeof window !== 'undefined' ? window : this);
