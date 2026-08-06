(function () {
  'use strict';

  var STORAGE_KEY = 'keyweaver.videoSeo.lastBrief';
  var CKIT_KEY = 'keyweaver.campaignKit.lastBrief';
  var SHOT_KEY = 'keyweaver.shotList.lastBrief';
  var Auth = window.KeyweaverToolsAuth;
  var BACKEND = (Auth && Auth.BACKEND) || 'https://keyweaver-backend.vercel.app';
  /** Must match .backend-checkout/lib/video-seo-policy.ts */
  var AI_CREDITS = 2;
  var FREE_LIMIT = 2;
  /** @type {{ remaining: number, total: number, paidRemaining: number, hasPaid: boolean, freeRemaining: number, freeUsed: number } | null} */
  var creditsState = null;
  var activeTab = '';

  var PLATFORM_META = {
    youtube: { label: 'YouTube', sub: 'Titles under ~70 chars. Hook the description in the first two lines.' },
    tiktok: { label: 'TikTok', sub: 'Hook first. Keep hashtags light and relevant.' },
    instagram: { label: 'Instagram', sub: 'Skimmable caption. Hashtags optional.' },
    facebook: { label: 'Facebook', sub: 'Lead with the outcome for people skimming the feed.' }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function getToken() {
    if (Auth && Auth.getToken) return Auth.getToken();
    try {
      return localStorage.getItem('cc_token') || '';
    } catch (e) {
      return '';
    }
  }

  function loginHref() {
    return Auth && Auth.loginUrl ? Auth.loginUrl('/video-seo') : '/login?next=/video-seo';
  }

  function cleanText(s) {
    return String(s || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function selectedPlatforms() {
    return ['youtube', 'tiktok', 'instagram', 'facebook'].filter(function (p) {
      var el = $('plat-' + p);
      return el && el.checked;
    });
  }

  function readForm() {
    return {
      brief: cleanText($('vseo-brief').value),
      keywords: cleanText($('vseo-keywords').value),
      tone: $('vseo-tone').value || 'educational',
      cta: $('vseo-cta').value || 'none',
      outline: cleanText($('vseo-outline').value),
      platforms: selectedPlatforms()
    };
  }

  function saveForm(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        brief: data.brief,
        keywords: data.keywords,
        tone: data.tone,
        cta: data.cta,
        outline: data.outline,
        platforms: data.platforms
      }));
    } catch (e) { /* ignore */ }
  }

  function loadForm() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data.brief) $('vseo-brief').value = data.brief;
        if (data.keywords) $('vseo-keywords').value = data.keywords;
        if (data.tone) $('vseo-tone').value = data.tone;
        if (data.cta) $('vseo-cta').value = data.cta;
        if (data.outline) $('vseo-outline').value = data.outline;
        if (Array.isArray(data.platforms) && data.platforms.length) {
          ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
            var el = $('plat-' + p);
            if (el) el.checked = data.platforms.indexOf(p) !== -1;
          });
        }
        return;
      }
      var ckit = JSON.parse(localStorage.getItem(CKIT_KEY) || 'null');
      var shot = JSON.parse(localStorage.getItem(SHOT_KEY) || 'null');
      var handoff = '';
      var source = '';
      if (ckit && ckit.brief) {
        handoff = ckit.brief;
        source = 'Campaign Kit';
      } else if (shot && shot.concept) {
        handoff = shot.concept;
        source = 'Shot List';
      }
      if (handoff) {
        $('vseo-brief').value = handoff;
        var note = document.createElement('div');
        note.className = 'vseo-note';
        note.setAttribute('role', 'status');
        note.innerHTML =
          'Prefilling from your last <a href="/' +
          (source === 'Shot List' ? 'shot-list' : 'campaign-kit') +
          '">' +
          source +
          '</a> brief.';
        var hero = document.querySelector('.vseo-hero');
        if (hero) hero.appendChild(note);
      }
    } catch (e) { /* ignore */ }
  }

  function purchaseLinksHtml() {
    return (
      '<span class="tools-inline-cta">' +
      '<a href="/pricing">Buy credits</a>' +
      '<a href="/account">Account</a>' +
      '</span>'
    );
  }

  function setFormError(msg, allowHtml, kind) {
    var err = $('vseo-error');
    if (!err) return;
    if (allowHtml) err.innerHTML = msg || '';
    else err.textContent = msg || '';
    err.classList.toggle('is-visible', !!msg);
    err.classList.toggle('is-ok', kind === 'ok');
  }

  function setLoading(on) {
    var loading = $('vseo-loading');
    var empty = $('vseo-empty');
    if (loading) loading.hidden = !on;
    if (on && empty) empty.classList.add('is-hidden');
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.dataset.prevLabel = btn.textContent;
      btn.textContent = label || 'Generating…';
      btn.classList.add('is-busy');
      btn.disabled = true;
    } else {
      if (btn.dataset.prevLabel) btn.textContent = btn.dataset.prevLabel;
      delete btn.dataset.prevLabel;
      btn.classList.remove('is-busy');
      btn.disabled = false;
      syncGenerateButton();
    }
  }

  function freeRemaining() {
    if (!creditsState) return null;
    return Math.max(0, Number(creditsState.freeRemaining || 0));
  }

  function nextCostLabel() {
    var free = freeRemaining();
    if (free == null) return '…';
    if (free > 0) {
      return free + ' free left';
    }
    return AI_CREDITS + ' credits';
  }

  function canGenerate() {
    if (!getToken()) return { ok: false, reason: 'signin' };
    if (!creditsState) return { ok: false, reason: 'loading' };
    var free = freeRemaining();
    if (free > 0) return { ok: true, reason: 'free' };
    if (creditsState.paidRemaining >= AI_CREDITS) return { ok: true, reason: 'paid' };
    return { ok: false, reason: 'paywall' };
  }

  function syncCreditActions() {
    var token = getToken();
    var paidRemaining =
      token && creditsState ? creditsState.paidRemaining : token ? null : 0;
    var free = freeRemaining();
    var showBuy =
      !!token &&
      creditsState &&
      free === 0 &&
      creditsState.paidRemaining < AI_CREDITS;

    if (Auth && Auth.syncCreditActions) {
      Auth.syncCreditActions({
        signin: $('vseo-credits-signin'),
        buy: $('vseo-credits-buy'),
        account: $('vseo-credits-account'),
        nextPath: '/video-seo',
        signedIn: !!token,
        paidRemaining: showBuy ? 0 : paidRemaining,
        signinLabel: 'Sign in'
      });
    } else {
      var signin = $('vseo-credits-signin');
      var buy = $('vseo-credits-buy');
      var account = $('vseo-credits-account');
      if (signin) {
        signin.hidden = !!token;
        if (!token) signin.href = loginHref();
      }
      if (buy) {
        buy.hidden = false;
        buy.className = showBuy ? 'btn btn-primary' : 'btn btn-ghost';
      }
      if (account) account.hidden = !token;
    }

    var paywall = $('vseo-paywall');
    if (paywall) {
      paywall.hidden = !(token && creditsState && free === 0 && creditsState.paidRemaining < AI_CREDITS);
    }
  }

  function syncGenerateButton() {
    var btn = $('vseo-generate');
    var note = $('vseo-cost-note');
    var gate = canGenerate();
    if (btn && !btn.classList.contains('is-busy')) {
      var label = 'Generate';
      if (getToken() && creditsState) {
        var free = freeRemaining();
        if (free > 0) {
          label = 'Generate · ' + free + ' free left';
        } else if (creditsState.paidRemaining >= AI_CREDITS) {
          label = 'Generate · ' + AI_CREDITS + ' credits';
        } else {
          label = 'Generate · buy credits';
        }
      }
      btn.textContent = label;
      btn.disabled = !gate.ok;
      btn.classList.toggle('is-disabled', !gate.ok);
    }
    if (note) {
      if (!getToken()) {
        note.innerHTML =
          'Sign in for <strong>2 free</strong> AI generations. After that, ' +
          AI_CREDITS +
          ' purchased credits each. <a href="' +
          loginHref() +
          '">Sign in</a>';
      } else if (!creditsState) {
        note.textContent = 'Checking your free gens and credits…';
      } else if (gate.reason === 'paywall') {
        note.innerHTML =
          'Free gens used. Next generate costs ' +
          AI_CREDITS +
          ' purchased credits. ' +
          purchaseLinksHtml();
      } else if (gate.reason === 'free') {
        note.textContent =
          freeRemaining() +
          ' free AI generation' +
          (freeRemaining() === 1 ? '' : 's') +
          ' left on this account.';
      } else {
        note.textContent =
          'Next generate: ' +
          AI_CREDITS +
          ' purchased credits (you have ' +
          creditsState.paidRemaining +
          ').';
      }
    }
  }

  function updateCreditsPanel() {
    var bal = $('vseo-balance');
    var meter = $('vseo-credit-meter');
    var freeEl = $('vseo-free-value');
    var paidEl = $('vseo-paid-value');
    var nextEl = $('vseo-next-cost');
    var token = getToken();
    syncCreditActions();
    if (!token) {
      creditsState = null;
      if (meter) meter.hidden = true;
      if (bal) {
        bal.className = 'tools-credit-status is-warn';
        bal.textContent = 'Sign in to unlock 2 free AI generations.';
      }
      syncGenerateButton();
      return;
    }
    if (bal) {
      bal.className = 'tools-credit-status';
      bal.textContent = 'Checking balance…';
    }

    function apply(snap) {
      if (!bal) return;
      if (!snap || !snap.ok) {
        creditsState = null;
        if (meter) meter.hidden = true;
        if (snap && snap.unauthorized) {
          bal.className = 'tools-credit-status is-warn';
          bal.innerHTML =
            'Session expired. <a href="' + loginHref() + '">Sign in</a> again.';
        } else {
          bal.className = 'tools-credit-status is-err';
          bal.innerHTML =
            'Could not load credits. Try <a href="/account">Account</a> or refresh.';
        }
        syncCreditActions();
        syncGenerateButton();
        return;
      }

      var freeRem =
        snap.raw && snap.raw.video_seo_free_remaining != null
          ? Number(snap.raw.video_seo_free_remaining)
          : FREE_LIMIT;
      var freeUsed =
        snap.raw && snap.raw.video_seo_free_used != null
          ? Number(snap.raw.video_seo_free_used)
          : Math.max(0, FREE_LIMIT - freeRem);

      creditsState = {
        remaining: snap.remaining,
        total: snap.total,
        paidRemaining: snap.paidRemaining,
        hasPaid: snap.hasPaid,
        freeRemaining: freeRem,
        freeUsed: freeUsed
      };

      if (meter) meter.hidden = false;
      if (freeEl) {
        freeEl.textContent = String(freeRem) + ' / ' + FREE_LIMIT;
        freeEl.classList.toggle('is-zero', freeRem <= 0);
        freeEl.classList.toggle('is-ok', freeRem > 0);
      }
      if (paidEl) {
        paidEl.textContent = String(snap.paidRemaining);
        paidEl.classList.toggle('is-zero', snap.paidRemaining <= 0);
        paidEl.classList.toggle('is-ok', snap.paidRemaining > 0);
      }
      if (nextEl) {
        nextEl.textContent = nextCostLabel();
        nextEl.classList.toggle('is-ok', freeRem > 0 || snap.paidRemaining >= AI_CREDITS);
        nextEl.classList.toggle('is-zero', freeRem <= 0 && snap.paidRemaining < AI_CREDITS);
      }

      if (freeRem > 0) {
        bal.className = 'tools-credit-status is-ok';
        bal.textContent =
          freeRem +
          ' free AI generation' +
          (freeRem === 1 ? '' : 's') +
          ' left. After that, ' +
          AI_CREDITS +
          ' purchased credits each.';
      } else if (snap.paidRemaining >= AI_CREDITS) {
        bal.className = 'tools-credit-status is-ok';
        bal.textContent =
          'Free gens used. Ready to generate for ' +
          AI_CREDITS +
          ' purchased credits (' +
          snap.paidRemaining +
          ' available).';
      } else {
        bal.className = 'tools-credit-status is-warn';
        bal.innerHTML =
          'Free gens used and no purchased credits. ' + purchaseLinksHtml();
      }
      syncCreditActions();
      syncGenerateButton();
    }

    if (Auth && Auth.fetchCredits) {
      Auth.fetchCredits().then(apply);
      return;
    }
    fetch(BACKEND + '/api/captio/credits', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (r) {
        if (r.status === 401) {
          try { localStorage.removeItem('cc_token'); } catch (e) { /* ignore */ }
          return { ok: false, unauthorized: true };
        }
        return r.ok
          ? r.json().then(function (data) {
              var paid = Number(data.paid_credits_remaining != null ? data.paid_credits_remaining : 0);
              return {
                ok: true,
                remaining: Number(data.credits_remaining || 0),
                total: Number(data.credits_total || 0),
                paidRemaining: paid,
                hasPaid: paid > 0 || !!data.has_paid_credits,
                raw: data
              };
            })
          : { ok: false, unauthorized: false };
      })
      .then(apply)
      .catch(function () {
        apply({ ok: false, unauthorized: false });
      });
  }

  function meterClass(len, soft, hard) {
    if (len > hard) return 'is-over';
    if (len > soft) return 'is-warn';
    return '';
  }

  function fieldBlock(opts) {
    var wrap = document.createElement('div');
    wrap.className = 'vseo-field-out';
    var head = document.createElement('div');
    head.className = 'vseo-field-out-head';
    var lab = document.createElement('label');
    lab.textContent = opts.label;
    var right = document.createElement('div');
    right.className = 'vseo-copy-row';
    var meter = document.createElement('span');
    meter.className = 'vseo-meter';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vseo-copy';
    btn.textContent = 'Copy';
    right.appendChild(meter);
    right.appendChild(btn);
    head.appendChild(lab);
    head.appendChild(right);

    var input;
    if (opts.multiline) {
      input = document.createElement('textarea');
      input.rows = opts.rows || 5;
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }
    input.value = opts.value || '';
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.setAttribute('aria-label', opts.label);

    function updateMeter() {
      var len = input.value.length;
      meter.textContent = len + (opts.limit ? ' / ~' + opts.limit : '');
      meter.className = 'vseo-meter ' + meterClass(len, opts.soft || opts.limit || 9999, opts.limit || 99999);
    }
    input.addEventListener('input', updateMeter);
    updateMeter();

    btn.addEventListener('click', function () {
      copyText(input.value, btn);
    });

    wrap.appendChild(head);
    if (opts.tip) {
      var tip = document.createElement('p');
      tip.className = 'vseo-field-tip';
      tip.textContent = opts.tip;
      wrap.appendChild(tip);
    }
    wrap.appendChild(input);
    wrap._getValue = function () { return input.value; };
    return wrap;
  }

  function copyText(text, btn) {
    var done = function () {
      var prev = btn.textContent;
      btn.textContent = 'Copied';
      btn.classList.add('is-done');
      setTimeout(function () {
        btn.textContent = prev;
        btn.classList.remove('is-done');
      }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function selectTab(id) {
    activeTab = id;
    document.querySelectorAll('.vseo-tab').forEach(function (tab) {
      var on = tab.getAttribute('data-platform') === id;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.vseo-panel').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.id === 'panel-' + id);
    });
    var extras = $('vseo-extras');
    if (extras) extras.hidden = id !== 'youtube' || !extras.dataset.hasContent;
  }

  function buildPanel(id, fields, copyAllText) {
    var meta = PLATFORM_META[id];
    var panel = document.createElement('div');
    panel.className = 'vseo-panel';
    panel.id = 'panel-' + id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tab-' + id);

    var head = document.createElement('div');
    head.className = 'vseo-panel-head';
    var h3 = document.createElement('h3');
    h3.textContent = meta.label;
    var copyAll = document.createElement('button');
    copyAll.type = 'button';
    copyAll.className = 'vseo-copy';
    copyAll.textContent = 'Copy all';
    head.appendChild(h3);
    head.appendChild(copyAll);
    panel.appendChild(head);

    var sub = document.createElement('p');
    sub.className = 'plat-sub';
    sub.textContent = meta.sub;
    panel.appendChild(sub);

    var blocks = [];
    fields.forEach(function (f) {
      var b = fieldBlock(f);
      blocks.push(b);
      panel.appendChild(b);
    });

    copyAll.addEventListener('click', function () {
      copyText(typeof copyAllText === 'function' ? copyAllText(blocks) : copyAllText, copyAll);
    });

    return panel;
  }

  function renderResults(data, copy) {
    var host = $('vseo-results-body');
    var tabs = $('vseo-tabs');
    var extras = $('vseo-extras-body');
    var extrasWrap = $('vseo-extras');
    var empty = $('vseo-empty');
    host.innerHTML = '';
    tabs.innerHTML = '';
    if (extras) extras.innerHTML = '';
    if (empty) empty.classList.add('is-hidden');
    $('vseo-results').classList.add('is-visible');

    var platforms = data.platforms.filter(function (p) {
      return !!copy[p];
    });
    if (!platforms.length) platforms = data.platforms.slice();

    var first = platforms[0] || 'youtube';
    var hasYtExtras = false;

    platforms.forEach(function (p) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'vseo-tab';
      tab.id = 'tab-' + p;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('data-platform', p);
      tab.textContent = PLATFORM_META[p].label;
      tab.addEventListener('click', function () {
        selectTab(p);
      });
      tabs.appendChild(tab);

      if (p === 'youtube' && copy.youtube) {
        var yt = copy.youtube;
        var titles = yt.titles && yt.titles.length ? yt.titles.slice(0, 3) : [''];
        while (titles.length < 3) titles.push('');
        host.appendChild(
          buildPanel(
            'youtube',
            [
              {
                label: 'Title option A',
                value: titles[0],
                tip: 'Curiosity + benefit. Not a synopsis.',
                limit: 70,
                soft: 60
              },
              {
                label: 'Title option B',
                value: titles[1],
                tip: 'Alternate angle or keyword-forward option.',
                limit: 70,
                soft: 60
              },
              {
                label: 'Title option C',
                value: titles[2],
                tip: 'Shorter punchy option for mobile truncation.',
                limit: 70,
                soft: 60
              },
              {
                label: 'Description',
                value: yt.description || '',
                tip: 'Hook in the first 1-2 lines.',
                multiline: true,
                rows: 10,
                limit: 5000,
                soft: 3000
              },
              {
                label: 'Tags',
                value: yt.tags || '',
                tip: 'Comma-separated. Mix broad + specific.',
                multiline: true,
                rows: 2,
                limit: 500,
                soft: 400
              }
            ],
            function (blocks) {
              return blocks
                .map(function (b) { return b._getValue(); })
                .filter(Boolean)
                .join('\n\n');
            }
          )
        );
        if (extras) {
          if (yt.pinned) {
            extras.appendChild(
              fieldBlock({
                label: 'Pinned comment',
                value: yt.pinned,
                multiline: true,
                rows: 3,
                limit: 400,
                soft: 280
              })
            );
            hasYtExtras = true;
          }
          if (yt.chapters) {
            extras.appendChild(
              fieldBlock({
                label: 'Chapters',
                value: yt.chapters,
                multiline: true,
                rows: 6,
                limit: 2000,
                soft: 1200
              })
            );
            hasYtExtras = true;
          }
          (yt.thumbs || []).slice(0, 3).forEach(function (t, i) {
            extras.appendChild(
              fieldBlock({
                label: 'Thumb text ' + String.fromCharCode(65 + i),
                value: t,
                tip: 'Keep under ~6 words.',
                limit: 28,
                soft: 22
              })
            );
            hasYtExtras = true;
          });
        }
      } else if ((p === 'tiktok' || p === 'instagram') && copy[p]) {
        var short = copy[p];
        host.appendChild(
          buildPanel(
            p,
            [
              {
                label: 'Caption',
                value: short.caption || '',
                multiline: true,
                rows: 6,
                limit: p === 'tiktok' ? 2200 : 2100,
                soft: 400
              },
              {
                label: 'Hashtags',
                value: short.hashtags || '',
                multiline: true,
                rows: 2,
                limit: 300,
                soft: 200
              }
            ],
            function (blocks) {
              return blocks
                .map(function (b) { return b._getValue(); })
                .filter(Boolean)
                .join('\n\n');
            }
          )
        );
      } else if (p === 'facebook' && copy.facebook) {
        host.appendChild(
          buildPanel(
            'facebook',
            [
              {
                label: 'Post text',
                value: copy.facebook.post || '',
                multiline: true,
                rows: 7,
                limit: 1800,
                soft: 600
              }
            ],
            function (blocks) {
              return blocks[0] ? blocks[0]._getValue() : '';
            }
          )
        );
      }
    });

    if (extrasWrap) {
      extrasWrap.dataset.hasContent = hasYtExtras ? '1' : '';
      extrasWrap.hidden = !hasYtExtras || first !== 'youtube';
    }

    selectTab(first);
    $('vseo-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function validateForm(data) {
    if (!data.brief || data.brief.length < 12) {
      setFormError('Add a short video brief (at least a sentence).');
      $('vseo-brief').focus();
      return false;
    }
    if (!data.platforms.length) {
      setFormError('Select at least one platform.');
      return false;
    }
    setFormError('');
    return true;
  }

  function resetTurnstile() {
    if (window.CuemarkTurnstile) {
      CuemarkTurnstile.reset('vseo-turnstile');
    }
  }

  function generate() {
    var data = readForm();
    if (!validateForm(data)) return;

    var gate = canGenerate();
    if (!gate.ok) {
      if (gate.reason === 'signin') {
        setFormError(
          'Sign in for 2 free AI generations. <a href="' + loginHref() + '">Sign in</a>',
          true
        );
      } else if (gate.reason === 'paywall') {
        setFormError(
          'Free generations used. Next generate costs ' +
            AI_CREDITS +
            ' purchased credits. ' +
            purchaseLinksHtml(),
          true
        );
        var paywall = $('vseo-paywall');
        if (paywall) paywall.hidden = false;
      } else {
        setFormError('Checking your balance…');
      }
      updateCreditsPanel();
      return;
    }

    var btn = $('vseo-generate');
    setBusy(btn, true, 'Generating…');
    setLoading(true);
    setFormError('');
    saveForm(data);

    var run = function (turnstileToken) {
      fetch(BACKEND + '/api/video-seo/generate', {
        method: 'POST',
        headers: Auth && Auth.authHeaders
          ? Auth.authHeaders()
          : {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + getToken()
            },
        body: JSON.stringify({
          brief: data.brief,
          keywords: data.keywords,
          tone: data.tone,
          cta: data.cta,
          outline: data.outline,
          platforms: data.platforms,
          turnstile_token: turnstileToken || undefined
        })
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { res: res, data: body };
          });
        })
        .then(function (x) {
          setBusy(btn, false);
          setLoading(false);
          resetTurnstile();

          if (x.res.status === 503 && x.data && x.data.reason === 'provider_not_configured') {
            setFormError('AI is temporarily unavailable. Try again shortly.');
            return;
          }
          if (x.res.status === 401) {
            if (Auth && Auth.clearToken) Auth.clearToken();
            creditsState = null;
            setFormError(
              'Session expired. <a href="' + loginHref() + '">Sign in</a> again.',
              true
            );
            updateCreditsPanel();
            return;
          }
          if (x.res.status === 429) {
            setFormError('Too many requests. Wait a bit and try again.');
            return;
          }
          if (x.res.status === 400) {
            setFormError((x.data && x.data.error) || 'Security check failed. Refresh and try again.');
            return;
          }
          if (x.res.status === 402) {
            var need = x.data && x.data.credits_required != null ? x.data.credits_required : AI_CREDITS;
            var paidLeft =
              x.data && x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : 0;
            setFormError(
              'Free gens used. Need ' +
                need +
                ' purchased credits (you have ' +
                paidLeft +
                '). ' +
                purchaseLinksHtml(),
              true
            );
            var pw = $('vseo-paywall');
            if (pw) pw.hidden = false;
            updateCreditsPanel();
            return;
          }

          var results = (x.data && (x.data.results || x.data.copy)) || null;
          if (!x.res.ok || !results) {
            setFormError((x.data && x.data.error) || 'Generate failed. No charge if it failed.');
            return;
          }

          renderResults(data, results);

          if (x.data.free_remaining != null && creditsState) {
            creditsState.freeRemaining = Number(x.data.free_remaining);
          }
          if (x.data.paid_credits_remaining != null && creditsState) {
            creditsState.paidRemaining = Number(x.data.paid_credits_remaining);
          }

          var usedFree = !!x.data.used_free;
          var charged = x.data.credits_charged != null ? x.data.credits_charged : usedFree ? 0 : AI_CREDITS;
          var freeLeft = x.data.free_remaining != null ? x.data.free_remaining : freeRemaining();
          if (usedFree || charged === 0) {
            setFormError(
              'Done · free generation used · ' +
                (freeLeft != null ? freeLeft + ' free left' : 'check Your plan'),
              false,
              'ok'
            );
          } else {
            setFormError(
              'Done · charged ' +
                charged +
                ' credit' +
                (charged === 1 ? '' : 's') +
                (x.data.paid_credits_remaining != null
                  ? ' · ' + x.data.paid_credits_remaining + ' purchased remaining'
                  : ''),
              false,
              'ok'
            );
          }
          updateCreditsPanel();
        })
        .catch(function () {
          setBusy(btn, false);
          setLoading(false);
          resetTurnstile();
          setFormError('Could not reach the server. Try again.');
        });
    };

    if (window.CuemarkTurnstile && CuemarkTurnstile.enabled && CuemarkTurnstile.enabled()) {
      CuemarkTurnstile.requireToken('vseo-turnstile')
        .then(run)
        .catch(function (err) {
          setBusy(btn, false);
          setLoading(false);
          setFormError((err && err.message) || 'Complete the security check, then try again.');
        });
    } else if (window.CuemarkTurnstile) {
      CuemarkTurnstile.loadConfig()
        .then(function () {
          if (CuemarkTurnstile.enabled()) {
            return CuemarkTurnstile.requireToken('vseo-turnstile').then(run);
          }
          run('');
        })
        .catch(function () {
          run('');
        });
    } else {
      run('');
    }
  }

  function clearAll() {
    $('vseo-brief').value = '';
    $('vseo-keywords').value = '';
    $('vseo-outline').value = '';
    $('vseo-tone').value = 'educational';
    $('vseo-cta').value = 'none';
    ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
      var el = $('plat-' + p);
      if (el) el.checked = true;
    });
    $('vseo-results').classList.remove('is-visible');
    $('vseo-results-body').innerHTML = '';
    $('vseo-tabs').innerHTML = '';
    $('vseo-extras-body').innerHTML = '';
    var extras = $('vseo-extras');
    if (extras) {
      extras.hidden = true;
      extras.dataset.hasContent = '';
    }
    var empty = $('vseo-empty');
    if (empty) empty.classList.remove('is-hidden');
    var paywall = $('vseo-paywall');
    if (paywall) paywall.hidden = true;
    setLoading(false);
    setFormError('');
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    $('vseo-brief').focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadForm();
    updateCreditsPanel();

    if (window.CuemarkTurnstile) {
      CuemarkTurnstile.prepare('vseo-turnstile-wrap', 'vseo-turnstile').catch(function () {});
    }

    var form = $('vseo-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        generate();
      });
    }
    var clearBtn = $('vseo-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);

    document.addEventListener('click', function (e) {
      document.querySelectorAll('.nav-products[open]').forEach(function (d) {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
  });
})();
