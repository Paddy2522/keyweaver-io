(function () {
  'use strict';

  var STORAGE_KEY = 'keyweaver.campaignKit.lastBrief';
  var VSEO_KEY = 'keyweaver.videoSeo.lastBrief';
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
        if (vseo && vseo.brief) {
          data = {
            brief: vseo.brief,
            product: 'none',
            cta: vseo.cta || 'none',
            platforms: vseo.platforms || ['youtube', 'tiktok', 'instagram', 'facebook'],
            assets: ['youtube_thumb', 'vertical', 'quote_card']
          };
          var banner = $('ckit-vseo-banner');
          if (banner) banner.classList.add('is-visible');
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

  function setStatus(el, msg, kind) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('is-ok', 'is-err');
    if (kind) el.classList.add(kind === 'ok' ? 'is-ok' : 'is-err');
  }

  function renderSelected(item, textarea, statusEl, previewHost) {
    var token = getToken();
    if (!token) {
      setStatus(statusEl, 'Sign in and buy credits to render (purchased credits only).', 'err');
      return;
    }
    var need = item.kind === 'video' ? VIDEO_CREDITS : imageCreditsNeed();
    if (creditsState && !creditsState.hasPaid) {
      setStatus(
        statusEl,
        'AI render needs purchased credits (free signup credits cannot run fal). Buy a pack on Pricing.',
        'err'
      );
      return;
    }
    if (creditsState && creditsState.paidRemaining < need) {
      setStatus(
        statusEl,
        'Need ' + need + ' purchased credits (have ' + creditsState.paidRemaining + ').',
        'err'
      );
      return;
    }
    setStatus(statusEl, 'Rendering… (may take a minute)', null);
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
        if (x.res.status === 503 && x.data && x.data.reason === 'provider_not_configured') {
          setStatus(
            statusEl,
            'AI render provider is not configured on the server. Build pack still works; try again later.',
            'err'
          );
          return;
        }
        if (x.res.status === 401) {
          setStatus(statusEl, 'Session expired - sign in again.', 'err');
          return;
        }
        if (x.res.status === 402) {
          if (x.data && x.data.reason === 'paid_credits_required') {
            setStatus(
              statusEl,
              'Purchased credits required (need ' +
                (x.data.credits_required || '?') +
                ', paid remaining ' +
                (x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : 0) +
                '). Free signup credits cannot run AI render.',
              'err'
            );
            updateCreditsPanel();
            return;
          }
          setStatus(
            statusEl,
            'Not enough credits (need ' +
              (x.data.credits_required || '?') +
              ', have ' +
              (x.data.credits_remaining || 0) +
              ').',
            'err'
          );
          updateCreditsPanel();
          return;
        }
        if (!x.res.ok) {
          setStatus(statusEl, (x.data && x.data.error) || 'Render failed.', 'err');
          return;
        }
        var url = x.data.url;
        setStatus(
          statusEl,
          'Done · ' +
            (x.data.credits_charged || 0) +
            ' purchased credits · ' +
            (x.data.model ? x.data.model + ' · ' : '') +
            (x.data.paid_credits_remaining != null
              ? x.data.paid_credits_remaining + ' paid left'
              : x.data.credits_remaining != null
                ? x.data.credits_remaining + ' left'
                : ''),
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
        setStatus(statusEl, 'Network error talking to Keyweaver backend.', 'err');
      });
  }

  function renderResults(data) {
    var pack = buildPack(data);
    var host = $('ckit-results-body');
    var list = $('ckit-checklist');
    host.innerHTML = '';
    list.innerHTML = '';

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
            ' Premium (+' +
              (IMAGE_PREMIUM_CREDITS - IMAGE_CREDITS) +
              ' cr · Nano Banana Pro)'
          )
        );
        actions.appendChild(qualWrap);
      }

      var renderBtn = document.createElement('button');
      renderBtn.type = 'button';
      renderBtn.className = 'btn btn-primary';
      renderBtn.dataset.role = 'render';
      renderBtn.textContent =
        item.kind === 'video'
          ? 'Render video (' + VIDEO_CREDITS + ' purchased cr)'
          : 'Render image (' + imageCreditsNeed() + ' purchased cr)';
      var need = item.kind === 'video' ? VIDEO_CREDITS : imageCreditsNeed();
      if (!getToken() || !creditsState || creditsState.paidRemaining < need) {
        renderBtn.disabled = true;
        renderBtn.classList.add('is-disabled');
        renderBtn.title =
          'Requires purchased Keyweaver credits (not free signup). Buy a pack, then render.';
      }
      actions.appendChild(renderBtn);

      var status = document.createElement('span');
      status.className = 'ckit-render-status';
      actions.appendChild(status);

      card.appendChild(actions);

      var preview = document.createElement('div');
      card.appendChild(preview);

      renderBtn.addEventListener('click', function () {
        renderSelected(item, ta, status, preview);
      });

      host.appendChild(card);
    });

    updateCreditsPanel();
    $('ckit-results').classList.add('is-visible');
    $('ckit-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function syncImageQualityUI() {
    var costs = $('ckit-credit-costs');
    if (costs) {
      costs.textContent =
        'Costs (purchased credits only): image = ' +
        IMAGE_CREDITS +
        ' (Nano Banana) · premium image = ' +
        IMAGE_PREMIUM_CREDITS +
        ' (Nano Banana Pro) · 4s Seedance Fast video = ' +
        VIDEO_CREDITS +
        '. Free signup / promo credits cannot run fal.';
    }
    document.querySelectorAll('#ckit-results-body .ckit-card').forEach(function (card) {
      var btn = card.querySelector('button[data-role="render"]');
      if (!btn) return;
      var kind = card.dataset.kind === 'video' ? 'video' : 'image';
      var need = kind === 'video' ? VIDEO_CREDITS : imageCreditsNeed();
      if (kind === 'image') {
        btn.textContent = 'Render image (' + need + ' purchased cr)';
      }
      var ok = !!(creditsState && creditsState.paidRemaining >= need && getToken());
      btn.disabled = !ok;
      if (ok) btn.classList.remove('is-disabled');
      else btn.classList.add('is-disabled');
      var qual = card.querySelector('.ckit-quality input[type="checkbox"]');
      if (qual) qual.checked = imageQuality === 'premium';
    });
  }

  function updateCreditsPanel() {
    var panel = $('ckit-credits');
    var bal = $('ckit-balance');
    var token = getToken();
    if (!panel) return;
    if (!token) {
      creditsState = null;
      if (bal) {
        bal.textContent =
          'Sign in and buy credits to enable AI render. Build pack stays free - no API key needed.';
      }
      return;
    }
    if (bal) bal.textContent = 'Checking purchased credit balance…';
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
          bal.textContent = 'Could not load credits - try Account.';
          return;
        }
        var paid = Number(data.paid_credits_remaining != null ? data.paid_credits_remaining : 0);
        creditsState = {
          remaining: Number(data.credits_remaining || 0),
          total: Number(data.credits_total || 0),
          paidRemaining: paid,
          hasPaid: paid > 0 || !!data.has_paid_credits
        };
        if (paid <= 0) {
          bal.textContent =
            'Pool: ' +
            creditsState.remaining +
            ' / ' +
            creditsState.total +
            ' · Purchased for AI render: 0. Buy credits to render with fal (free signup credits cannot cover generation cost).';
        } else {
          bal.textContent =
            'Purchased for AI render: ' +
            paid +
            ' · Pool: ' +
            creditsState.remaining +
            ' / ' +
            creditsState.total +
            ' · Image = ' +
            IMAGE_CREDITS +
            ' (premium ' +
            IMAGE_PREMIUM_CREDITS +
            ') · 4s video = ' +
            VIDEO_CREDITS;
        }
        syncImageQualityUI();
      })
      .catch(function () {
        creditsState = null;
        if (bal) bal.textContent = 'Could not load credits.';
      });
  }

  function generate() {
    var err = $('ckit-error');
    err.classList.remove('is-visible');
    err.textContent = '';
    var data = readForm();
    if (!data.brief || data.brief.length < 12) {
      err.textContent = 'Add a short campaign brief (at least a sentence).';
      err.classList.add('is-visible');
      $('ckit-brief').focus();
      return;
    }
    if (!data.assets.length) {
      err.textContent = 'Select at least one asset type.';
      err.classList.add('is-visible');
      return;
    }
    saveForm(data);
    renderResults(data);
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
    var banner = $('ckit-vseo-banner');
    if (banner) banner.classList.remove('is-visible');
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    $('ckit-brief').focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadForm();
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
