(function (global) {
  'use strict';

  var BACKEND = 'https://keyweaver-backend.vercel.app';
  var widgets = {};
  var lastToken = {};
  var waiters = {};
  var scriptPromise = null;
  var configPromise = null;
  var cachedSiteKey = '';
  var styleInjected = false;
  var TOKEN_WAIT_MS = 25000;

  function loadConfig() {
    if (configPromise) {
      return configPromise;
    }
    configPromise = fetch(BACKEND + '/api/captio/turnstile-config', { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) {
          return '';
        }
        return res.json();
      })
      .then(function (data) {
        cachedSiteKey = data && data.siteKey ? String(data.siteKey).trim() : '';
        return cachedSiteKey;
      })
      .catch(function () {
        cachedSiteKey = '';
        return '';
      });
    return configPromise;
  }

  function siteKey() {
    return cachedSiteKey;
  }

  function enabled() {
    return siteKey().length > 0;
  }

  /** Collapse reserved space unless Cloudflare needs a visible challenge. */
  function injectQuietStyles() {
    if (styleInjected || typeof document === 'undefined') return;
    styleInjected = true;
    var style = document.createElement('style');
    style.setAttribute('data-kw-turnstile', 'quiet');
    style.textContent =
      '.cuemark-turnstile-wrap{min-height:0!important;}' +
      '.cuemark-turnstile-wrap:not(.is-challenge){margin-top:0!important;margin-bottom:0!important;}' +
      '.cuemark-turnstile-wrap.is-challenge{min-height:65px!important;margin:0.5rem 0 1rem!important;}';
    document.head.appendChild(style);
  }

  function wrapFor(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return null;
    return el.closest ? el.closest('.cuemark-turnstile-wrap') : el.parentElement;
  }

  function setChallengeVisible(containerId, on) {
    var wrap = wrapFor(containerId);
    if (wrap) wrap.classList.toggle('is-challenge', !!on);
  }

  function clearWaiters(containerId, err) {
    var list = waiters[containerId] || [];
    waiters[containerId] = [];
    for (var i = 0; i < list.length; i++) {
      if (err) list[i].reject(err);
      else list[i].resolve(lastToken[containerId] || '');
    }
  }

  function notifyToken(containerId, token) {
    lastToken[containerId] = token || '';
    if (token) setChallengeVisible(containerId, false);
    clearWaiters(containerId, null);
  }

  function loadScript() {
    if (!enabled()) {
      return Promise.resolve();
    }
    if (scriptPromise) {
      return scriptPromise;
    }
    scriptPromise = new Promise(function (resolve, reject) {
      if (global.turnstile) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Turnstile failed to load')); };
      document.head.appendChild(s);
    });
    return scriptPromise;
  }

  function renderOptions(containerId) {
    return {
      sitekey: siteKey(),
      theme: 'dark',
      // Hide until Cloudflare needs a checkbox (Managed widget). Full Invisible
      // mode is a dashboard setting + privacy-policy note — this is the safe default.
      appearance: 'interaction-only',
      callback: function (token) {
        notifyToken(containerId, token);
      },
      'expired-callback': function () {
        lastToken[containerId] = '';
      },
      'error-callback': function () {
        lastToken[containerId] = '';
        setChallengeVisible(containerId, false);
      },
      'before-interactive-callback': function () {
        setChallengeVisible(containerId, true);
      },
      'after-interactive-callback': function () {
        // Keep space until success callback clears challenge class.
      },
      'unsupported-callback': function () {
        setChallengeVisible(containerId, true);
      }
    };
  }

  function renderInto(containerId, el) {
    injectQuietStyles();
    lastToken[containerId] = '';
    setChallengeVisible(containerId, false);
    el.innerHTML = '';
    widgets[containerId] = global.turnstile.render(el, renderOptions(containerId));
    return widgets[containerId];
  }

  /** Mount only if this container does not already have a live widget. */
  function ensureMounted(containerId) {
    return loadConfig().then(function () {
      return loadScript().then(function () {
        if (!enabled()) {
          return null;
        }
        var el = document.getElementById(containerId);
        if (!el) {
          return null;
        }
        if (widgets[containerId] != null && global.turnstile) {
          return widgets[containerId];
        }
        return renderInto(containerId, el);
      });
    });
  }

  /** Force a fresh widget (after failed submit or token consumed). */
  function mount(containerId) {
    return loadConfig().then(function () {
      return loadScript().then(function () {
        if (!enabled()) {
          return null;
        }
        var el = document.getElementById(containerId);
        if (!el) {
          return null;
        }
        if (widgets[containerId] != null && global.turnstile) {
          try {
            global.turnstile.remove(widgets[containerId]);
          } catch (removeErr) {}
          widgets[containerId] = null;
        }
        return renderInto(containerId, el);
      });
    });
  }

  function prepare(wrapId, containerId) {
    injectQuietStyles();
    return loadConfig().then(function (key) {
      if (wrapId) {
        var wrap = document.getElementById(wrapId);
        if (wrap) {
          wrap.style.display = key ? '' : 'none';
          if (!key) wrap.classList.remove('is-challenge');
        }
      }
      if (!key) {
        return null;
      }
      return ensureMounted(containerId);
    });
  }

  function getToken(containerId) {
    if (lastToken[containerId]) {
      return lastToken[containerId];
    }
    if (!enabled() || !global.turnstile || widgets[containerId] == null) {
      return '';
    }
    return global.turnstile.getResponse(widgets[containerId]) || '';
  }

  function reset(containerId) {
    lastToken[containerId] = '';
    setChallengeVisible(containerId, false);
    var el = document.getElementById(containerId);
    if (!enabled() || !global.turnstile) {
      widgets[containerId] = null;
      if (el) { el.innerHTML = ''; }
      return;
    }
    if (widgets[containerId] != null) {
      try {
        global.turnstile.reset(widgets[containerId]);
      } catch (resetErr) {
        widgets[containerId] = null;
        if (el) { el.innerHTML = ''; }
      }
      return;
    }
    if (el) { el.innerHTML = ''; }
  }

  /**
   * Resolve with a fresh token. Waits for background solve when the widget is hidden.
   * Shows the challenge UI only if Cloudflare requires interaction.
   */
  function requireToken(containerId) {
    return ensureMounted(containerId).then(function () {
      if (!enabled()) {
        return '';
      }

      var existing = getToken(containerId);
      if (existing) {
        return existing;
      }

      return new Promise(function (resolve, reject) {
        if (!waiters[containerId]) waiters[containerId] = [];
        waiters[containerId].push({ resolve: resolve, reject: reject });

        var started = Date.now();
        var poll = setInterval(function () {
          var token = getToken(containerId);
          if (token) {
            clearInterval(poll);
            clearTimeout(timer);
            notifyToken(containerId, token);
            return;
          }
          if (Date.now() - started > TOKEN_WAIT_MS) {
            clearInterval(poll);
          }
        }, 200);

        var timer = setTimeout(function () {
          clearInterval(poll);
          var still = getToken(containerId);
          if (still) {
            notifyToken(containerId, still);
            return;
          }
          // Leave challenge visible if Cloudflare asked for a click.
          setChallengeVisible(containerId, true);
          var err = new Error('Please complete the security check, then try again.');
          var list = waiters[containerId] || [];
          waiters[containerId] = [];
          for (var i = 0; i < list.length; i++) {
            list[i].reject(err);
          }
        }, TOKEN_WAIT_MS);
      });
    });
  }

  global.CuemarkTurnstile = {
    loadConfig: loadConfig,
    enabled: enabled,
    prepare: prepare,
    ensureMounted: ensureMounted,
    mount: mount,
    getToken: getToken,
    reset: reset,
    requireToken: requireToken
  };
})(window);
