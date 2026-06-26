/**
 * Cuemark — cookie consent (UK/EU).
 * Meta basic PageView loads for ad measurement; richer conversion tags and
 * Google Ads load only after opt-in.
 */
(function (global) {
  'use strict';

  var CONSENT_KEY = 'cuemark_cookie_consent';
  var GOOGLE_ADS_ID = 'AW-18266783138';
  var META_PIXEL_ID = '27322169484089367';
  var marketingLoaded = false;
  var metaPageViewLoaded = false;
  var bannerEl = null;

  function getConsent() {
    try {
      var raw = global.localStorage.getItem(CONSENT_KEY);
      if (!raw) { return null; }
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setConsent(marketing) {
    try {
      global.localStorage.setItem(CONSENT_KEY, JSON.stringify({
        marketing: !!marketing,
        ts: new Date().toISOString(),
        v: 1
      }));
    } catch (e) {}
  }

  function loadScript(src, defer) {
    if (document.querySelector('script[src="' + src + '"]')) { return; }
    var s = document.createElement('script');
    s.src = src;
    if (defer) { s.defer = true; }
    document.head.appendChild(s);
  }

  function loadGoogleAds() {
    global.dataLayer = global.dataLayer || [];
    global.gtag = global.gtag || function () { global.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_ADS_ID, true);
    gtag('config', GOOGLE_ADS_ID);
  }

  function ensureMetaPixelBase() {
    if (global.fbq) { return; }
    var n, t, s;
    !function (f, b, e, v) {
      if (f.fbq) { return; }
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) { f._fbq = n; }
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(global, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
  }

  function loadMetaPageView() {
    if (metaPageViewLoaded) { return; }
    metaPageViewLoaded = true;
    ensureMetaPixelBase();
    if (typeof fbq !== 'function') { return; }
    fbq('track', 'PageView');
  }

  function loadMarketingTags() {
    if (marketingLoaded) { return; }
    marketingLoaded = true;
    loadGoogleAds();
    loadMetaPageView();
    loadScript('/js/meta-pixel-events.js', true);
  }

  function hideBanner() {
    if (bannerEl) { bannerEl.hidden = true; }
  }

  function showBanner() {
    if (!bannerEl) { buildBanner(); }
    bannerEl.hidden = false;
  }

  function acceptAll() {
    setConsent(true);
    hideBanner();
    loadMarketingTags();
  }

  function rejectNonEssential() {
    setConsent(false);
    hideBanner();
  }

  function buildBanner() {
    bannerEl = document.createElement('div');
    bannerEl.id = 'cuemark-cookie-banner';
    bannerEl.setAttribute('role', 'dialog');
    bannerEl.setAttribute('aria-label', 'Cookie consent');
    bannerEl.innerHTML =
      '<div class="cuemark-cookie-inner">' +
        '<p class="cuemark-cookie-text">' +
          'We use strictly necessary storage to keep you signed in. We use Meta for basic ad measurement, and with your permission we also use Google and richer conversion tags. ' +
          '<a href="/legal/cookies">Cookie Policy</a> · <a href="/legal/privacy">Privacy Policy</a>.' +
        '</p>' +
        '<div class="cuemark-cookie-actions">' +
          '<button type="button" class="cuemark-cookie-btn cuemark-cookie-btn-reject" data-cc-reject>Reject non-essential</button>' +
          '<button type="button" class="cuemark-cookie-btn cuemark-cookie-btn-accept" data-cc-accept>Accept all</button>' +
        '</div>' +
      '</div>';
    bannerEl.querySelector('[data-cc-accept]').addEventListener('click', acceptAll);
    bannerEl.querySelector('[data-cc-reject]').addEventListener('click', rejectNonEssential);
    document.body.appendChild(bannerEl);
  }

  function injectFooterSettingsLink() {
    var footers = document.querySelectorAll('footer');
    for (var i = 0; i < footers.length; i++) {
      var footer = footers[i];
      if (footer.querySelector('[data-cookie-settings]')) { continue; }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cuemark-cookie-settings-link';
      btn.setAttribute('data-cookie-settings', '');
      btn.textContent = 'Cookie settings';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        showBanner();
      });
      var wrap = document.createElement('p');
      wrap.style.marginTop = '0.75rem';
      wrap.appendChild(btn);
      footer.appendChild(wrap);
    }
  }

  function init() {
    loadMetaPageView();
    var consent = getConsent();
    if (consent && consent.marketing) {
      loadMarketingTags();
    } else if (!consent) {
      if (document.body) {
        buildBanner();
      } else {
        document.addEventListener('DOMContentLoaded', buildBanner);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectFooterSettingsLink);
    } else {
      injectFooterSettingsLink();
    }
  }

  global.CuemarkConsent = {
    acceptAll: acceptAll,
    rejectNonEssential: rejectNonEssential,
    openSettings: showBanner,
    hasMarketingConsent: function () {
      var c = getConsent();
      return !!(c && c.marketing);
    },
    loadMarketingTags: loadMarketingTags
  };

  init();
})(typeof window !== 'undefined' ? window : this);
