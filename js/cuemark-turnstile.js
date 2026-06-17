(function (global) {
  'use strict';

  var BACKEND = 'https://keyweaver-backend.vercel.app';
  var widgets = {};
  var scriptPromise = null;
  var configPromise = null;
  var cachedSiteKey = '';

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
        el.innerHTML = '';
        widgets[containerId] = global.turnstile.render(el, {
          sitekey: siteKey(),
          theme: 'dark'
        });
        return widgets[containerId];
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
        el.innerHTML = '';
        widgets[containerId] = global.turnstile.render(el, {
          sitekey: siteKey(),
          theme: 'dark'
        });
        return widgets[containerId];
      });
    });
  }

  function prepare(wrapId, containerId) {
    return loadConfig().then(function (key) {
      if (wrapId) {
        var wrap = document.getElementById(wrapId);
        if (wrap) {
          wrap.style.display = key ? '' : 'none';
        }
      }
      if (!key) {
        return null;
      }
      return ensureMounted(containerId);
    });
  }

  function getToken(containerId) {
    if (!enabled() || !global.turnstile || widgets[containerId] == null) {
      return '';
    }
    return global.turnstile.getResponse(widgets[containerId]) || '';
  }

  function reset(containerId) {
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

  function requireToken(containerId) {
    return ensureMounted(containerId).then(function () {
      if (!enabled()) {
        return '';
      }
      var token = getToken(containerId);
      if (token) {
        return token;
      }
      throw new Error('Please complete the security check.');
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
