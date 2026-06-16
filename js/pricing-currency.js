(function (global) {
  const CUEMARK_PRICES = {
    GBP: { sym: '£', name: 'British pounds', code: 'GBP', credits: { whole: '4', dec: '.99' }, monthly: '12' },
    EUR: { sym: '€', name: 'euros', code: 'EUR', credits: { whole: '5', dec: '.99' }, monthly: '14' },
    USD: { sym: '$', name: 'US dollars', code: 'USD', credits: { whole: '5', dec: '.99' }, monthly: '15' },
  };

  const EUR_LANGS = new Set([
    'de', 'fr', 'es', 'it', 'nl', 'pt', 'pl', 'fi', 'sv', 'da', 'no', 'cs', 'sk', 'hu', 'ro',
    'el', 'hr', 'sl', 'et', 'lv', 'lt', 'mt', 'ga', 'eu', 'lb',
  ]);
  const EUR_REGIONS = new Set([
    'at', 'be', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'ie', 'fi', 'gr', 'sk', 'si', 'ee', 'lv',
    'lt', 'lu', 'mt', 'cy', 'hr', 'sl',
  ]);

  function detectDisplayCurrency() {
    const langs = navigator.languages?.length ? [...navigator.languages] : [navigator.language || 'en-GB'];

    for (const raw of langs) {
      const loc = (raw || '').toLowerCase();
      if (loc.endsWith('-us') || loc === 'en-us') return 'USD';
      if (loc.endsWith('-ca')) return 'USD';
    }

    for (const raw of langs) {
      const loc = (raw || '').toLowerCase();
      const parts = loc.split('-');
      const lang = parts[0];
      const region = parts[1];
      if (region === 'gb' || region === 'uk') return 'GBP';
      if (EUR_LANGS.has(lang)) return 'EUR';
      if (region && EUR_REGIONS.has(region)) return 'EUR';
    }

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz.startsWith('America/')) return 'USD';
      if (tz.startsWith('Europe/') && tz !== 'Europe/London') return 'EUR';
    } catch (e) {}

    return 'GBP';
  }

  function applyPricingPage(currency) {
    const p = CUEMARK_PRICES[currency] || CUEMARK_PRICES.GBP;
    ['free', 'credits', 'monthly'].forEach((t) => {
      const sym = document.getElementById('sym-' + t);
      if (sym) sym.textContent = p.sym;
    });
    const pf = document.getElementById('price-free');
    if (pf) pf.textContent = '0';
    const pc = document.getElementById('price-credits');
    if (pc) pc.textContent = p.credits.whole;
    const pcd = document.getElementById('price-credits-dec');
    if (pcd) pcd.textContent = p.credits.dec;
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
