/**
 * Cuemark — Google Ads conversion events (gtag base tag is in each page head).
 */
(function (global) {
  'use strict';

  var PURCHASE_SEND_TO = 'AW-18266783138/BLppCNXavcQcEKL7o4ZE';

  function planValue() {
    try {
      if (global.CuemarkPixel && typeof global.CuemarkPixel.planValue === 'function') {
        return global.CuemarkPixel.planValue('credits');
      }
    } catch (e) {}
    return { value: 4.99, currency: 'GBP' };
  }

  /** Credit pack purchase after Stripe return (/account?session_id=…). */
  function trackPurchaseConversion(plan, transactionId) {
    if (plan !== 'credits' || !transactionId) { return; }
    if (global.CuemarkConsent && !global.CuemarkConsent.hasMarketingConsent()) { return; }
    if (typeof gtag !== 'function') { return; }

    var dedupeKey = 'cuemark_gads_purchase_' + String(transactionId);
    try {
      if (sessionStorage.getItem(dedupeKey)) { return; }
    } catch (e) {}

    var v = planValue();
    try {
      gtag('event', 'conversion', {
        send_to: PURCHASE_SEND_TO,
        value: v.value,
        currency: v.currency,
        transaction_id: String(transactionId),
      });
      try {
        sessionStorage.setItem(dedupeKey, '1');
      } catch (e2) {}
    } catch (e3) {}
  }

  global.CuemarkGoogleAds = {
    trackPurchaseConversion: trackPurchaseConversion,
  };
})(typeof window !== 'undefined' ? window : this);
