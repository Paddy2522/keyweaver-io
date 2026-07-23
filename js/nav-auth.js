/**
 * Swap nav Sign in → Account when a Keyweaver session token is present.
 * Checkout already uses localStorage cc_token; the header should match.
 * Also injects a mobile nav toggle for .site-nav / primary navs.
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

  function setupMobileNav() {
    var navs = document.querySelectorAll('nav.site-nav, nav[aria-label="Primary"]');
    Array.prototype.forEach.call(navs, function (nav, index) {
      if (nav.querySelector('.nav-toggle')) return;
      var links = nav.querySelector('.nav-links');
      if (!links) return;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-toggle';
      btn.setAttribute('aria-expanded', 'false');
      if (!links.id) links.id = 'site-nav-links-' + index;
      btn.setAttribute('aria-controls', links.id);
      btn.setAttribute('aria-label', 'Open menu');
      btn.innerHTML = '<span class="nav-toggle-bars" aria-hidden="true"></span>';

      var cta = nav.querySelector('.nav-cta');
      if (cta && cta.parentNode === nav) {
        nav.insertBefore(btn, cta.nextSibling);
      } else {
        nav.appendChild(btn);
      }

      function closeMenu() {
        nav.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Open menu');
      }

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = nav.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      });

      document.addEventListener('click', function (e) {
        if (!nav.classList.contains('is-open')) return;
        if (nav.contains(e.target)) return;
        closeMenu();
      });

      links.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        if (!t.closest('a')) return;
        closeMenu();
      });
    });
  }

  function boot() {
    applyNavAuth();
    setupMobileNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
