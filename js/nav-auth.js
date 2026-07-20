/**
 * Swap nav Sign in → Account when a Keyweaver session token is present.
 * Checkout already uses localStorage cc_token; the header should match.
 */
(function () {
  'use strict';

  function applyNavAuth() {
    var token = null;
    try {
      token = localStorage.getItem('cc_token');
    } catch (e) {
      return;
    }
    if (!token) return;

    var navs = document.querySelectorAll('nav');
    for (var i = 0; i < navs.length; i++) {
      var nav = navs[i];
      var links = nav.querySelectorAll('a[href="/login"]');
      for (var j = 0; j < links.length; j++) {
        var a = links[j];
        var label = (a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (label === 'sign in') {
          a.href = '/account';
          a.textContent = 'Account';
        }
      }

      var signups = nav.querySelectorAll('a[href="/signup"]');
      for (var k = 0; k < signups.length; k++) {
        var s = signups[k];
        var st = (s.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (st === 'get started free' || st === 'create account') {
          s.href = '/download';
          s.textContent = 'Download free';
          if (!s.classList.contains('btn-primary')) {
            s.classList.remove('btn-ghost');
            s.classList.add('btn-primary');
          }
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyNavAuth);
  } else {
    applyNavAuth();
  }
})();
