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

  function detectDisplayCurrency() {
    // Timezone reflects where the user actually is - prefer over browser language
    // (many UK machines still report en-US in navigator.languages).
    const tzCurrency = currencyFromTimezone(getTimezone());
    if (tzCurrency) return tzCurrency;

    const langs = navigator.languages?.length ? [...navigator.languages] : [navigator.language || 'en-GB'];

    for (const raw of langs) {
      const loc = (raw || '').toLowerCase();
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

  function applyPricingPage(currency) {
    const p = CUEMARK_PRICES[currency] || CUEMARK_PRICES.GBP;
    ['free', 'credits', 'credits-150', 'monthly'].forEach((t) => {
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
    const pm = document.getElementById('price-monthly');
    if (pm) pm.textContent = p.monthly;
    const note = document.getElementById('currency-note');
    if (note) {
      note.textContent = 'Prices shown in ' + p.name + ' (' + p.code + '). Stripe checkout uses the same currency for your region.';
    }
    return p.code;
  }

  function applyHomePricing(currency) {
    const p = CUEMARK_PRICES[currency] || CUEMARK_PRICES.GBP;
    document.querySelectorAll('[data-home-price]').forEach((el) => {
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
    detectDisplayCurrency,
    applyPricingPage,
    applyHomePricing,
    applySignupPlans,
  };
})(typeof window !== 'undefined' ? window : globalThis);
