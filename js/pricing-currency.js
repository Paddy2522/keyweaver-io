(function (global) {
  const CUEMARK_PRICES = {
    GBP: {
      sym: '£', name: 'British pounds', code: 'GBP',
      credits: { whole: '4', dec: '.99' },
      credits_150: { whole: '9', dec: '.99' },
      credits_500: { whole: '24', dec: '.99' },
      monthly: '12',
      monthly_pro: '29',
      annual: '120',
      annual_pro: '290',
    },
    EUR: {
      sym: '€', name: 'euros', code: 'EUR',
      credits: { whole: '5', dec: '.99' },
      credits_150: { whole: '11', dec: '.99' },
      credits_500: { whole: '29', dec: '.99' },
      monthly: '14',
      monthly_pro: '34',
      annual: '140',
      annual_pro: '340',
    },
    USD: {
      sym: '$', name: 'US dollars', code: 'USD',
      credits: { whole: '5', dec: '.99' },
      credits_150: { whole: '11', dec: '.99' },
      credits_500: { whole: '29', dec: '.99' },
      monthly: '15',
      monthly_pro: '35',
      annual: '150',
      annual_pro: '350',
    },
  };

  /** ISO country → display currency (matches Stripe multi-currency prices). */
  const COUNTRY_CURRENCY = {
    GB: 'GBP', UK: 'GBP', IM: 'GBP', JE: 'GBP', GG: 'GBP',
    US: 'USD', CA: 'USD',
    AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR',
    FI: 'EUR', FR: 'EUR', GR: 'EUR', HR: 'EUR', IE: 'EUR', IT: 'EUR',
    LT: 'EUR', LU: 'EUR', LV: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR',
    SI: 'EUR', SK: 'EUR',
  };

  /** Non-euro Europe — show EUR (closest of our three Stripe currencies). */
  const EUROPE_EUR_FALLBACK = new Set([
    'AL', 'AD', 'BA', 'BG', 'BY', 'CH', 'CZ', 'DK', 'FO', 'GI', 'GL', 'HU',
    'IS', 'LI', 'MC', 'MD', 'ME', 'MK', 'NO', 'PL', 'RO', 'RS', 'SE', 'SM',
    'UA', 'VA', 'XK',
  ]);

  const EUR_LANGS = new Set([
    'de', 'fr', 'es', 'it', 'nl', 'pt', 'pl', 'fi', 'sv', 'da', 'no', 'cs', 'sk', 'hu', 'ro',
    'el', 'hr', 'sl', 'et', 'lv', 'lt', 'mt', 'ga', 'eu', 'lb',
  ]);
  const EUR_REGIONS = new Set([
    'at', 'be', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'ie', 'fi', 'gr', 'sk', 'si', 'ee', 'lv',
    'lt', 'lu', 'mt', 'cy', 'hr', 'sl',
  ]);

  const UK_TIMEZONES = new Set([
    'Europe/London',
    'Europe/Belfast',
    'Europe/Guernsey',
    'Europe/Isle_of_Man',
    'Europe/Jersey',
  ]);

  function getTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {
      return '';
    }
  }

  function currencyFromTimezone(tz) {
    if (!tz) return null;
    if (UK_TIMEZONES.has(tz)) return 'GBP';
    if (tz.startsWith('America/')) return 'USD';
    if (tz.startsWith('Europe/')) return 'EUR';
    return null;
  }

  function currencyFromCountry(code) {
    if (!code) return null;
    const c = String(code).toUpperCase();
    if (c === 'XX' || c === 'T1') return null;
    if (COUNTRY_CURRENCY[c]) return COUNTRY_CURRENCY[c];
    if (EUROPE_EUR_FALLBACK.has(c)) return 'EUR';
    // Rest of world → USD (Stripe multi-currency display)
    return 'USD';
  }

  function detectDisplayCurrency() {
    // Sync fallback: timezone, then browser language
    const tzCurrency = currencyFromTimezone(getTimezone());
    if (tzCurrency) return tzCurrency;

    const langs = navigator.languages && navigator.languages.length
      ? Array.prototype.slice.call(navigator.languages)
      : [navigator.language || 'en-GB'];

    for (var i = 0; i < langs.length; i++) {
      const loc = (langs[i] || '').toLowerCase();
      const parts = loc.split('-');
      const lang = parts[0];
      const region = parts[1];
      if (region === 'gb' || region === 'uk') return 'GBP';
      if (region === 'us' || region === 'ca') return 'USD';
      if (EUR_LANGS.has(lang)) return 'EUR';
      if (region && EUR_REGIONS.has(region)) return 'EUR';
    }

    return 'GBP';
  }

  /**
   * Prefer Cloudflare IP country (where the visitor actually is),
   * then fall back to timezone / locale.
   */
  function detectDisplayCurrencyAsync() {
    var fallback = detectDisplayCurrency();
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;

    var fetchPromise = fetch('/cdn-cgi/trace', {
      cache: 'no-store',
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        if (!res.ok) throw new Error('trace ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var m = /(?:^|\n)loc=([A-Za-z]{2})(?:\n|$)/.exec(text);
        if (!m) return fallback;
        return currencyFromCountry(m[1]) || fallback;
      })
      .catch(function () {
        return fallback;
      });

    var timeoutPromise = new Promise(function (resolve) {
      timer = setTimeout(function () {
        if (controller) {
          try { controller.abort(); } catch (e) {}
        }
        resolve(fallback);
      }, 1800);
    });

    return Promise.race([fetchPromise, timeoutPromise]).then(function (code) {
      if (timer) clearTimeout(timer);
      return code;
    });
  }

  function applyPricingPage(currency) {
    const p = CUEMARK_PRICES[currency] || CUEMARK_PRICES.GBP;
    ['free', 'credits', 'credits-150', 'credits-500', 'sub-standard', 'sub-pro'].forEach(function (t) {
      const sym = document.getElementById('sym-' + t);
      if (sym) sym.textContent = p.sym;
    });
    const pf = document.getElementById('price-free');
    if (pf) pf.textContent = '0';
    const pc = document.getElementById('price-credits');
    if (pc) pc.textContent = p.credits.whole;
    const pcd = document.getElementById('price-credits-dec');
    if (pcd) pcd.textContent = p.credits.dec;
    const pc150 = document.getElementById('price-credits-150');
    if (pc150) pc150.textContent = p.credits_150.whole;
    const pc150d = document.getElementById('price-credits-150-dec');
    if (pc150d) pc150d.textContent = p.credits_150.dec;
    const pc500 = document.getElementById('price-credits-500');
    if (pc500) pc500.textContent = p.credits_500.whole;
    const pc500d = document.getElementById('price-credits-500-dec');
    if (pc500d) pc500d.textContent = p.credits_500.dec;
    const note = document.getElementById('currency-note');
    if (note) {
      note.textContent =
        'Prices shown in ' + p.name + ' (' + p.code +
        '). Based on your location. Stripe checkout uses the same currency for your region.';
    }
    return p.code;
  }

  function applyHomePricing(currency) {
    const p = CUEMARK_PRICES[currency] || CUEMARK_PRICES.GBP;
    document.querySelectorAll('[data-home-price]').forEach(function (el) {
      const kind = el.dataset.homePrice;
      const sym = el.querySelector('[data-price-sym]');
      if (sym) sym.textContent = p.sym;
      if (kind === 'free') {
        const val = el.querySelector('[data-price-val]');
        if (val) val.textContent = '0';
      } else if (kind === 'credits') {
        const whole = el.querySelector('[data-price-whole]');
        const dec = el.querySelector('[data-price-dec]');
        if (whole) whole.textContent = p.credits.whole;
        if (dec) dec.textContent = p.credits.dec;
      } else if (kind === 'monthly') {
        const val = el.querySelector('[data-price-val]');
        if (val) val.textContent = p.monthly;
      }
    });
    const note = document.getElementById('home-currency-note');
    if (note) {
      note.innerHTML =
        'Prices shown in ' + p.code +
        ' · <a href="/pricing" style="color:var(--muted); text-decoration:underline; text-underline-offset:3px;">Full pricing details</a>';
    }
    return p.code;
  }

  function applySignupPlans(currency) {
    const p = CUEMARK_PRICES[currency] || CUEMARK_PRICES.GBP;
    const credits = document.getElementById('signup-price-credits');
    if (credits) credits.innerHTML = p.sym + p.credits.whole + p.credits.dec + '<small>one-time</small>';
    const monthly = document.getElementById('signup-price-monthly');
    if (monthly) monthly.innerHTML = p.sym + p.monthly + '<small>per month</small>';
    return p.code;
  }

  global.CuemarkPricing = {
    PRICES: CUEMARK_PRICES,
    detectDisplayCurrency: detectDisplayCurrency,
    detectDisplayCurrencyAsync: detectDisplayCurrencyAsync,
    currencyFromCountry: currencyFromCountry,
    applyPricingPage: applyPricingPage,
    applyHomePricing: applyHomePricing,
    applySignupPlans: applySignupPlans,
  };
})(typeof window !== 'undefined' ? window : globalThis);
