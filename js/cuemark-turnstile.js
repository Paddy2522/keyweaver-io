(function (global) {
  'use strict';

  var widgets = {};
  var scriptPromise = null;

  function siteKey() {
    return String(global.CUEMARK_TURNSTILE_SITE_KEY || '').trim();
  }

  function enabled() {
    var key = siteKey();
    return key.length > 0 && key.indexOf('REPLACE') !== 0;
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
    if (!enabled()) {
      return Promise.resolve('');
    }
    var token = getToken(containerId);
    if (token) {
      return Promise.resolve(token);
    }
    return Promise.reject(new Error('Please complete the security check.'));
  }

  global.CuemarkTurnstile = {
    enabled: enabled,
    mount: mount,
    getToken: getToken,
    reset: reset,
    requireToken: requireToken
  };
})(window);
