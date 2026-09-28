/**
 * Site nav auth + credits.
 * - Match Sign in links even with ?next=…
 * - When signed in: hide Sign in, show credit balance + Account
 * - Validate token; clear dead sessions so login bounce cannot loop
 * - Ensure Credits is a top-level nav item (not under Tools)
 */
(function () {
  'use strict';

  var BACKEND = 'https://keyweaver-backend.vercel.app';

  function getToken() {
    try {
      return localStorage.getItem('cc_token') || '';
    } catch (e) {
      return '';
    }
  }

  function clearToken() {
    try {
      localStorage.removeItem('cc_token');
    } catch (e) { /* ignore */ }
  }

  function closeNavProducts(except) {
    var open = document.querySelectorAll('details.nav-products[open]');
    for (var i = 0; i < open.length; i++) {
      if (except && open[i] === except) continue;
      open[i].removeAttribute('open');
    }
  }

  function setupNavDropdowns() {
    var menus = document.querySelectorAll('details.nav-products');
    if (!menus.length) return;

    Array.prototype.forEach.call(menus, function (details) {
      details.addEventListener('toggle', function () {
        if (!details.open) return;
        closeNavProducts(details);
      });
    });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('details.nav-products')) return;
      closeNavProducts(null);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.keyCode !== 27) return;
      closeNavProducts(null);
    });
  }

  function linkLabel(a) {
    return (a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isLoginHref(href) {
    if (!href) return false;
    try {
      var u = new URL(href, window.location.origin);
      return u.pathname === '/login';
    } catch (e) {
      return String(href).indexOf('/login') === 0;
    }
  }

  /** Ensure Credits is its own top-level item (rename Pricing → Credits). */
  function ensureCreditsNavItem(nav) {
    var links = nav.querySelector('.nav-links');
    if (!links) return;

    var existing = links.querySelectorAll('a');
    var i;
    for (i = 0; i < existing.length; i++) {
      var a = existing[i];
      var label = linkLabel(a);
      if (label === 'credits') return;
      if (label === 'pricing' && (a.getAttribute('href') || '') === '/pricing') {
        a.textContent = 'Credits';
        return;
      }
    }

    // Insert Credits after Tools (or before Download/Help).
    var toolsLi = null;
    var children = links.children;
    for (i = 0; i < children.length; i++) {
      var li = children[i];
      var summary = li.querySelector && li.querySelector('summary');
      if (summary && String(summary.textContent || '').trim().toLowerCase() === 'tools') {
        toolsLi = li;
        break;
      }
    }
    var item = document.createElement('li');
    item.className = 'nav-credits-item';
    var creditLink = document.createElement('a');
    creditLink.href = '/pricing';
    creditLink.textContent = 'Credits';
    item.appendChild(creditLink);
    if (toolsLi && toolsLi.nextSibling) {
      links.insertBefore(item, toolsLi.nextSibling);
    } else {
      links.appendChild(item);
    }
  }

  function setSignedOutCta(nav) {
    // Leave static HTML as-is for signed-out visitors.
    var balance = nav.querySelector('.nav-credit-balance');
    if (balance) balance.remove();
  }

  function setSignedInCta(nav, remaining) {
    var cta = nav.querySelector('.nav-cta');
    if (!cta) return;

    var loginLinks = cta.querySelectorAll('a');
    var i;
    for (i = 0; i < loginLinks.length; i++) {
      var a = loginLinks[i];
      if (isLoginHref(a.getAttribute('href')) && linkLabel(a) === 'sign in') {
        a.href = '/account';
        a.textContent = 'Account';
        a.classList.remove('btn-primary');
        if (!a.classList.contains('btn-ghost')) a.classList.add('btn-ghost');
      }
    }

    var signups = cta.querySelectorAll('a');
    for (i = 0; i < signups.length; i++) {
      var s = signups[i];
      var st = linkLabel(s);
      if (
        st === 'get started free' ||
        st === 'create account' ||
        st === 'get free credits' ||
        st === 'sign up'
      ) {
        s.href = '/pricing';
        s.textContent = 'Buy credits';
        s.classList.remove('btn-ghost');
        if (!s.classList.contains('btn-primary')) s.classList.add('btn-primary');
      }
    }

    var bal = cta.querySelector('.nav-credit-balance');
    if (!bal) {
      bal = document.createElement('a');
      bal.className = 'nav-credit-balance';
      bal.href = '/pricing';
      bal.title = 'Buy more credits';
      cta.insertBefore(bal, cta.firstChild);
    }
    var n = Number(remaining);
    if (!isFinite(n) || n < 0) n = 0;
    bal.textContent = n === 1 ? '1 credit' : Math.floor(n) + ' credits';
    bal.setAttribute('aria-label', bal.textContent + ' remaining');
  }

  function applyNavSignedOut() {
    var navs = document.querySelectorAll('nav');
    for (var i = 0; i < navs.length; i++) {
      ensureCreditsNavItem(navs[i]);
      setSignedOutCta(navs[i]);
    }
  }

  function applyNavSignedIn(remaining) {
    var navs = document.querySelectorAll('nav');
    for (var i = 0; i < navs.length; i++) {
      ensureCreditsNavItem(navs[i]);
      setSignedInCta(navs[i], remaining);
    }
  }

  function fetchCredits(token) {
    return fetch(BACKEND + '/api/captio/credits', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(function (res) {
      if (res.status === 401) {
        clearToken();
        return { ok: false, unauthorized: true, remaining: 0 };
      }
      return res.json().then(function (data) {
        if (!res.ok || !data) {
          return { ok: false, unauthorized: false, remaining: 0 };
        }
        return {
          ok: true,
          unauthorized: false,
          remaining: Number(data.credits_remaining != null ? data.credits_remaining : 0)
        };
      });
    }).catch(function () {
      return { ok: false, unauthorized: false, remaining: 0 };
    });
  }

  function applyNavAuth() {
    applyNavSignedOut();
    var token = getToken();
    if (!token) return;

    // Optimistic: hide Sign in immediately so login?next= bounce does not flash "Sign in".
    applyNavSignedIn('…');

    fetchCredits(token).then(function (snap) {
      if (snap.unauthorized || !getToken()) {
        applyNavSignedOut();
        // Restore original CTA labels for dead sessions — reload is simplest.
        // Soft restore: put Sign in back if we rewrote links.
        var navs = document.querySelectorAll('nav');
        for (var i = 0; i < navs.length; i++) {
          var cta = navs[i].querySelector('.nav-cta');
          if (!cta) continue;
          var bal = cta.querySelector('.nav-credit-balance');
          if (bal) bal.remove();
          var links = cta.querySelectorAll('a');
          for (var j = 0; j < links.length; j++) {
            var a = links[j];
            if (linkLabel(a) === 'account' && (a.getAttribute('href') || '') === '/account') {
              a.href = '/login';
              a.textContent = 'Sign in';
            }
            if (linkLabel(a) === 'buy credits') {
              a.href = '/signup';
              a.textContent = 'Get free credits';
            }
          }
        }
        return;
      }
      applyNavSignedIn(snap.ok ? snap.remaining : 0);
    });
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
    setupNavDropdowns();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
