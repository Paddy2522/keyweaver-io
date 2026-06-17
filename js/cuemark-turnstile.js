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
          global.turnstile.remove(widgets[containerId]);
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
      return mount(containerId);
    });
  }

  function getToken(containerId) {
    if (!enabled() || !global.turnstile || widgets[containerId] == null) {
      return '';
    }
    return global.turnstile.getResponse(widgets[containerId]) || '';
  }

  function reset(containerId) {
    if (!enabled() || !global.turnstile || widgets[containerId] == null) {
      return;
    }
    global.turnstile.reset(widgets[containerId]);
  }

  function requireToken(containerId) {
    return loadConfig().then(function () {
      if (!enabled()) {
        return '';
      }
      return mount(containerId).then(function () {
        var token = getToken(containerId);
        if (token) {
          return token;
        }
        throw new Error('Please complete the security check.');
      });
    });
  }

  global.CuemarkTurnstile = {
    loadConfig: loadConfig,
    enabled: enabled,
    prepare: prepare,
    mount: mount,
    getToken: getToken,
    reset: reset,
    requireToken: requireToken
  };
})(window);
