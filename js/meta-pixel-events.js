/**
 * Cuemark - Meta Pixel standard events (PageView is in the base snippet on each page).
 * @see https://www.facebook.com/business/help/402791146561655
 */
(function (global) {
  'use strict';

  var PLAN_VALUE = {
    GBP: { credits: 4.99, monthly: 12 },
    EUR: { credits: 5.99, monthly: 14 },
    USD: { credits: 5.99, monthly: 15 },
  };

  function track(event, params) {
    if (typeof fbq !== 'function') { return; }
    try {
      if (params && typeof params === 'object') {
        fbq('track', event, params);
      } else {
        fbq('track', event);
      }
    } catch (e) {}
  }

  function trackOnce(storageKey, event, params) {
    try {
      if (sessionStorage.getItem(storageKey)) { return; }
      track(event, params);
      sessionStorage.setItem(storageKey, '1');
    } catch (e) {
      track(event, params);
    }
  }

  function normalizedPath() {
    var path = (global.location.pathname || '/').replace(/\/+$/, '');
    return path || '/';
  }

  function detectCurrency() {
    try {
      if (global.CuemarkPricing && typeof global.CuemarkPricing.detectDisplayCurrency === 'function') {
        return global.CuemarkPricing.detectDisplayCurrency();
      }
    } catch (e) {}
    return 'GBP';
  }

  function planValue(plan) {
    var currency = detectCurrency();
    var row = PLAN_VALUE[currency] || PLAN_VALUE.GBP;
    var key = plan === 'monthly' ? 'monthly' : 'credits';
    return { value: row[key], currency: currency };
  }

  function trackInitiateCheckout(plan, onDone) {
    var v = planValue(plan);
    var params = {
      content_name: plan === 'monthly' ? 'Monthly subscription' : 'Credit pack',
      currency: v.currency,
      value: v.value,
      num_items: 1,
    };
    var done = false;
    function finish() {
      if (done) { return; }
      done = true;
      if (typeof onDone === 'function') { onDone(); }
    }
    if (typeof fbq !== 'function') {
      finish();
      return;
    }
    try {
      global.setTimeout(finish, 800);
      fbq('track', 'InitiateCheckout', params, { eventCallback: finish });
    } catch (e) {
      finish();
    }
  }

  /** After Stripe checkout success (credit pack = Purchase, subscription = Subscribe). */
  function trackCheckoutSuccess(plan, sessionId) {
    if (!plan) { return; }
    var v = planValue(plan);
    var dedupeKey = 'cuemark_px_checkout_' + String(sessionId || plan);
    if (plan === 'monthly') {
      trackOnce(dedupeKey, 'Subscribe', {
        value: String(v.value),
        currency: v.currency,
        predicted_ltv: String(v.value * 6),
      });
      return;
    }
    if (plan === 'credits') {
      trackOnce(dedupeKey, 'Purchase', {
        value: v.value,
        currency: v.currency,
        content_name: 'Credit pack',
      });
    }
  }

  function trackCompleteRegistration(plan) {
    trackOnce('cuemark_px_registration_' + String(plan || 'free'), 'CompleteRegistration', {
      content_name: String(plan || 'free'),
      status: true,
    });
  }

  function trackStartTrial() {
    var currency = detectCurrency();
    trackOnce('cuemark_px_start_trial', 'StartTrial', {
      value: '0.00',
      currency: currency,
      predicted_ltv: '0.00',
    });
  }

  function trackContact() {
    track('Contact');
  }

  function autoViewContent() {
    var path = normalizedPath();
    var map = {
      '/': 'Home',
      '/home': 'Home',
      '/pricing': 'Pricing',
      '/download': 'Download',
      '/signup': 'Sign up',
    };
    if (!map[path]) { return; }
    trackOnce('cuemark_px_view_' + path, 'ViewContent', { content_name: map[path] });
  }

  function autoLoginVerified() {
    if (normalizedPath() !== '/login') { return; }
    var params = new URLSearchParams(global.location.search);
    if (params.get('verified') === '1') {
      trackCompleteRegistration('verified');
    }
  }

  global.CuemarkPixel = {
    track: track,
    trackOnce: trackOnce,
    trackInitiateCheckout: trackInitiateCheckout,
    trackCheckoutSuccess: trackCheckoutSuccess,
    trackCompleteRegistration: trackCompleteRegistration,
    trackStartTrial: trackStartTrial,
    trackContact: trackContact,
    planValue: planValue,
  };

  autoViewContent();
  autoLoginVerified();
})(typeof window !== 'undefined' ? window : this);
