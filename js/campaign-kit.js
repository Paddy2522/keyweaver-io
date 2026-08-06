(function () {
  'use strict';

  var STORAGE_KEY = 'keyweaver.campaignKit.lastBrief';
  var VSEO_KEY = 'keyweaver.videoSeo.lastBrief';
  var SHOT_KEY = 'keyweaver.shotList.lastBrief';
  var Auth = window.KeyweaverToolsAuth;
  var BACKEND = (Auth && Auth.BACKEND) || 'https://keyweaver-backend.vercel.app';
  /** Must match .backend-checkout/lib/campaign-kit-policy.ts */
  var IMAGE_CREDITS = 4;
  var IMAGE_PREMIUM_CREDITS = 8;
  var VIDEO_CREDITS = 25;
  /** @type {{ remaining: number, total: number, paidRemaining: number, hasPaid: boolean } | null} */
  var creditsState = null;
  /** @type {'standard' | 'premium'} */
  var imageQuality = 'standard';
  /** @type {ReturnType<typeof buildPack> | null} */
  var lastPack = null;
  var activeTab = '';

  var VIDEO_TYPES = {
    tutorial: {
      label: 'Tutorial',
      vibe: 'clear step-by-step teaching energy, readable demo or UI, trustworthy creator look',
      frame: 'show the “aha” moment of the lesson, not a generic laptop stock shot'
    },
    product_review: {
      label: 'Product review',
      vibe: 'honest review energy, product hero plus human reaction, before/after friendly framing',
      frame: 'product large in frame with a real expression that sells the verdict'
    },
    vlog: {
      label: 'Vlog',
      vibe: 'personal day-in-the-life energy, natural light, candid creator presence',
      frame: 'face-forward intimacy, lived-in location, one clear activity'
    },
    talking_head: {
      label: 'Talking head',
      vibe: 'direct-to-camera host, clean background, strong eye contact, simple set',
      frame: 'tight head-and-shoulders, eyes toward lens, soft separation from background'
    },
    short_hook: {
      label: 'Short-form hook',
      vibe: 'scroll-stopping first frame, big expression or bold prop, phone-native vertical energy',
      frame: 'one surprising prop or face reaction fills the upper two-thirds'
    },
    launch_trailer: {
      label: 'Launch trailer',
      vibe: 'cinematic launch energy, high contrast, dramatic lighting, trailer-poster composition',
      frame: 'poster-like hero with empty title safe zone and dramatic light falloff'
    }
  };

  var TONES = {
    educational: 'calm educational tone, helpful and clear',
    hype: 'high-energy hype tone, bold and urgent without looking spammy',
    calm: 'calm premium tone, soft light, uncluttered, quiet confidence',
    casual: 'casual friendly tone, natural light, relaxed creator energy',
    professional: 'clean professional tone, sharp lighting, polished but human'
  };

  var ASPECT = {
    youtube_thumb: { ratio: '16:9', pixels: '1280×720', fal: '16:9', tab: 'youtube', tabLabel: 'YouTube' },
    vertical: { ratio: '9:16', pixels: '1080×1920', fal: '9:16', tab: 'tiktok', tabLabel: 'TikTok' },
    quote_card: { ratio: '1:1', pixels: '1080×1080', fal: '1:1', tab: 'instagram', tabLabel: 'Instagram' },
    motion: { ratio: '9:16', pixels: '720p · 4s', fal: '9:16', tab: 'motion', tabLabel: 'Motion' }
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

  function stripFiller(s) {
    return cleanText(s)
      .replace(/^(a|an|the)\s+video\s+(where|about|of|on)\s+/i, '')
      .replace(/^(this\s+)?(video|tutorial|guide|vlog)\s+(is\s+about|shows|explains|covers)\s+/i, '')
      .replace(/^(how\s+to)\s+/i, 'How to ')
      .trim();
  }

  function firstHook(brief) {
    var sents = cleanText(brief)
      .replace(/([.!?])\s+/g, '$1\n')
      .split(/\n+/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
    var first = stripFiller(sents[0] || brief).replace(/[.!?]+$/, '');
    if (first.length > 72) first = first.slice(0, 69).replace(/\s+\S*$/, '') + '…';
    return sentenceCase(first);
  }

  function extractMood(brief) {
    var m = brief.match(/(?:mood|vibe|look|feel|aesthetic)\s*[:\-]\s*([^.!\n]+)/i);
    if (m) return cleanText(m[1]);
    if (/warm|daylight|golden/i.test(brief)) return 'warm daylight';
    if (/dark|moody|cinematic|noir/i.test(brief)) return 'moody cinematic light';
    if (/clean|minimal|desk|studio/i.test(brief)) return 'clean soft studio light';
    return 'natural creator light';
  }

  function extractAudience(brief) {
    var m = brief.match(/(?:for|aimed at|audience)\s+([^.!\n,]{3,48})/i);
    if (m) return cleanText(m[1]);
    return '';
  }

  function shortTitles(brief, videoType, cta) {
    var hook = firstHook(brief);
    var words = hook
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join(' ');
    if (!words || words.length < 3) words = 'Watch this';
    if (words.length > 26) words = words.slice(0, 24).replace(/\s+\S*$/, '');

    var typeLabel = VIDEO_TYPES[videoType] ? VIDEO_TYPES[videoType].label : 'Creator';
    var list = [
      words.toUpperCase(),
      sentenceCase(words),
      typeLabel.toUpperCase() + ' TIP'
    ];

    if (/before|after|vs\.?|versus|fix|upgrade/i.test(brief)) {
      list.push('BEFORE → AFTER');
    } else if (videoType === 'short_hook') {
      list.push('STOP SCROLLING');
    } else if (videoType === 'product_review') {
      list.push('HONEST TAKE');
    } else {
      list.push('TRY THIS');
    }

    if (cta === 'subscribe') list.push('FOLLOW FOR MORE');
    else if (cta === 'link') list.push('LINK IN BIO');
    else if (cta === 'watch') list.push('FULL VIDEO');
    else if (cta === 'comment') list.push('DROP A Q');

    return list.filter(function (t, i, arr) {
      return arr.indexOf(t) === i;
    }).slice(0, 5);
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
    return Auth && Auth.loginUrl ? Auth.loginUrl('/campaign-kit') : '/login?next=/campaign-kit';
  }

  function mapTone(tone) {
    var t = String(tone || '').toLowerCase();
    if (t === 'energetic' || t === 'hype') return 'hype';
    if (t === 'calm' || t === 'soft') return 'calm';
    if (t === 'casual') return 'casual';
    if (t === 'professional') return 'professional';
    if (t === 'educational') return 'educational';
    return 'educational';
  }

  function mapCta(cta) {
    var c = String(cta || 'none').toLowerCase();
    if (c === 'follow' || c === 'subscribe') return 'subscribe';
    if (c === 'link' || c === 'bio') return 'link';
    if (c === 'comment' || c === 'share') return 'comment';
    if (c === 'watch') return 'watch';
    if (c === 'download' || c === 'try') return 'subscribe';
    return 'none';
  }

  function mapShotType(t) {
    var map = {
      talking_head: 'talking_head',
      product: 'product_review',
      product_review: 'product_review',
      tutorial: 'tutorial',
      vlog: 'vlog',
      short_hook: 'short_hook',
      launch_trailer: 'launch_trailer',
      event: 'vlog',
      custom: 'talking_head'
    };
    return map[t] || 'tutorial';
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
      videoType: ($('ckit-video-type') && $('ckit-video-type').value) || 'tutorial',
      tone: ($('ckit-tone') && $('ckit-tone').value) || 'educational',
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

  function showHandoffBanner(source, href) {
    var banner = $('ckit-handoff-banner');
    if (!banner) return;
    banner.innerHTML =
      'Continuing with your last <a href="' +
      href +
      '">' +
      source +
      '</a> brief. Build the free pack below, then optionally render with purchased credits.';
    banner.hidden = false;
  }

  function loadForm() {
    var data = null;
    var fromHandoff = false;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      data = null;
    }

    if (!data || !data.brief) {
      try {
        var vseo = JSON.parse(localStorage.getItem(VSEO_KEY) || 'null');
        var shot = JSON.parse(localStorage.getItem(SHOT_KEY) || 'null');
        if (vseo && vseo.brief) {
          data = {
            brief: vseo.brief,
            videoType: 'tutorial',
            tone: mapTone(vseo.tone),
            cta: mapCta(vseo.cta),
            platforms: Array.isArray(vseo.platforms) && vseo.platforms.length
              ? vseo.platforms
              : ['youtube', 'tiktok', 'instagram', 'facebook'],
            assets: ['youtube_thumb', 'vertical', 'quote_card']
          };
          fromHandoff = true;
          showHandoffBanner('Video SEO', '/video-seo');
        } else if (shot && (shot.concept || shot.brief)) {
          data = {
            brief: shot.concept || shot.brief,
            videoType: mapShotType(shot.type || shot.videoType),
            tone: mapTone(shot.tone) || 'educational',
            cta: mapCta(shot.cta),
            platforms: ['youtube', 'tiktok', 'instagram', 'facebook'],
            assets: ['youtube_thumb', 'vertical', 'quote_card']
          };
          fromHandoff = true;
          showHandoffBanner('Shot List', '/shot-list');
        }
      } catch (e2) { /* ignore */ }
    }

    if (!data) return;
    $('ckit-brief').value = data.brief || '';
    if ($('ckit-video-type')) {
      $('ckit-video-type').value = data.videoType || 'tutorial';
    }
    if ($('ckit-tone')) {
      var tone = mapTone(data.tone);
      if ($('ckit-tone').querySelector('option[value="' + tone + '"]')) {
        $('ckit-tone').value = tone;
      }
    }
    if ($('ckit-cta')) $('ckit-cta').value = mapCta(data.cta);
    ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
      var el = $('plat-' + p);
      if (el) el.checked = !data.platforms || data.platforms.indexOf(p) !== -1;
    });
    var assets = data.assets || ['youtube_thumb', 'vertical', 'quote_card'];
    ['youtube_thumb', 'vertical', 'quote_card', 'motion'].forEach(function (a) {
      var el = $('asset-' + a);
      if (el) el.checked = assets.indexOf(a) !== -1;
    });
    if (fromHandoff) {
      /* keep banner */
    }
  }

  function imageCreditsNeed() {
    return imageQuality === 'premium' ? IMAGE_PREMIUM_CREDITS : IMAGE_CREDITS;
  }

  function ctaLine(cta) {
    var map = {
      none: '',
      subscribe: 'Subscribe for more',
      link: 'Link in bio',
      watch: 'Watch the full video',
      comment: 'Drop your question below'
    };
    return map[cta] || '';
  }

  function platformFraming(platforms) {
    var notes = [];
    if (platforms.indexOf('youtube') !== -1) notes.push('YouTube safe margins for UI chrome');
    if (platforms.indexOf('tiktok') !== -1) notes.push('TikTok caption bar at bottom');
    if (platforms.indexOf('instagram') !== -1) notes.push('IG feed + Reels crop awareness');
    if (platforms.indexOf('facebook') !== -1) notes.push('Facebook feed also reads well at 1:1 or 16:9');
    return notes.length ? notes.join(' · ') : 'General social framing';
  }

  function buildPack(data) {
    var type = VIDEO_TYPES[data.videoType] || VIDEO_TYPES.tutorial;
    var toneLine = TONES[data.tone] || TONES.educational;
    var vibeLine = type.vibe + ', ' + toneLine + '. ';
    var hook = firstHook(data.brief);
    var mood = extractMood(data.brief);
    var audience = extractAudience(data.brief);
    var titles = shortTitles(data.brief, data.videoType, data.cta);
    var cta = ctaLine(data.cta);
    var framing = platformFraming(data.platforms);
    var audienceBit = audience ? ' Aimed at ' + audience + '.' : '';

    var items = [];
    var checklist = [
      'Pick one message from the brief (not five)',
      'Keep burned-in text under ~6 words on thumbs',
      'Export masters at the listed pixel sizes before upload compresses them',
      'Face or hero subject should stay large and high-contrast',
      'Write publish titles next in Video SEO: https://keyweaver.io/video-seo',
      'Plan the shoot in Shot List: https://keyweaver.io/shot-list'
    ];

    if (data.platforms.indexOf('facebook') !== -1) {
      checklist.splice(4, 0, 'Facebook: reuse the IG square or YouTube 16:9 - do not invent a fifth layout');
    }

    if (data.assets.indexOf('youtube_thumb') !== -1) {
      items.push({
        id: 'youtube_thumb',
        kind: 'image',
        tab: 'youtube',
        tabLabel: 'YouTube',
        title: 'YouTube thumbnail',
        meta: ASPECT.youtube_thumb.ratio + ' · ' + ASPECT.youtube_thumb.pixels,
        framing: framing,
        prompt:
          vibeLine +
          'YouTube thumbnail still, 16:9 landscape. ' +
          type.frame +
          '. Big readable title space for the words "' +
          titles[0] +
          '". Mood: ' +
          mood +
          '.' +
          audienceBit +
          ' Hook idea (do not print the whole brief): ' +
          hook +
          '. Soft studio or natural light, face or hero product large, high contrast, no watermark, no cluttered UI chrome, no fake play button.',
        titles: titles.slice(0, 4),
        aspect: ASPECT.youtube_thumb.fal,
        recipe:
          'Render or crop to 1280×720 (16:9). Leave safe margin for YouTube UI. Prefer faces or the hero subject large. Burn in one short line only.'
      });
    }

    if (data.assets.indexOf('vertical') !== -1) {
      items.push({
        id: 'vertical',
        kind: 'image',
        tab: 'tiktok',
        tabLabel: 'TikTok',
        title: 'TikTok / Reels / Shorts cover',
        meta: ASPECT.vertical.ratio + ' · ' + ASPECT.vertical.pixels,
        framing: framing,
        prompt:
          vibeLine +
          'Vertical 9:16 cover still for short-form video. ' +
          type.frame +
          '. Subject in the upper two-thirds. Hook: "' +
          hook +
          '". Mood: ' +
          mood +
          '.' +
          audienceBit +
          ' Phone-native composition, room for caption UI at the bottom, clean high-contrast look, no watermark, no busy stickers.',
        titles: [titles[1] || titles[0], titles[3] || titles[2]].filter(Boolean),
        aspect: ASPECT.vertical.fal,
        recipe:
          '1080×1920. Keep faces and text above the lower 20% (caption and UI safe zone). Works for TikTok, Reels, and Shorts.'
      });
    }

    if (data.assets.indexOf('quote_card') !== -1) {
      items.push({
        id: 'quote_card',
        kind: 'image',
        tab: 'instagram',
        tabLabel: 'Instagram',
        title: 'Instagram square / title card',
        meta: ASPECT.quote_card.ratio + ' · ' + ASPECT.quote_card.pixels,
        framing: framing,
        prompt:
          vibeLine +
          'Minimal square title card, bold centered type reading "' +
          titles[0] +
          '", charcoal or soft gradient background, generous negative space, creator-social look. Optional small subtitle: "' +
          (cta || hook) +
          '". Mood: ' +
          mood +
          '. No fake app-store badges, no unrelated brand logos.',
        titles: [titles[0], titles[2], cta].filter(Boolean),
        aspect: '1:1',
        recipe:
          '1080×1080 for Instagram feed. Type should stay legible at ~320px wide. Duplicate as 16:9 if you also need a landscape title card.'
      });
    }

    if (data.assets.indexOf('motion') !== -1) {
      var motionAspect =
        data.platforms.indexOf('youtube') !== -1 && data.platforms.length === 1 ? '16:9' : '9:16';
      items.push({
        id: 'motion',
        kind: 'video',
        tab: 'motion',
        tabLabel: 'Motion',
        title: 'Short motion teaser',
        meta: '4s · ' + motionAspect + ' · ' + VIDEO_CREDITS + ' purchased credits to render',
        framing: framing,
        prompt:
          vibeLine +
          '4-second cinematic social teaser, ' +
          motionAspect +
          '. Slow push-in, subtle motion, room for a title overlay. Hook: "' +
          hook +
          '". Mood: ' +
          mood +
          '.' +
          audienceBit +
          ' Smooth camera, soft lighting, no rapid cuts, no logos of other brands. End on a clean frame ready for text.',
        titles: titles.slice(0, 2),
        aspect: motionAspect,
        recipe:
          '4s motion, ~720p. Prefer stills first. Video is a purchased-credit add-on. Not a music-license substitute.'
      });
      checklist.push('Motion: render stills first; video is the expensive purchased-credit add-on');
    }

    return {
      items: items,
      checklist: checklist,
      titles: titles,
      cta: cta,
      videoType: type.label,
      hook: hook,
      mood: mood
    };
  }

  function copyText(text, btn) {
    function ok() {
      if (!btn) return;
      var prev = btn.textContent;
      btn.textContent = 'Copied';
      btn.classList.add('is-done');
      setTimeout(function () {
        btn.textContent = prev;
        btn.classList.remove('is-done');
      }, 1200);
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
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
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

  function setLoading(on) {
    var el = $('ckit-loading');
    if (el) el.hidden = !on;
  }

  function setPaywall(on) {
    var el = $('ckit-paywall');
    if (el) el.hidden = !on;
  }

  function renderGateReason(need) {
    if (!getToken()) {
      return {
        ok: false,
        reason:
          'Sign in to render. AI render needs purchased credits. <a href="' +
          loginHref() +
          '">Sign in</a> · <a href="/pricing">Buy credits</a>'
      };
    }
    if (!creditsState) {
      return { ok: false, reason: 'Checking purchased credit balance…' };
    }
    if (!creditsState.hasPaid || creditsState.paidRemaining <= 0) {
      return {
        ok: false,
        reason:
          'Signed in with 0 purchased credits. Free signup credits cannot cover AI render. ' +
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

  function resetTurnstile() {
    if (window.CuemarkTurnstile) {
      CuemarkTurnstile.reset('ckit-turnstile');
    }
  }

  function withTurnstile(run) {
    if (window.CuemarkTurnstile && CuemarkTurnstile.enabled && CuemarkTurnstile.enabled()) {
      return CuemarkTurnstile.requireToken('ckit-turnstile').then(run);
    }
    if (window.CuemarkTurnstile) {
      return CuemarkTurnstile.loadConfig().then(function () {
        if (CuemarkTurnstile.enabled()) {
          return CuemarkTurnstile.requireToken('ckit-turnstile').then(run);
        }
        return run('');
      });
    }
    return Promise.resolve(run(''));
  }

  function renderSelected(item, textarea, statusEl, previewHost, renderBtn) {
    var token = getToken();
    var need = item.kind === 'video' ? VIDEO_CREDITS : imageCreditsNeed();
    var gate = renderGateReason(need);
    if (!gate.ok) {
      setStatus(statusEl, gate.reason, 'err', true);
      if (!getToken() || (creditsState && creditsState.paidRemaining < need)) {
        setPaywall(true);
      }
      return;
    }
    setPaywall(false);
    setBusy(renderBtn, true, 'Rendering…');
    setStatus(statusEl, 'Rendering… this can take up to a minute.', null);

    withTurnstile(function (turnstileToken) {
      var body = {
        kind: item.kind,
        prompt: textarea.value,
        aspect_ratio: item.aspect || '16:9',
        quality: item.kind === 'image' ? imageQuality : undefined,
        duration: item.kind === 'video' ? '4' : undefined,
        turnstile_token: turnstileToken || undefined
      };
      return fetch(BACKEND + '/api/campaign-kit/render', {
        method: 'POST',
        headers: Auth && Auth.authHeaders
          ? Auth.authHeaders()
          : {
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
          resetTurnstile();
          if (x.res.status === 503 && x.data && x.data.reason === 'provider_not_configured') {
            setStatus(
              statusEl,
              'AI render is temporarily unavailable. Your free pack still works. Try again later.',
              'err'
            );
            syncRenderButtons();
            return;
          }
          if (x.res.status === 400 && x.data && /security check/i.test(x.data.error || '')) {
            setStatus(statusEl, (x.data && x.data.error) || 'Complete the security check, then try again.', 'err');
            syncRenderButtons();
            return;
          }
          if (x.res.status === 401) {
            if (Auth && Auth.clearToken) Auth.clearToken();
            creditsState = null;
            setStatus(
              statusEl,
              'Session expired. <a href="' + loginHref() + '">Sign in</a> again to render.',
              'err',
              true
            );
            updateCreditsPanel();
            return;
          }
          if (x.res.status === 402) {
            var needCr = x.data && x.data.credits_required != null ? x.data.credits_required : need;
            var paidLeft =
              x.data && x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : 0;
            setPaywall(true);
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
                'Not enough credits (need ' + needCr + '). ' + purchaseLinksHtml(),
                'err',
                true
              );
            }
            updateCreditsPanel();
            return;
          }
          if (!x.res.ok) {
            setStatus(
              statusEl,
              (x.data && x.data.error) || 'Render failed. No charge if the provider failed.',
              'err'
            );
            syncRenderButtons();
            return;
          }
          var url = x.data.url;
          var charged = x.data.credits_charged != null ? x.data.credits_charged : need;
          var paidRemain =
            x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : null;
          setStatus(
            statusEl,
            'Done. Charged ' +
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
            a.textContent = 'Open file';
            previewHost.appendChild(a);
          }
        })
        .catch(function () {
          setBusy(renderBtn, false);
          resetTurnstile();
          setStatus(statusEl, 'Network error talking to Keyweaver. Try again in a moment.', 'err');
          syncRenderButtons();
        });
    }).catch(function (err) {
      setBusy(renderBtn, false);
      setStatus(
        statusEl,
        (err && err.message) || 'Please complete the security check.',
        'err'
      );
      syncRenderButtons();
    });
  }

  function selectTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('#ckit-tabs .ckit-tab').forEach(function (btn) {
      btn.setAttribute('aria-selected', btn.dataset.tab === tabId ? 'true' : 'false');
    });
    document.querySelectorAll('#ckit-results-body .ckit-panel').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.dataset.tab === tabId);
    });
  }

  function buildAssetPanel(item) {
    var panel = document.createElement('div');
    panel.className = 'ckit-panel';
    panel.dataset.tab = item.tab;
    panel.dataset.kind = item.kind;
    panel.id = 'ckit-panel-' + item.id;
    panel.setAttribute('role', 'tabpanel');

    var head = document.createElement('div');
    head.className = 'ckit-panel-head';
    var h = document.createElement('h3');
    h.textContent = item.title;
    head.appendChild(h);
    panel.appendChild(head);

    var sub = document.createElement('p');
    sub.className = 'plat-sub';
    sub.textContent = item.meta + (item.framing ? ' · ' + item.framing : '');
    panel.appendChild(sub);

    var recipe = document.createElement('p');
    recipe.className = 'ckit-recipe';
    recipe.innerHTML = '<strong>Aspect recipe:</strong> ' + item.recipe;
    panel.appendChild(recipe);

    if (item.titles && item.titles.length) {
      var burnWrap = document.createElement('div');
      burnWrap.className = 'ckit-burnins';
      burnWrap.setAttribute('aria-label', 'Burn-in text options');
      item.titles.forEach(function (t) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ckit-burnin';
        chip.textContent = t;
        chip.title = 'Copy burn-in text';
        chip.addEventListener('click', function () {
          copyText(t, chip);
        });
        burnWrap.appendChild(chip);
      });
      panel.appendChild(burnWrap);
    }

    var field = document.createElement('div');
    field.className = 'ckit-field-out';
    var fieldHead = document.createElement('div');
    fieldHead.className = 'ckit-field-out-head';
    var lab = document.createElement('label');
    lab.textContent = 'Prompt';
    lab.setAttribute('for', 'ckit-prompt-' + item.id);
    fieldHead.appendChild(lab);
    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'ckit-copy';
    copyBtn.textContent = 'Copy';
    fieldHead.appendChild(copyBtn);
    field.appendChild(fieldHead);

    var ta = document.createElement('textarea');
    ta.id = 'ckit-prompt-' + item.id;
    ta.rows = 6;
    ta.value = item.prompt;
    ta.setAttribute('aria-label', item.title + ' prompt');
    field.appendChild(ta);
    panel.appendChild(field);

    copyBtn.addEventListener('click', function () {
      copyText(ta.value, copyBtn);
    });

    var actions = document.createElement('div');
    actions.className = 'ckit-card-actions';

    if (item.kind === 'image') {
      var qualWrap = document.createElement('label');
      qualWrap.className = 'ckit-quality';
      var qualCheck = document.createElement('input');
      qualCheck.type = 'checkbox';
      qualCheck.checked = imageQuality === 'premium';
      qualCheck.addEventListener('change', function () {
        imageQuality = qualCheck.checked ? 'premium' : 'standard';
        syncRenderButtons();
      });
      qualWrap.appendChild(qualCheck);
      qualWrap.appendChild(
        document.createTextNode(' Premium (' + IMAGE_PREMIUM_CREDITS + ' credits)')
      );
      actions.appendChild(qualWrap);
    }

    var renderBtn = document.createElement('button');
    renderBtn.type = 'button';
    renderBtn.className = 'btn btn-primary';
    renderBtn.dataset.role = 'render';
    actions.appendChild(renderBtn);

    var status = document.createElement('p');
    status.className = 'ckit-render-status';
    status.dataset.role = 'render-status';
    actions.appendChild(status);

    panel.appendChild(actions);

    var preview = document.createElement('div');
    preview.className = 'ckit-preview-host';
    panel.appendChild(preview);

    renderBtn.addEventListener('click', function () {
      renderSelected(item, ta, status, preview, renderBtn);
    });

    return panel;
  }

  function buildChecklistPanel(pack) {
    var panel = document.createElement('div');
    panel.className = 'ckit-panel';
    panel.dataset.tab = 'checklist';
    panel.id = 'ckit-panel-checklist';
    panel.setAttribute('role', 'tabpanel');

    var head = document.createElement('div');
    head.className = 'ckit-panel-head';
    var h = document.createElement('h3');
    h.textContent = 'Publish checklist';
    head.appendChild(h);
    panel.appendChild(head);

    var sub = document.createElement('p');
    sub.className = 'plat-sub';
    sub.textContent =
      pack.videoType +
      (pack.hook ? ' · Hook: ' + pack.hook : '') +
      (pack.mood ? ' · Mood: ' + pack.mood : '');
    panel.appendChild(sub);

    var ul = document.createElement('ul');
    ul.className = 'ckit-checklist';
    pack.checklist.forEach(function (line) {
      var li = document.createElement('li');
      li.textContent = line;
      ul.appendChild(li);
    });
    panel.appendChild(ul);
    return panel;
  }

  function renderResults(data) {
    var pack = buildPack(data);
    lastPack = pack;
    var host = $('ckit-results-body');
    var tabs = $('ckit-tabs');
    var empty = $('ckit-empty');
    host.innerHTML = '';
    tabs.innerHTML = '';
    if (empty) empty.classList.add('is-hidden');
    setLoading(false);

    var tabItems = pack.items.slice();
    tabItems.push({ id: 'checklist', tab: 'checklist', tabLabel: 'Checklist' });

    tabItems.forEach(function (item, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ckit-tab';
      btn.setAttribute('role', 'tab');
      btn.dataset.tab = item.tab;
      btn.id = 'ckit-tab-' + item.tab;
      btn.textContent = item.tabLabel;
      btn.addEventListener('click', function () {
        selectTab(item.tab);
      });
      tabs.appendChild(btn);

      if (item.tab === 'checklist') {
        host.appendChild(buildChecklistPanel(pack));
      } else {
        host.appendChild(buildAssetPanel(item));
      }

      if (index === 0) activeTab = item.tab;
    });

    selectTab(activeTab || (pack.items[0] && pack.items[0].tab) || 'checklist');
    syncRenderButtons();
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
      next.classList.remove('is-zero');
      next.classList.add('is-ok');
    }
  }

  function syncCreditActions() {
    var signin = $('ckit-credits-signin');
    var buy = $('ckit-credits-buy');
    var account = $('ckit-credits-account');
    var token = getToken();
    var paidRemaining =
      token && creditsState ? creditsState.paidRemaining : token ? null : 0;
    if (Auth && Auth.syncCreditActions) {
      Auth.syncCreditActions({
        signin: signin,
        buy: buy,
        account: account,
        nextPath: '/campaign-kit',
        signedIn: !!token,
        paidRemaining: paidRemaining,
        signinLabel: 'Sign in to render'
      });
    }
  }

  function syncTurnstileVisibility() {
    var wrap = $('ckit-turnstile-wrap');
    if (!wrap) return;
    var token = getToken();
    var canRender =
      !!token &&
      creditsState &&
      creditsState.paidRemaining >= IMAGE_CREDITS;
    if (!canRender) {
      wrap.hidden = true;
      wrap.style.display = 'none';
      return;
    }
    if (window.CuemarkTurnstile) {
      wrap.hidden = false;
      CuemarkTurnstile.prepare('ckit-turnstile-wrap', 'ckit-turnstile')
        .then(function () {
          var on = !!(CuemarkTurnstile.enabled && CuemarkTurnstile.enabled());
          wrap.hidden = !on;
          wrap.style.display = on ? '' : 'none';
        })
        .catch(function () {
          wrap.hidden = true;
          wrap.style.display = 'none';
        });
    } else {
      wrap.hidden = true;
      wrap.style.display = 'none';
    }
  }

  function syncRenderButtons() {
    syncCreditCostHighlights();
    var anyBlockedPaid = false;
    document.querySelectorAll('#ckit-results-body .ckit-panel[data-kind]').forEach(function (panel) {
      var btn = panel.querySelector('button[data-role="render"]');
      var status = panel.querySelector('[data-role="render-status"]');
      if (!btn || btn.classList.contains('is-busy')) return;
      var kind = panel.dataset.kind === 'video' ? 'video' : 'image';
      var need = kind === 'video' ? VIDEO_CREDITS : imageCreditsNeed();
      if (kind === 'video') {
        btn.textContent = 'Render video · ' + VIDEO_CREDITS + ' credits';
      } else {
        btn.textContent =
          'Render image · ' +
          need +
          ' credit' +
          (need === 1 ? '' : 's') +
          (imageQuality === 'premium' ? ' (premium)' : '');
      }
      var gate = renderGateReason(need);
      btn.disabled = !gate.ok;
      btn.classList.toggle('is-disabled', !gate.ok);
      btn.title = gate.ok
        ? 'Charges ' + need + ' purchased credits'
        : 'Purchased credits required';
      if (status && !status.classList.contains('is-ok')) {
        status.innerHTML = gate.reason;
        status.classList.toggle('is-err', !gate.ok);
        status.classList.remove('is-ok');
      }
      var qual = panel.querySelector('.ckit-quality input[type="checkbox"]');
      if (qual) qual.checked = imageQuality === 'premium';
      if (!gate.ok && getToken() && creditsState && creditsState.paidRemaining < need) {
        anyBlockedPaid = true;
      }
    });
    setPaywall(anyBlockedPaid && !!$('ckit-results').classList.contains('is-visible'));
    syncTurnstileVisibility();
  }

  function updateCreditsPanel() {
    var bal = $('ckit-balance');
    var meter = $('ckit-credit-meter');
    var paidEl = $('ckit-paid-value');
    var poolEl = $('ckit-pool-value');
    var token = getToken();
    syncCreditActions();
    if (!token) {
      creditsState = null;
      if (meter) meter.hidden = true;
      if (bal) {
        bal.className = 'tools-credit-status is-warn';
        bal.textContent =
          'Sign in to see purchased credits and unlock AI render. The free pack never charges.';
      }
      setPaywall(false);
      syncRenderButtons();
      return;
    }
    if (bal) {
      bal.className = 'tools-credit-status';
      bal.textContent = 'Checking purchased credit balance…';
    }

    function applyCredits(snap) {
      if (!bal) return;
      if (!snap || !snap.ok) {
        creditsState = null;
        if (meter) meter.hidden = true;
        if (snap && snap.unauthorized) {
          bal.className = 'tools-credit-status is-warn';
          bal.innerHTML =
            'Session expired. <a href="' + loginHref() + '">Sign in</a> to unlock AI render.';
        } else {
          bal.className = 'tools-credit-status is-err';
          bal.innerHTML =
            'Could not load credits. Try <a href="/account">Account</a> or refresh.';
        }
        syncCreditActions();
        syncRenderButtons();
        return;
      }
      creditsState = {
        remaining: snap.remaining,
        total: snap.total,
        paidRemaining: snap.paidRemaining,
        hasPaid: snap.hasPaid
      };
      if (meter) meter.hidden = false;
      if (paidEl) {
        paidEl.textContent = String(snap.paidRemaining);
        paidEl.classList.toggle('is-zero', snap.paidRemaining <= 0);
        paidEl.classList.toggle('is-ok', snap.paidRemaining > 0);
      }
      if (poolEl) {
        poolEl.textContent = snap.remaining + ' / ' + snap.total;
      }
      if (snap.paidRemaining <= 0) {
        bal.className = 'tools-credit-status is-warn';
        bal.innerHTML =
          'Signed in with <strong>0 purchased credits</strong>. Free signup credits cannot run AI render. ' +
          purchaseLinksHtml();
      } else {
        bal.className = 'tools-credit-status is-ok';
        bal.textContent =
          'Ready to render. Purchased credits: ' +
          snap.paidRemaining +
          '. Image ' +
          IMAGE_CREDITS +
          ' · premium ' +
          IMAGE_PREMIUM_CREDITS +
          ' · video ' +
          VIDEO_CREDITS +
          '.';
      }
      syncCreditActions();
      syncRenderButtons();
    }

    if (Auth && Auth.fetchCredits) {
      Auth.fetchCredits().then(applyCredits);
      return;
    }
    applyCredits({ ok: false, unauthorized: false });
  }

  function packAsText() {
    if (!lastPack) return '';
    var lines = ['Campaign Kit pack', '=================', ''];
    lastPack.items.forEach(function (item, i) {
      lines.push((i + 1) + '. ' + item.title);
      lines.push(item.meta);
      lines.push('Recipe: ' + item.recipe);
      if (item.titles && item.titles.length) {
        lines.push('Burn-in options: ' + item.titles.join(' · '));
      }
      lines.push('');
      lines.push(item.prompt);
      lines.push('');
      lines.push('---');
      lines.push('');
    });
    lines.push('Checklist');
    lastPack.checklist.forEach(function (c) {
      lines.push('- ' + c);
    });
    return lines.join('\n');
  }

  function downloadPack() {
    var text = packAsText();
    if (!text) return;
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'campaign-kit-pack.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 500);
  }

  function generate() {
    var err = $('ckit-error');
    err.classList.remove('is-visible');
    err.textContent = '';
    var data = readForm();
    if (!data.brief || data.brief.length < 12) {
      err.textContent = 'Add a short video brief (at least a sentence) so we can shape asset prompts.';
      err.classList.add('is-visible');
      $('ckit-brief').focus();
      return;
    }
    if (!data.assets.length) {
      err.textContent = 'Select at least one asset type under Asset types.';
      err.classList.add('is-visible');
      return;
    }
    var submit = $('ckit-submit');
    setBusy(submit, true, 'Building…');
    setLoading(true);
    var empty = $('ckit-empty');
    if (empty) empty.classList.add('is-hidden');
    $('ckit-results').classList.remove('is-visible');
    saveForm(data);
    setTimeout(function () {
      renderResults(data);
      setBusy(submit, false);
      if (submit) {
        submit.disabled = false;
        submit.classList.remove('is-disabled');
      }
    }, 180);
  }

  function clearAll() {
    $('ckit-brief').value = '';
    if ($('ckit-video-type')) $('ckit-video-type').value = 'tutorial';
    if ($('ckit-tone')) $('ckit-tone').value = 'educational';
    $('ckit-cta').value = 'none';
    ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
      var el = $('plat-' + p);
      if (el) el.checked = true;
    });
    ['youtube_thumb', 'vertical', 'quote_card'].forEach(function (a) {
      var el = $('asset-' + a);
      if (el) el.checked = true;
    });
    var motionEl = $('asset-motion');
    if (motionEl) motionEl.checked = false;
    imageQuality = 'standard';
    lastPack = null;
    activeTab = '';
    $('ckit-results').classList.remove('is-visible');
    $('ckit-results-body').innerHTML = '';
    $('ckit-tabs').innerHTML = '';
    var empty = $('ckit-empty');
    if (empty) empty.classList.remove('is-hidden');
    var banner = $('ckit-handoff-banner');
    if (banner) {
      banner.hidden = true;
      banner.innerHTML = '';
    }
    setLoading(false);
    setPaywall(false);
    var err = $('ckit-error');
    if (err) {
      err.classList.remove('is-visible');
      err.textContent = '';
    }
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
    updateCreditsPanel();

    if (window.CuemarkTurnstile) {
      CuemarkTurnstile.prepare('ckit-turnstile-wrap', 'ckit-turnstile').catch(function () {});
    }

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
          var panel = ta.closest('.ckit-panel');
          var title = panel ? (panel.querySelector('h3') || {}).textContent || ('Asset ' + (i + 1)) : 'Asset ' + (i + 1);
          chunks.push('--- ' + title + ' ---\n' + ta.value);
        });
        if (!chunks.length) return;
        copyText(chunks.join('\n\n'), copyAll);
      });
    }

    var dl = $('ckit-download');
    if (dl) dl.addEventListener('click', downloadPack);

    document.addEventListener('click', function (e) {
      document.querySelectorAll('.nav-products[open]').forEach(function (d) {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
  });
})();
