(function () {
  'use strict';

  var STORAGE_KEY = 'keyweaver.campaignKit.lastBrief';
  var VSEO_KEY = 'keyweaver.videoSeo.lastBrief';
  var SHOT_KEY = 'keyweaver.shotList.lastBrief';
  var BACKEND = 'https://keyweaver-backend.vercel.app';
  /** Must match .backend-checkout/lib/campaign-kit-policy.ts */
  var IMAGE_CREDITS = 4;
  var IMAGE_PREMIUM_CREDITS = 8;
  var VIDEO_CREDITS = 25;
  /** @type {{ remaining: number, total: number, paidRemaining: number, hasPaid: boolean } | null} */
  var creditsState = null;
  /** @type {'standard' | 'premium'} */
  var imageQuality = 'standard';

  var PRODUCTS = {
    none: { label: 'Custom / general', blurb: '' },
    cuemark: {
      label: 'Cuemark',
      blurb: 'Cuemark AI captions for After Effects - kinetic subtitles, highlighter bars, clean social caption look.'
    },
    trillian: {
      label: 'Trillian',
      blurb: 'Trillian AI voiceover - waveform + timeline UI, voice generation for editors.'
    },
    ludo: {
      label: 'Ludo',
      blurb: 'Ludo motion toolkit - text split, stagger, cloner layout, animation controls in After Effects.'
    },
    superconductor: {
      label: 'Superconductor',
      blurb: 'Superconductor AI video - generate short clips inside After Effects / Premiere.'
    },
    tamborine: {
      label: 'Tamborine',
      blurb: 'Tamborine AI music and SFX - cue beds and hits without leaving the NLE.'
    },
    keyweaver: {
      label: 'Keyweaver suite',
      blurb: 'Keyweaver suite for motion and video editors - Manager, plugins, and free web tools.'
    }
  };

  var ASPECT = {
    youtube_thumb: { ratio: '16:9', pixels: '1280×720', fal: '16:9' },
    vertical: { ratio: '9:16', pixels: '1080×1920', fal: '9:16' },
    square: { ratio: '1:1', pixels: '1080×1080', fal: '1:1' }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function cleanText(s) {
    return String(s || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function sentenceCase(s) {
    s = cleanText(s);
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function firstHook(brief) {
    var sents = cleanText(brief)
      .replace(/([.!?])\s+/g, '$1\n')
      .split(/\n+/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
    var first = (sents[0] || brief).replace(/[.!?]+$/, '');
    if (first.length > 72) first = first.slice(0, 69).replace(/\s+\S*$/, '') + '…';
    return sentenceCase(first);
  }

  function shortTitles(brief, product) {
    var hook = firstHook(brief);
    var words = hook.split(/\s+/).slice(0, 5).join(' ');
    var brand = product !== 'none' && PRODUCTS[product] ? PRODUCTS[product].label : 'Creator';
    return [
      words.toUpperCase(),
      sentenceCase(words),
      brand.toUpperCase() + ' TIP',
      'BEFORE → AFTER'
    ];
  }

  function getToken() {
    try {
      return localStorage.getItem('cc_token') || '';
    } catch (e) {
      return '';
    }
  }

  function readForm() {
    var assets = [];
    ['youtube_thumb', 'vertical', 'quote_card', 'motion'].forEach(function (a) {
      var el = $('asset-' + a);
      if (el && el.checked) assets.push(a);
    });
    var platforms = [];
    ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
      var el = $('plat-' + p);
      if (el && el.checked) platforms.push(p);
    });
    return {
      brief: cleanText($('ckit-brief').value),
      product: $('ckit-product').value || 'none',
      cta: $('ckit-cta').value || 'none',
      platforms: platforms,
      assets: assets
    };
  }

  function saveForm(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function loadForm() {
    var data = null;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      data = null;
    }
    if (!data || !data.brief) {
      try {
        var vseo = JSON.parse(localStorage.getItem(VSEO_KEY) || 'null');
        var shot = JSON.parse(localStorage.getItem(SHOT_KEY) || 'null');
        var source = '';
        if (vseo && vseo.brief) {
          data = {
            brief: vseo.brief,
            product: 'none',
            cta: vseo.cta || 'none',
            platforms: vseo.platforms || ['youtube', 'tiktok', 'instagram', 'facebook'],
            assets: ['youtube_thumb', 'vertical', 'quote_card']
          };
          source = 'Video SEO';
        } else if (shot && shot.concept) {
          data = {
            brief: shot.concept,
            product: 'none',
            cta: 'none',
            platforms: ['youtube', 'tiktok', 'instagram', 'facebook'],
            assets: ['youtube_thumb', 'vertical', 'quote_card']
          };
          source = 'Shot List';
        }
        if (source) {
          var banner = $('ckit-vseo-banner');
          if (banner) {
            banner.innerHTML =
              'Prefilling from your last <a href="/' +
              (source === 'Shot List' ? 'shot-list' : 'video-seo') +
              '">' +
              source +
              '</a> brief. Build pack is free - AI render needs purchased credits.';
            banner.classList.add('is-visible');
          }
        }
      } catch (e2) { /* ignore */ }
    }
    if (!data) return;
    $('ckit-brief').value = data.brief || '';
    if (data.product && $('ckit-product')) $('ckit-product').value = data.product;
    if (data.cta && $('ckit-cta')) $('ckit-cta').value = data.cta;
    ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
      var el = $('plat-' + p);
      if (el) el.checked = !data.platforms || data.platforms.indexOf(p) !== -1;
    });
    var assets = data.assets || ['youtube_thumb', 'vertical', 'quote_card'];
    ['youtube_thumb', 'vertical', 'quote_card', 'motion'].forEach(function (a) {
      var el = $('asset-' + a);
      if (el) el.checked = assets.indexOf(a) !== -1;
    });
  }

  function imageCreditsNeed() {
    return imageQuality === 'premium' ? IMAGE_PREMIUM_CREDITS : IMAGE_CREDITS;
  }

  function ctaLine(cta) {
    var map = {
      none: '',
      download: 'CTA text idea: Download free',
      try: 'CTA text idea: Try it free',
      watch: 'CTA text idea: Watch the walkthrough',
      link: 'CTA text idea: Link in bio'
    };
    return map[cta] || '';
  }

  function buildPack(data) {
    var product = PRODUCTS[data.product] || PRODUCTS.none;
    var productLine = product.blurb ? product.blurb + ' ' : '';
    var hook = firstHook(data.brief);
    var titles = shortTitles(data.brief, data.product);
    var cta = ctaLine(data.cta);
    var platformNote =
      data.platforms.length
        ? 'Platforms: ' + data.platforms.map(function (p) { return p; }).join(', ')
        : 'Platforms: (none selected)';

    var items = [];
    var checklist = [
      'Lock one message from the brief (not five)',
      'Keep burned-in text under ~6 words for thumbs',
      'Export masters at listed pixel sizes before upload compress',
      'Pair with Video SEO copy: https://keyweaver.io/video-seo'
    ];

    if (data.assets.indexOf('youtube_thumb') !== -1) {
      items.push({
        id: 'youtube_thumb',
        kind: 'image',
        title: 'YouTube thumb concepts',
        meta:
          ASPECT.youtube_thumb.ratio +
          ' · ' +
          ASPECT.youtube_thumb.pixels +
          ' · ' +
          platformNote,
        prompt:
          productLine +
          'YouTube thumbnail still, 16:9 framing, high contrast subject, large readable title text space for "' +
          titles[0] +
          '". Scene from brief: ' +
          data.brief +
          '. Clean modern creator aesthetic, soft studio light, no watermark, no cluttered UI chrome.',
        titles: titles.slice(0, 3),
        aspect: ASPECT.youtube_thumb.fal,
        recipe: 'Render 1280×720 (or crop 16:9). Leave safe margin for YouTube UI. Prefer faces / product UI large.'
      });
    }

    if (data.assets.indexOf('vertical') !== -1) {
      items.push({
        id: 'vertical',
        kind: 'image',
        title: 'Vertical teaser stills',
        meta: ASPECT.vertical.ratio + ' · ' + ASPECT.vertical.pixels + ' · Reels / Shorts / TikTok',
        prompt:
          productLine +
          'Vertical 9:16 teaser still for short-form video. Hook: "' +
          hook +
          '". Brief: ' +
          data.brief +
          '. Phone-native composition, subject in upper two-thirds, room for caption bar at bottom, clean high-contrast look, sharp product detail if shown.',
        titles: [titles[1], titles[3]],
        aspect: ASPECT.vertical.fal,
        recipe: '1080×1920. Keep faces/UI above the lower 20% (caption/UI safe zone).'
      });
    }

    if (data.assets.indexOf('quote_card') !== -1) {
      items.push({
        id: 'quote_card',
        kind: 'image',
        title: 'Quote / title card',
        meta: '1:1 or 16:9 · Burned-in preset text',
        prompt:
          productLine +
          'Minimal title card, bold centered type reading "' +
          titles[0] +
          '", charcoal background, subtle soft gradient, generous negative space, premium SaaS ad aesthetic. Optional small subtitle: ' +
          (cta || hook) +
          '. No fake app store badges.',
        titles: [titles[0], titles[2]],
        aspect: '1:1',
        recipe: 'Square for feed; duplicate 16:9 if needed. Type should remain legible at 320px wide.'
      });
    }

    if (data.assets.indexOf('motion') !== -1) {
      items.push({
        id: 'motion',
        kind: 'video',
        title: 'Short motion teaser (Seedance Fast)',
        meta: '4s · 16:9 or 9:16 · add-on · ' + VIDEO_CREDITS + ' purchased credits',
        prompt:
          productLine +
          '4-second cinematic product teaser. Slow push-in, subtle UI motion, captions or waveform animating on. Hook: "' +
          hook +
          '". Brief: ' +
          data.brief +
          '. Smooth camera, soft lighting, no rapid cuts, no logos of other brands. End on a clean frame ready for a title overlay.',
        titles: [],
        aspect: data.platforms.indexOf('youtube') !== -1 && data.platforms.length === 1 ? '16:9' : '9:16',
        recipe:
          'Seedance Fast 720p, duration 4 (max 5). Prefer stills first - video is a costly add-on. Not a music-license substitute.'
      });
      checklist.push('Motion: render stills first; video is an expensive purchased-credit add-on');
    }

    return { items: items, checklist: checklist, titles: titles, cta: cta, product: product.label };
  }

  function copyText(text, btn) {
    function ok() {
      if (!btn) return;
      var prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = prev; }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(function () {
        fallbackCopy(text);
        ok();
      });
    } else {
      fallbackCopy(text);
      ok();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function purchaseLinksHtml() {
    return (
      '<span class="tools-inline-cta">' +
      '<a href="/pricing">Buy credits</a>' +
      '<a href="/account">Account</a>' +
      '</span>'
    );
  }

  function setStatus(el, msg, kind, allowHtml) {
    if (!el) return;
    if (allowHtml) el.innerHTML = msg || '';
    else el.textContent = msg || '';
    el.classList.remove('is-ok', 'is-err');
    if (kind) el.classList.add(kind === 'ok' ? 'is-ok' : 'is-err');
  }

  function renderGateReason(need) {
    if (!getToken()) {
      return {
        ok: false,
        reason:
          'Sign in to render. AI render needs purchased credits - <a href="/login?next=/campaign-kit">Sign in</a> · <a href="/pricing">Buy credits</a>'
      };
    }
    if (!creditsState) {
      return { ok: false, reason: 'Checking purchased credit balance…' };
    }
    if (!creditsState.hasPaid || creditsState.paidRemaining <= 0) {
      return {
        ok: false,
        reason:
          'You have 0 purchased credits for AI render. Free signup credits cannot cover generation. ' +
          purchaseLinksHtml()
      };
    }
    if (creditsState.paidRemaining < need) {
      return {
        ok: false,
        reason:
          'Need ' +
          need +
          ' purchased credits (you have ' +
          creditsState.paidRemaining +
          '). ' +
          purchaseLinksHtml()
      };
    }
    return { ok: true, reason: 'Will charge ' + need + ' purchased credits for this render.' };
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.dataset.prevLabel = btn.textContent;
      btn.textContent = label || 'Working…';
      btn.classList.add('is-busy');
      btn.disabled = true;
    } else {
      if (btn.dataset.prevLabel) btn.textContent = btn.dataset.prevLabel;
      delete btn.dataset.prevLabel;
      btn.classList.remove('is-busy');
      btn.disabled = false;
    }
  }

  function renderSelected(item, textarea, statusEl, previewHost, renderBtn, hintEl) {
    var token = getToken();
    var need = item.kind === 'video' ? VIDEO_CREDITS : imageCreditsNeed();
    var gate = renderGateReason(need);
    if (!gate.ok) {
      setStatus(statusEl, gate.reason, 'err', true);
      if (hintEl) {
        hintEl.innerHTML = gate.reason;
        hintEl.classList.add('is-err');
      }
      return;
    }
    setBusy(renderBtn, true, 'Rendering…');
    setStatus(statusEl, 'Rendering… this can take up to a minute.', null);
    var body = {
      kind: item.kind,
      prompt: textarea.value,
      aspect_ratio: item.aspect || '16:9',
      quality: item.kind === 'image' ? imageQuality : undefined,
      duration: item.kind === 'video' ? '4' : undefined
    };
    fetch(BACKEND + '/api/campaign-kit/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (x) {
        setBusy(renderBtn, false);
        if (x.res.status === 503 && x.data && x.data.reason === 'provider_not_configured') {
          setStatus(
            statusEl,
            'AI render is temporarily unavailable on the server. Your free Build pack still works - try render again later.',
            'err'
          );
          syncRenderButtons();
          return;
        }
        if (x.res.status === 401) {
          setStatus(
            statusEl,
            'Session expired. <a href="/login?next=/campaign-kit">Sign in</a> again to render.',
            'err',
            true
          );
          syncRenderButtons();
          return;
        }
        if (x.res.status === 402) {
          var needCr = x.data && x.data.credits_required != null ? x.data.credits_required : need;
          var paidLeft =
            x.data && x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : 0;
          if (x.data && x.data.reason === 'paid_credits_required') {
            setStatus(
              statusEl,
              'Purchased credits required (need ' +
                needCr +
                ', you have ' +
                paidLeft +
                '). Free signup credits cannot run AI render. ' +
                purchaseLinksHtml(),
              'err',
              true
            );
          } else {
            setStatus(
              statusEl,
              'Not enough credits (need ' +
                needCr +
                '). ' +
                purchaseLinksHtml(),
              'err',
              true
            );
          }
          updateCreditsPanel();
          return;
        }
        if (!x.res.ok) {
          setStatus(statusEl, (x.data && x.data.error) || 'Render failed. No charge if the provider failed.', 'err');
          syncRenderButtons();
          return;
        }
        var url = x.data.url;
        var charged = x.data.credits_charged != null ? x.data.credits_charged : need;
        var paidRemain =
          x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : null;
        setStatus(
          statusEl,
          'Done - charged ' +
            charged +
            ' purchased credit' +
            (charged === 1 ? '' : 's') +
            (paidRemain != null ? ' · ' + paidRemain + ' purchased remaining' : '') +
            '.',
          'ok'
        );
        updateCreditsPanel();
        if (url && previewHost) {
          previewHost.innerHTML = '';
          if (item.kind === 'video') {
            var v = document.createElement('video');
            v.className = 'ckit-preview';
            v.controls = true;
            v.src = url;
            previewHost.appendChild(v);
          } else {
            var img = document.createElement('img');
            img.className = 'ckit-preview';
            img.alt = 'Rendered asset';
            img.src = url;
            previewHost.appendChild(img);
          }
          var a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.className = 'btn btn-ghost';
          a.style.marginTop = '0.5rem';
          a.textContent = 'Open file';
          previewHost.appendChild(a);
        }
      })
      .catch(function () {
        setBusy(renderBtn, false);
        setStatus(statusEl, 'Network error talking to Keyweaver. Try again in a moment.', 'err');
        syncRenderButtons();
      });
  }

  function renderResults(data) {
    var pack = buildPack(data);
    var host = $('ckit-results-body');
    var list = $('ckit-checklist');
    var empty = $('ckit-empty');
    host.innerHTML = '';
    list.innerHTML = '';
    if (empty) empty.classList.add('is-hidden');

    pack.checklist.forEach(function (line) {
      var li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    });

    pack.items.forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'ckit-card';
      card.dataset.kind = item.kind;

      var h = document.createElement('h3');
      h.textContent = item.title;
      card.appendChild(h);

      var meta = document.createElement('p');
      meta.className = 'ckit-meta';
      meta.textContent = item.meta + (item.recipe ? ' · ' + item.recipe : '');
      card.appendChild(meta);

      if (item.titles && item.titles.length) {
        var tmeta = document.createElement('p');
        tmeta.className = 'ckit-meta';
        tmeta.textContent = 'Title / burn-in options: ' + item.titles.join(' · ');
        card.appendChild(tmeta);
      }

      var ta = document.createElement('textarea');
      ta.rows = 5;
      ta.value = item.prompt;
      ta.setAttribute('aria-label', item.title + ' prompt');
      card.appendChild(ta);

      var actions = document.createElement('div');
      actions.className = 'ckit-card-actions';

      var copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-ghost';
      copyBtn.textContent = 'Copy prompt';
      copyBtn.addEventListener('click', function () {
        copyText(ta.value, copyBtn);
      });
      actions.appendChild(copyBtn);

      if (item.kind === 'image') {
        var qualWrap = document.createElement('label');
        qualWrap.className = 'ckit-quality';
        var qualCheck = document.createElement('input');
        qualCheck.type = 'checkbox';
        qualCheck.checked = imageQuality === 'premium';
        qualCheck.addEventListener('change', function () {
          imageQuality = qualCheck.checked ? 'premium' : 'standard';
          syncImageQualityUI();
        });
        qualWrap.appendChild(qualCheck);
        qualWrap.appendChild(
          document.createTextNode(
            ' Premium (' + IMAGE_PREMIUM_CREDITS + ' credits · higher quality)'
          )
        );
        actions.appendChild(qualWrap);
      }

      var renderBtn = document.createElement('button');
      renderBtn.type = 'button';
      renderBtn.className = 'btn btn-primary';
      renderBtn.dataset.role = 'render';
      actions.appendChild(renderBtn);

      var status = document.createElement('span');
      status.className = 'ckit-render-status';
      actions.appendChild(status);

      var hint = document.createElement('p');
      hint.className = 'tools-render-hint';
      hint.dataset.role = 'render-hint';
      actions.appendChild(hint);

      card.appendChild(actions);

      var preview = document.createElement('div');
      card.appendChild(preview);

      renderBtn.addEventListener('click', function () {
        renderSelected(item, ta, status, preview, renderBtn, hint);
      });

      host.appendChild(card);
    });

    syncImageQualityUI();
    updateCreditsPanel();
    $('ckit-results').classList.add('is-visible');
    $('ckit-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function syncCreditCostHighlights() {
    var list = $('ckit-credit-costs');
    if (!list) return;
    list.querySelectorAll('li').forEach(function (li) {
      li.classList.remove('is-active');
    });
    var active =
      imageQuality === 'premium'
        ? list.querySelector('[data-cost="premium"]')
        : list.querySelector('[data-cost="image"]');
    if (active) active.classList.add('is-active');
    var next = $('ckit-next-cost');
    if (next) {
      next.textContent = imageCreditsNeed() + ' credits';
      next.classList.toggle('is-zero', false);
      next.classList.add('is-ok');
    }
  }

  function syncCreditActions() {
    var signin = $('ckit-credits-signin');
    var buy = $('ckit-credits-buy');
    var account = $('ckit-credits-account');
    var token = getToken();
    var zeroPaid = !!(token && creditsState && creditsState.paidRemaining <= 0);
    if (signin) {
      signin.hidden = !!token;
      signin.className = 'btn btn-primary';
    }
    if (buy) {
      buy.hidden = false;
      buy.textContent = 'Buy credits';
      // Primary when signed in with 0 purchased credits; otherwise ghost next to Sign in
      buy.className = zeroPaid ? 'btn btn-primary' : 'btn btn-ghost';
    }
    if (account) account.hidden = !token;
  }

  function syncRenderButtons() {
    syncCreditCostHighlights();
    document.querySelectorAll('#ckit-results-body .ckit-card').forEach(function (card) {
      var btn = card.querySelector('button[data-role="render"]');
      var hint = card.querySelector('[data-role="render-hint"]');
      if (!btn || btn.classList.contains('is-busy')) return;
      var kind = card.dataset.kind === 'video' ? 'video' : 'image';
      var need = kind === 'video' ? VIDEO_CREDITS : imageCreditsNeed();
      if (kind === 'video') {
        btn.textContent = 'Render video - ' + VIDEO_CREDITS + ' credits';
      } else {
        btn.textContent =
          'Render image - ' +
          need +
          ' credit' +
          (need === 1 ? '' : 's') +
          (imageQuality === 'premium' ? ' (premium)' : '');
      }
      var gate = renderGateReason(need);
      btn.disabled = !gate.ok;
      if (gate.ok) btn.classList.remove('is-disabled');
      else btn.classList.add('is-disabled');
      btn.title = gate.ok
        ? 'Charges ' + need + ' purchased credits'
        : 'Purchased credits required - see Pricing';
      if (hint) {
        hint.innerHTML = gate.reason;
        hint.classList.toggle('is-err', !gate.ok);
      }
      var qual = card.querySelector('.ckit-quality input[type="checkbox"]');
      if (qual) qual.checked = imageQuality === 'premium';
    });
  }

  function syncImageQualityUI() {
    syncRenderButtons();
  }

  function updateCreditsPanel() {
    var panel = $('ckit-credits');
    var bal = $('ckit-balance');
    var meter = $('ckit-credit-meter');
    var paidEl = $('ckit-paid-value');
    var poolEl = $('ckit-pool-value');
    var token = getToken();
    if (!panel) return;
    syncCreditActions();
    if (!token) {
      creditsState = null;
      if (meter) meter.hidden = true;
      if (bal) {
        bal.className = 'tools-credit-status is-warn';
        bal.textContent =
          'Sign in to see purchased credits and unlock AI render. Build pack above stays free forever.';
      }
      syncRenderButtons();
      return;
    }
    if (bal) {
      bal.className = 'tools-credit-status';
      bal.textContent = 'Checking purchased credit balance…';
    }
    fetch(BACKEND + '/api/captio/credits', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!bal) return;
        if (!data) {
          creditsState = null;
          if (meter) meter.hidden = true;
          bal.className = 'tools-credit-status is-err';
          bal.innerHTML =
            'Could not load credits. Try <a href="/account">Account</a> or refresh.';
          syncRenderButtons();
          return;
        }
        var paid = Number(data.paid_credits_remaining != null ? data.paid_credits_remaining : 0);
        creditsState = {
          remaining: Number(data.credits_remaining || 0),
          total: Number(data.credits_total || 0),
          paidRemaining: paid,
          hasPaid: paid > 0 || !!data.has_paid_credits
        };
        if (meter) meter.hidden = false;
        if (paidEl) {
          paidEl.textContent = String(paid);
          paidEl.classList.toggle('is-zero', paid <= 0);
          paidEl.classList.toggle('is-ok', paid > 0);
        }
        if (poolEl) {
          poolEl.textContent = creditsState.remaining + ' / ' + creditsState.total;
        }
        if (paid <= 0) {
          bal.className = 'tools-credit-status is-warn';
          bal.innerHTML =
            'Signed in, but you have <strong>0 purchased credits</strong> for AI render. Free signup credits cannot run fal. ' +
            purchaseLinksHtml();
        } else {
          bal.className = 'tools-credit-status is-ok';
          bal.textContent =
            'Ready to render. Purchased credits available: ' +
            paid +
            '. Toggle Premium on an image card to preview the 8-credit cost.';
        }
        syncRenderButtons();
      })
      .catch(function () {
        creditsState = null;
        if (meter) meter.hidden = true;
        if (bal) {
          bal.className = 'tools-credit-status is-err';
          bal.textContent = 'Could not load credits.';
        }
        syncRenderButtons();
      });
  }

  function generate() {
    var err = $('ckit-error');
    err.classList.remove('is-visible');
    err.textContent = '';
    var data = readForm();
    if (!data.brief || data.brief.length < 12) {
      err.textContent = 'Add a short campaign brief (at least a sentence) so we can shape asset prompts.';
      err.classList.add('is-visible');
      $('ckit-brief').focus();
      return;
    }
    if (!data.assets.length) {
      err.textContent = 'Select at least one asset type.';
      err.classList.add('is-visible');
      return;
    }
    var submit = $('ckit-submit');
    setBusy(submit, true, 'Building pack…');
    saveForm(data);
    // Yield so the busy label paints before DOM work
    setTimeout(function () {
      renderResults(data);
      setBusy(submit, false);
      if (submit) {
        submit.disabled = false;
        submit.classList.remove('is-disabled');
      }
    }, 10);
  }

  function clearAll() {
    $('ckit-brief').value = '';
    $('ckit-product').value = 'none';
    $('ckit-cta').value = 'none';
    ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
      var el = $('plat-' + p);
      if (el) el.checked = true;
    });
    ;['youtube_thumb', 'vertical', 'quote_card'].forEach(function (a) {
      var el = $('asset-' + a);
      if (el) el.checked = true;
    });
    var motionEl = $('asset-motion');
    if (motionEl) motionEl.checked = false;
    imageQuality = 'standard';
    $('ckit-results').classList.remove('is-visible');
    $('ckit-results-body').innerHTML = '';
    $('ckit-checklist').innerHTML = '';
    var empty = $('ckit-empty');
    if (empty) empty.classList.remove('is-hidden');
    var banner = $('ckit-vseo-banner');
    if (banner) banner.classList.remove('is-visible');
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    $('ckit-brief').focus();
  }

  function hydrateCostLabels() {
    var list = $('ckit-credit-costs');
    if (!list) return;
    var map = {
      image: IMAGE_CREDITS + ' credits',
      premium: IMAGE_PREMIUM_CREDITS + ' credits',
      video: VIDEO_CREDITS + ' credits'
    };
    list.querySelectorAll('li[data-cost]').forEach(function (li) {
      var key = li.getAttribute('data-cost');
      var cost = li.querySelector('.cost');
      if (cost && map[key]) cost.textContent = map[key];
    });
    syncCreditCostHighlights();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadForm();
    hydrateCostLabels();
    var form = $('ckit-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        generate();
      });
    }
    var clearBtn = $('ckit-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);

    var copyAll = $('ckit-copy-all');
    if (copyAll) {
      copyAll.addEventListener('click', function () {
        var areas = document.querySelectorAll('#ckit-results-body textarea');
        var chunks = [];
        areas.forEach(function (ta, i) {
          chunks.push('--- Asset ' + (i + 1) + ' ---\n' + ta.value);
        });
        if (!chunks.length) return;
        copyText(chunks.join('\n\n'), copyAll);
      });
    }

    updateCreditsPanel();

    document.addEventListener('click', function (e) {
      document.querySelectorAll('.nav-products[open]').forEach(function (d) {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
  });
})();
