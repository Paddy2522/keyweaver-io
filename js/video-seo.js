(function () {
  'use strict';

  var STORAGE_KEY = 'keyweaver.videoSeo.lastBrief';
  var HISTORY_KEY = 'keyweaver.videoSeo.history';
  var CKIT_KEY = 'keyweaver.campaignKit.lastBrief';
  var SHOT_KEY = 'keyweaver.shotList.lastBrief';
  var Auth = window.KeyweaverToolsAuth;
  var BACKEND = (Auth && Auth.BACKEND) || 'https://keyweaver-backend.vercel.app';
  /** Must match .backend-checkout/lib/video-seo-policy.ts */
  var AI_CREDITS = 2;
  var REFINE_CREDITS = 1;
  var PRO_TRANSCRIPT_CREDITS = 3;
  var PRO_AUDIO_CREDITS = 6;
  var FREE_LIMIT = 2;
  var HISTORY_MAX = 5;
  /** @type {{ remaining: number, total: number, paidRemaining: number, hasPaid: boolean, freeRemaining: number, freeUsed: number } | null} */
  var creditsState = null;
  var activeTab = '';
  /** @type {object|null} */
  var lastResults = null;
  /** @type {object|null} */
  var lastFormData = null;
  var showingDemo = false;

  var PLATFORM_META = {
    youtube: { label: 'YouTube', sub: 'Titles under ~70 chars. Hook the description in the first two lines.' },
    tiktok: { label: 'TikTok', sub: 'Hook first. Keep hashtags light and relevant.' },
    instagram: { label: 'Instagram', sub: 'Skimmable caption. Hashtags optional.' },
    facebook: { label: 'Facebook', sub: 'Lead with the outcome for people skimming the feed.' }
  };

  /** Static CapCut tutorial sample — no LLM. */
  var DEMO_BRIEF =
    '8-minute CapCut tutorial for TikTok creators who want cleaner cuts and on-screen text. Honest walkthrough. CTA: subscribe for weekly editing tips.';
  var DEMO_KEYWORDS = 'capcut tutorial, tiktok editing, on screen text';
  var DEMO_RESULTS = {
    youtube: {
      titles: [
        'CapCut Cuts That Look Expensive (TikTok Editors)',
        'Stop Muddy CapCut Edits — 5 Clean Text Tricks',
        'The CapCut Text Timing Trick I Use Weekly'
      ],
      description:
        'Cleaner CapCut cuts and on-screen text without the mess.\n\n' +
        'This walkthrough is for TikTok creators who already open CapCut but still get muddy timing, uneven text, and exports that feel soft.\n\n' +
        'What you get:\n' +
        '- A simple cut rhythm that reads on mobile\n' +
        '- On-screen text that lands with the beat\n' +
        '- Export settings that keep sharpness\n\n' +
        'Chapters below. Subscribe for weekly editing tips.',
      tags:
        'capcut tutorial, tiktok editing, on screen text, capcut text, mobile editing, short form editing, tiktok creators, capcut tips, video editing tutorial',
      pinned: 'Which CapCut headache should I cover next — cuts, captions, or export? Drop it below.',
      chapters:
        '0:00 Hook\n1:20 Setup in CapCut\n3:10 Text + captions tip\n5:40 Export settings\n7:10 CTA',
      thumbs: ['CLEAN CUTS', 'TEXT THAT HITS', 'STOP MUDDY EDITS']
    },
    tiktok: {
      caption:
        'CapCut looking muddy? Here’s the cut + on-screen text rhythm I use so edits feel sharp on TikTok.\n\nSave this for your next edit. Follow for weekly CapCut tips.',
      hashtags: '#capcut #tiktokediting #capcuttutorial #onscreentext #editingtips'
    },
    instagram: {
      caption:
        'If your CapCut cuts feel soft and your text lands late, this 8-minute walkthrough fixes the rhythm.\n\nBuilt for TikTok creators who want cleaner mobile edits — cuts, on-screen text, export.\n\nSave + try it on your next clip.',
      hashtags: '#capcut #tiktokediting #capcuttutorial #reelsediting #onscreentext #creatorTips'
    },
    facebook: {
      post:
        'New CapCut tutorial for TikTok creators: cleaner cuts and on-screen text that actually lands.\n\nHonest 8-minute walkthrough — rhythm, text timing, and export settings that keep things sharp.\n\nWatch + subscribe for weekly editing tips.'
    },
    keywordCoverage: ['capcut tutorial', 'tiktok editing', 'on screen text']
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

  function parseDurationMinutes(raw) {
    if (raw == null || raw === '') return null;
    var n = Number(raw);
    if (!isFinite(n) || n <= 0) return null;
    return Math.min(180, Math.max(1, Math.round(n)));
  }

  function readForm() {
    var durationEl = $('vseo-duration');
    return {
      brief: cleanText($('vseo-brief').value),
      keywords: cleanText($('vseo-keywords').value),
      tone: $('vseo-tone').value || 'educational',
      cta: $('vseo-cta').value || 'none',
      outline: cleanText($('vseo-outline').value),
      platforms: selectedPlatforms(),
      durationMinutes: parseDurationMinutes(durationEl ? durationEl.value : '')
    };
  }

  function applyFormToFields(data) {
    if (!data) return;
    if (data.brief != null) $('vseo-brief').value = data.brief;
    if (data.keywords != null) $('vseo-keywords').value = data.keywords;
    if (data.tone) $('vseo-tone').value = data.tone;
    if (data.cta) $('vseo-cta').value = data.cta;
    if (data.outline != null) $('vseo-outline').value = data.outline;
    var dur = $('vseo-duration');
    if (dur) {
      dur.value =
        data.durationMinutes != null && data.durationMinutes > 0
          ? String(data.durationMinutes)
          : '';
    }
    if (Array.isArray(data.platforms) && data.platforms.length) {
      ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
        var el = $('plat-' + p);
        if (el) el.checked = data.platforms.indexOf(p) !== -1;
      });
    }
  }

  function saveForm(data, results) {
    try {
      var payload = {
        brief: data.brief,
        keywords: data.keywords,
        tone: data.tone,
        cta: data.cta,
        outline: data.outline,
        platforms: data.platforms,
        durationMinutes: data.durationMinutes || null
      };
      if (results) payload.results = results;
      else if (lastResults) payload.results = lastResults;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) { /* ignore */ }
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
    } catch (e) { /* ignore */ }
  }

  function pushHistory(data, results) {
    if (!results || !data || !data.brief) return;
    var entry = {
      id: String(Date.now()),
      ts: Date.now(),
      brief: data.brief,
      snippet: data.brief.slice(0, 72) + (data.brief.length > 72 ? '…' : ''),
      keywords: data.keywords || '',
      tone: data.tone,
      cta: data.cta,
      outline: data.outline || '',
      platforms: data.platforms || [],
      durationMinutes: data.durationMinutes || null,
      results: results
    };
    var list = loadHistory().filter(function (h) {
      return h && h.brief !== data.brief;
    });
    list.unshift(entry);
    saveHistory(list);
    renderHistory();
  }

  function formatHistoryTime(ts) {
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  }

  function renderHistory() {
    var wrap = $('vseo-history');
    var listEl = $('vseo-history-list');
    if (!wrap || !listEl) return;
    var list = loadHistory();
    listEl.innerHTML = '';
    if (!list.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    list.forEach(function (entry) {
      var li = document.createElement('li');
      li.className = 'vseo-history-item';
      var meta = document.createElement('div');
      meta.className = 'vseo-history-meta';
      var snip = document.createElement('p');
      snip.className = 'vseo-history-snippet';
      snip.textContent = entry.snippet || (entry.brief || '').slice(0, 72);
      var time = document.createElement('span');
      time.className = 'vseo-history-time';
      time.textContent = formatHistoryTime(entry.ts);
      meta.appendChild(snip);
      meta.appendChild(time);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost vseo-history-restore';
      btn.textContent = 'Restore';
      btn.addEventListener('click', function () {
        restorePack(entry);
      });
      li.appendChild(meta);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function restorePack(entry) {
    if (!entry) return;
    showingDemo = false;
    var data = {
      brief: entry.brief || '',
      keywords: entry.keywords || '',
      tone: entry.tone || 'educational',
      cta: entry.cta || 'none',
      outline: entry.outline || '',
      platforms: entry.platforms || ['youtube', 'tiktok', 'instagram', 'facebook'],
      durationMinutes: entry.durationMinutes || null
    };
    applyFormToFields(data);
    lastFormData = data;
    if (entry.results) {
      lastResults = entry.results;
      saveForm(data, entry.results);
      renderResults(data, entry.results, { isDemo: false });
      setFormError('Restored pack from history.', false, 'ok');
    } else {
      lastResults = null;
      saveForm(data, null);
      hideResults();
      setFormError('Restored brief — hit Generate for a new pack.', false, 'ok');
    }
  }

  function loadForm() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        applyFormToFields(data);
        lastFormData = {
          brief: data.brief || '',
          keywords: data.keywords || '',
          tone: data.tone || 'educational',
          cta: data.cta || 'none',
          outline: data.outline || '',
          platforms: data.platforms || selectedPlatforms(),
          durationMinutes: data.durationMinutes || null
        };
        if (data.results && typeof data.results === 'object') {
          lastResults = data.results;
          renderResults(lastFormData, data.results, { isDemo: false, skipScroll: true });
          return;
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
      syncRefineUi();
      syncProButton();
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
    return AI_CREDITS + ' / ' + REFINE_CREDITS + ' cr';
  }

  function canGenerate(cost) {
    var need = cost == null ? AI_CREDITS : cost;
    if (!getToken()) return { ok: false, reason: 'signin', cost: need };
    if (!creditsState) return { ok: false, reason: 'loading', cost: need };
    var free = freeRemaining();
    if (free > 0) return { ok: true, reason: 'free', cost: need };
    if (creditsState.paidRemaining >= need) return { ok: true, reason: 'paid', cost: need };
    return { ok: false, reason: 'paywall', cost: need };
  }

  /** Pro never uses free gens — purchased ledger only. */
  function canGeneratePro(cost) {
    var need = cost == null ? PRO_TRANSCRIPT_CREDITS : cost;
    if (!getToken()) return { ok: false, reason: 'signin', cost: need };
    if (!creditsState) return { ok: false, reason: 'loading', cost: need };
    if (creditsState.paidRemaining >= need) return { ok: true, reason: 'paid', cost: need };
    return { ok: false, reason: 'paywall', cost: need };
  }

  function readProInputs() {
    var transcript = cleanText($('vseo-transcript') ? $('vseo-transcript').value : '');
    var audioEl = $('vseo-audio');
    var file = audioEl && audioEl.files && audioEl.files[0] ? audioEl.files[0] : null;
    return { transcript: transcript, audio: file };
  }

  function hasProInputs() {
    var p = readProInputs();
    return !!(p.transcript || p.audio);
  }

  function proCreditsFor(inputs) {
    return inputs && inputs.audio ? PRO_AUDIO_CREDITS : PRO_TRANSCRIPT_CREDITS;
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
      creditsState.paidRemaining < REFINE_CREDITS;

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
      paywall.hidden = !(
        token &&
        creditsState &&
        free === 0 &&
        creditsState.paidRemaining < AI_CREDITS
      );
    }
  }

  function syncGenerateButton() {
    var btn = $('vseo-generate');
    var note = $('vseo-cost-note');
    var gate = canGenerate(AI_CREDITS);
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
          ' credits for a full pack · ' +
          REFINE_CREDITS +
          ' to refine / one platform. Pro: ' +
          PRO_TRANSCRIPT_CREDITS +
          ' paste / ' +
          PRO_AUDIO_CREDITS +
          ' audio (purchased only). <a href="' +
          loginHref() +
          '">Sign in</a>';
      } else if (!creditsState) {
        note.textContent = 'Checking your free gens and credits…';
      } else if (gate.reason === 'paywall') {
        note.innerHTML =
          'Free gens used. Full pack: ' +
          AI_CREDITS +
          ' credits · refine / one platform: ' +
          REFINE_CREDITS +
          '. ' +
          purchaseLinksHtml();
      } else if (gate.reason === 'free') {
        note.textContent =
          freeRemaining() +
          ' free AI generation' +
          (freeRemaining() === 1 ? '' : 's') +
          ' left · refine also uses a free gen if remaining. Pro always uses purchased credits.';
      } else {
        note.textContent =
          'Full pack: ' +
          AI_CREDITS +
          ' credits · refine / one platform: ' +
          REFINE_CREDITS +
          ' (you have ' +
          creditsState.paidRemaining +
          ').';
      }
    }
    syncProButton();
  }

  function syncProButton() {
    var btn = $('vseo-generate-pro');
    var note = $('vseo-pro-cost-note');
    var inputs = readProInputs();
    var cost = proCreditsFor(inputs);
    var gate = canGeneratePro(cost);
    var hasInput = !!(inputs.transcript || inputs.audio);

    if (btn && !btn.classList.contains('is-busy')) {
      var label = 'Generate with Pro';
      if (getToken() && creditsState) {
        if (inputs.audio) {
          label =
            creditsState.paidRemaining >= PRO_AUDIO_CREDITS
              ? 'Generate with Pro · ' + PRO_AUDIO_CREDITS + ' credits'
              : 'Generate with Pro · buy credits';
        } else if (inputs.transcript) {
          label =
            creditsState.paidRemaining >= PRO_TRANSCRIPT_CREDITS
              ? 'Generate with Pro · ' + PRO_TRANSCRIPT_CREDITS + ' credits'
              : 'Generate with Pro · buy credits';
        } else {
          label = 'Generate with Pro · add transcript or audio';
        }
      } else if (!getToken()) {
        label = 'Generate with Pro · sign in';
      }
      btn.textContent = label;
      btn.disabled = !hasInput || !gate.ok;
      btn.classList.toggle('is-disabled', !hasInput || !gate.ok);
    }

    if (note) {
      if (!getToken()) {
        note.innerHTML =
          'Pro uses purchased credits only · ' +
          PRO_TRANSCRIPT_CREDITS +
          ' paste / ' +
          PRO_AUDIO_CREDITS +
          ' audio. <a href="' +
          loginHref() +
          '">Sign in</a>';
      } else if (!creditsState) {
        note.textContent = 'Checking purchased credits…';
      } else if (!hasInput) {
        note.textContent =
          'Pro uses purchased credits only · ' +
          PRO_TRANSCRIPT_CREDITS +
          ' paste / ' +
          PRO_AUDIO_CREDITS +
          ' audio';
      } else if (gate.reason === 'paywall') {
        note.innerHTML =
          'Need ' +
          cost +
          ' purchased credit' +
          (cost === 1 ? '' : 's') +
          ' for Pro (you have ' +
          creditsState.paidRemaining +
          '). ' +
          purchaseLinksHtml();
      } else {
        note.textContent =
          'Pro · ' +
          cost +
          ' purchased credit' +
          (cost === 1 ? '' : 's') +
          (inputs.audio ? ' (audio + generate)' : ' (transcript + generate)') +
          ' · you have ' +
          creditsState.paidRemaining;
      }
    }

    var nameEl = $('vseo-audio-name');
    if (nameEl) {
      if (inputs.audio) {
        nameEl.hidden = false;
        nameEl.textContent =
          inputs.audio.name +
          ' · ' +
          (Math.round((inputs.audio.size / (1024 * 1024)) * 10) / 10) +
          ' MB';
      } else {
        nameEl.hidden = true;
        nameEl.textContent = '';
      }
    }
  }

  function syncRefineUi() {
    var refine = $('vseo-refine');
    if (!refine) return;
    var show = !!lastResults && !showingDemo;
    refine.hidden = !show;
    if (!show) return;
    var gate = canGenerate(REFINE_CREDITS);
    refine.querySelectorAll('.vseo-chip, .vseo-regen-plat').forEach(function (el) {
      if (el.classList.contains('is-busy')) return;
      el.disabled = !gate.ok;
      el.classList.toggle('is-disabled', !gate.ok);
    });
    document.querySelectorAll('.vseo-regen-plat').forEach(function (el) {
      if (el.classList.contains('is-busy')) return;
      el.disabled = !gate.ok;
      el.classList.toggle('is-disabled', !gate.ok);
      var free = freeRemaining();
      if (getToken() && creditsState) {
        if (free > 0) el.textContent = 'Regenerate this platform · free';
        else el.textContent = 'Regenerate this platform · ' + REFINE_CREDITS + ' cr';
      } else {
        el.textContent = 'Regenerate this platform · ' + REFINE_CREDITS + ' cr';
      }
    });
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
      syncRefineUi();
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
        syncRefineUi();
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
        nextEl.classList.toggle('is-ok', freeRem > 0 || snap.paidRemaining >= REFINE_CREDITS);
        nextEl.classList.toggle('is-zero', freeRem <= 0 && snap.paidRemaining < REFINE_CREDITS);
      }

      if (freeRem > 0) {
        bal.className = 'tools-credit-status is-ok';
        bal.textContent =
          freeRem +
          ' free AI generation' +
          (freeRem === 1 ? '' : 's') +
          ' left. After that, ' +
          AI_CREDITS +
          ' cr full / ' +
          REFINE_CREDITS +
          ' cr refine.';
      } else if (snap.paidRemaining >= AI_CREDITS) {
        bal.className = 'tools-credit-status is-ok';
        bal.textContent =
          'Free gens used. Full pack ' +
          AI_CREDITS +
          ' cr · refine ' +
          REFINE_CREDITS +
          ' cr (' +
          snap.paidRemaining +
          ' available).';
      } else if (snap.paidRemaining >= REFINE_CREDITS) {
        bal.className = 'tools-credit-status is-warn';
        bal.textContent =
          'Enough for refine / one platform (' +
          REFINE_CREDITS +
          ' cr), not a full pack (' +
          AI_CREDITS +
          ').';
      } else {
        bal.className = 'tools-credit-status is-warn';
        bal.innerHTML =
          'Free gens used and no purchased credits. ' + purchaseLinksHtml();
      }
      syncCreditActions();
      syncGenerateButton();
      syncRefineUi();
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

  function downloadBlob(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
    }, 500);
  }

  function countHashtags(str) {
    var m = String(str || '').match(/#[\w\u00c0-\u024f]+/gi);
    return m ? m.length : 0;
  }

  function packToText(data, copy, asMd) {
    var lines = [];
    var h = function (title) {
      if (asMd) lines.push('## ' + title, '');
      else lines.push('=== ' + title + ' ===', '');
    };
    var brief = (data && data.brief) || '';
    if (asMd) {
      lines.push('# Video SEO pack', '', brief ? '> ' + brief.replace(/\n/g, ' ') : '', '');
    } else {
      lines.push('Video SEO pack', brief ? 'Brief: ' + brief : '', '');
    }

    if (copy.youtube) {
      h('YouTube');
      (copy.youtube.titles || []).forEach(function (t, i) {
        lines.push((asMd ? '**Title ' : 'Title ') + String.fromCharCode(65 + i) + (asMd ? ':** ' : ': ') + (t || ''));
      });
      lines.push('', (asMd ? '**Description**' : 'Description'), copy.youtube.description || '', '');
      lines.push((asMd ? '**Tags**' : 'Tags'), copy.youtube.tags || '', '');
      if (copy.youtube.pinned) {
        lines.push((asMd ? '**Pinned**' : 'Pinned'), copy.youtube.pinned, '');
      }
      if (copy.youtube.chapters) {
        lines.push((asMd ? '**Chapters**' : 'Chapters'), copy.youtube.chapters, '');
      }
      (copy.youtube.thumbs || []).forEach(function (t, i) {
        lines.push((asMd ? '**Thumb ' : 'Thumb ') + String.fromCharCode(65 + i) + (asMd ? ':** ' : ': ') + t);
      });
      lines.push('');
    }
    if (copy.tiktok) {
      h('TikTok');
      lines.push(copy.tiktok.caption || '', '', copy.tiktok.hashtags || '', '');
    }
    if (copy.instagram) {
      h('Instagram');
      lines.push(copy.instagram.caption || '', '', copy.instagram.hashtags || '', '');
    }
    if (copy.facebook) {
      h('Facebook');
      lines.push(copy.facebook.post || '', '');
    }
    if (copy.keywordCoverage && copy.keywordCoverage.length) {
      h('Keyword coverage');
      lines.push(copy.keywordCoverage.join(', '), '');
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function downloadPack(fmt) {
    if (!lastResults) return;
    var data = lastFormData || readForm();
    var stamp = new Date().toISOString().slice(0, 10);
    if (fmt === 'md') {
      downloadBlob(
        'keyweaver-video-seo-' + stamp + '.md',
        packToText(data, lastResults, true),
        'text/markdown;charset=utf-8'
      );
    } else {
      downloadBlob(
        'keyweaver-video-seo-' + stamp + '.txt',
        packToText(data, lastResults, false),
        'text/plain;charset=utf-8'
      );
    }
  }

  function renderChecklist(copy) {
    var wrap = $('vseo-checklist');
    var list = $('vseo-checklist-list');
    if (!wrap || !list) return;
    list.innerHTML = '';
    var items = [];

    items.push({
      ok: true,
      text: 'YouTube: put the hook in the first 1–2 description lines (above the fold on mobile).'
    });
    items.push({
      ok: true,
      text: 'YouTube tags: mix broad + specific phrases (topic + niche + format).'
    });

    if (copy.tiktok) {
      var tt = countHashtags(copy.tiktok.hashtags);
      items.push({
        ok: tt >= 3 && tt <= 5,
        text:
          'TikTok hashtags: aim for ~3–5 (you have ' +
          tt +
          '). Skip spam walls.'
      });
    }
    if (copy.instagram) {
      var ig = countHashtags(copy.instagram.hashtags);
      items.push({
        ok: ig >= 5 && ig <= 10,
        text:
          'Instagram hashtags: aim for ~5–10 max (you have ' +
          ig +
          ').'
      });
    }

    if (copy.keywordCoverage && copy.keywordCoverage.length) {
      items.push({
        ok: true,
        text: 'Keyword coverage in this pack: ' + copy.keywordCoverage.join(', ') + '.'
      });
    } else if (copy.keywordCoverage) {
      items.push({
        ok: false,
        text: 'No seed keywords landed in titles/tags/captions — consider a refine with “Force keyword”.'
      });
    }

    items.forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'vseo-check-item' + (it.ok ? ' is-ok' : ' is-warn');
      li.textContent = it.text;
      list.appendChild(li);
    });
    wrap.hidden = false;
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

  function buildPanel(id, fields, copyAllText, opts) {
    opts = opts || {};
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
    var actions = document.createElement('div');
    actions.className = 'vseo-panel-actions';
    var copyAll = document.createElement('button');
    copyAll.type = 'button';
    copyAll.className = 'vseo-copy';
    copyAll.textContent = 'Copy all';
    actions.appendChild(copyAll);
    if (!opts.isDemo) {
      var regen = document.createElement('button');
      regen.type = 'button';
      regen.className = 'vseo-copy vseo-regen-plat';
      regen.setAttribute('data-platform', id);
      regen.textContent = 'Regenerate this platform · ' + REFINE_CREDITS + ' cr';
      regen.addEventListener('click', function () {
        regeneratePlatform(id, regen);
      });
      actions.appendChild(regen);
    }
    head.appendChild(h3);
    head.appendChild(actions);
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

  function hideResults() {
    $('vseo-results').classList.remove('is-visible');
    $('vseo-results-body').innerHTML = '';
    $('vseo-tabs').innerHTML = '';
    var extrasBody = $('vseo-extras-body');
    if (extrasBody) extrasBody.innerHTML = '';
    var extras = $('vseo-extras');
    if (extras) {
      extras.hidden = true;
      extras.dataset.hasContent = '';
    }
    var refine = $('vseo-refine');
    if (refine) refine.hidden = true;
    var checklist = $('vseo-checklist');
    if (checklist) checklist.hidden = true;
    var empty = $('vseo-empty');
    if (empty) empty.classList.remove('is-hidden');
    var title = $('vseo-results-title');
    if (title) title.textContent = 'Your copy';
    var sub = $('vseo-results-sub');
    if (sub) sub.textContent = 'Edit freely, then copy field-by-field.';
  }

  function renderResults(data, copy, opts) {
    opts = opts || {};
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

    lastResults = copy;
    lastFormData = data;
    showingDemo = !!opts.isDemo;

    var title = $('vseo-results-title');
    var sub = $('vseo-results-sub');
    if (opts.isDemo) {
      if (title) title.textContent = 'Demo pack';
      if (sub) {
        sub.textContent =
          'Static CapCut tutorial sample — no AI used. Sign in to generate your own.';
      }
    } else {
      if (title) title.textContent = 'Your copy';
      if (sub) sub.textContent = 'Edit freely, then copy field-by-field.';
    }

    var platforms = (data.platforms || Object.keys(PLATFORM_META)).filter(function (p) {
      return !!copy[p] && PLATFORM_META[p];
    });
    if (!platforms.length) {
      platforms = ['youtube', 'tiktok', 'instagram', 'facebook'].filter(function (p) {
        return !!copy[p];
      });
    }

    var first = platforms[0] || 'youtube';
    var hasYtExtras = false;
    var panelOpts = { isDemo: !!opts.isDemo };

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
            },
            panelOpts
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
          (yt.thumbs || []).slice(0, 6).forEach(function (t, i) {
            extras.appendChild(
              fieldBlock({
                label: 'Thumb text ' + String.fromCharCode(65 + i),
                value: t,
                tip: 'Keep under ~6 words. Strong contrast on the thumb.',
                limit: 28,
                soft: 22
              })
            );
            hasYtExtras = true;
          });
          if ((yt.thumbs || []).length >= 4) {
            var thumbsNote = document.createElement('p');
            thumbsNote.className = 'hint';
            thumbsNote.style.marginTop = '0.35rem';
            thumbsNote.textContent =
              (yt.thumbs || []).length +
              ' thumb text options — pick the punchiest for your still.';
            extras.appendChild(thumbsNote);
          }
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
            },
            panelOpts
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
            },
            panelOpts
          )
        );
      }
    });

    if (extrasWrap) {
      extrasWrap.dataset.hasContent = hasYtExtras ? '1' : '';
      extrasWrap.hidden = !hasYtExtras || first !== 'youtube';
    }

    renderChecklist(copy);
    syncRefineUi();
    selectTab(first);
    if (!opts.skipScroll) {
      $('vseo-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function showDemo() {
    showingDemo = true;
    var data = {
      brief: DEMO_BRIEF,
      keywords: DEMO_KEYWORDS,
      tone: 'educational',
      cta: 'subscribe',
      outline: 'Hook\nSetup in CapCut\nText + captions tip\nExport settings\nCTA',
      platforms: ['youtube', 'tiktok', 'instagram', 'facebook'],
      durationMinutes: 8
    };
    applyFormToFields(data);
    lastFormData = data;
    lastResults = DEMO_RESULTS;
    renderResults(data, DEMO_RESULTS, { isDemo: true });
    setFormError('Showing static demo — no AI, no credits used.', false, 'ok');
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

  /**
   * @param {{ scope?: { platforms?: string[], refine?: string }, prior?: object, busyBtn?: HTMLElement, busyLabel?: string }=} opts
   */
  function generate(opts) {
    opts = opts || {};

    // Auto-route to Pro when transcript/audio is filled (unless this is a refine).
    var isScopedEarly = !!(
      opts.scope &&
      (opts.scope.refine || (opts.scope.platforms && opts.scope.platforms.length))
    );
    if (!isScopedEarly && hasProInputs()) {
      generatePro();
      return;
    }

    var data = readForm();
    if (!validateForm(data)) return;

    var isScoped = !!(opts.scope && (opts.scope.refine || (opts.scope.platforms && opts.scope.platforms.length)));
    var cost = isScoped ? REFINE_CREDITS : AI_CREDITS;
    var prior = opts.prior || (isScoped ? lastResults : null);

    if (isScoped && !prior) {
      setFormError('Generate a full pack first, then refine.');
      return;
    }

    var gate = canGenerate(cost);
    if (!gate.ok) {
      if (gate.reason === 'signin') {
        setFormError(
          'Sign in for 2 free AI generations. <a href="' + loginHref() + '">Sign in</a>',
          true
        );
      } else if (gate.reason === 'paywall') {
        setFormError(
          'Need ' +
            cost +
            ' purchased credit' +
            (cost === 1 ? '' : 's') +
            ' (full pack ' +
            AI_CREDITS +
            ' · refine ' +
            REFINE_CREDITS +
            '). ' +
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

    var btn = opts.busyBtn || $('vseo-generate');
    setBusy(btn, true, opts.busyLabel || (isScoped ? 'Refining…' : 'Generating…'));
    setLoading(true);
    setFormError('');
    showingDemo = false;
    saveForm(data, prior || lastResults);

    var body = {
      brief: data.brief,
      keywords: data.keywords,
      tone: data.tone,
      cta: data.cta,
      outline: data.outline,
      platforms: data.platforms,
      turnstile_token: undefined
    };
    if (data.durationMinutes) body.durationMinutes = data.durationMinutes;
    if (isScoped) {
      body.scope = {};
      if (opts.scope.platforms && opts.scope.platforms.length) {
        body.scope.platforms = opts.scope.platforms;
      }
      if (opts.scope.refine) body.scope.refine = opts.scope.refine;
      body.prior = prior;
    }

    var run = function (turnstileToken) {
      body.turnstile_token = turnstileToken || undefined;
      fetch(BACKEND + '/api/video-seo/generate', {
        method: 'POST',
        headers: Auth && Auth.authHeaders
          ? Auth.authHeaders()
          : {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + getToken()
            },
        body: JSON.stringify(body)
      })
        .then(function (res) {
          return res.json().then(function (respBody) {
            return { res: res, data: respBody };
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
            var need = x.data && x.data.credits_required != null ? x.data.credits_required : cost;
            var paidLeft =
              x.data && x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : 0;
            setFormError(
              'Need ' +
                need +
                ' purchased credit' +
                (need === 1 ? '' : 's') +
                ' (you have ' +
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

          lastResults = results;
          lastFormData = data;
          saveForm(data, results);
          pushHistory(data, results);
          renderResults(data, results);

          if (x.data.free_remaining != null && creditsState) {
            creditsState.freeRemaining = Number(x.data.free_remaining);
          }
          if (x.data.paid_credits_remaining != null && creditsState) {
            creditsState.paidRemaining = Number(x.data.paid_credits_remaining);
          }

          var usedFree = !!x.data.used_free;
          var charged =
            x.data.credits_charged != null
              ? x.data.credits_charged
              : usedFree
                ? 0
                : cost;
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

  function generatePro() {
    var data = readForm();
    if (!validateForm(data)) return;

    var pro = readProInputs();
    if (!pro.transcript && !pro.audio) {
      setFormError('Add a transcript and/or audio file for Pro, or use Generate for brief-only.');
      var details = $('vseo-pro-details');
      if (details) details.open = true;
      var t = $('vseo-transcript');
      if (t) t.focus();
      return;
    }

    if (pro.audio && pro.audio.size > 25 * 1024 * 1024) {
      setFormError('Audio file is too large (max 25 MB).');
      return;
    }

    var cost = proCreditsFor(pro);
    var gate = canGeneratePro(cost);
    if (!gate.ok) {
      if (gate.reason === 'signin') {
        setFormError(
          'Sign in to use Video SEO Pro (purchased credits only). <a href="' +
            loginHref() +
            '">Sign in</a>',
          true
        );
      } else if (gate.reason === 'paywall') {
        setFormError(
          'Pro needs ' +
            cost +
            ' purchased credit' +
            (cost === 1 ? '' : 's') +
            ' (you have ' +
            (creditsState ? creditsState.paidRemaining : 0) +
            '). Free gens cannot pay for Pro. ' +
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

    var btn = $('vseo-generate-pro');
    var mainBtn = $('vseo-generate');
    setBusy(btn, true, pro.audio ? 'Transcribing + writing…' : 'Generating Pro…');
    if (mainBtn) {
      mainBtn.disabled = true;
      mainBtn.classList.add('is-disabled');
    }
    setLoading(true);
    setFormError('');
    showingDemo = false;
    saveForm(data, lastResults);

    var loadingEl = $('vseo-loading');
    if (loadingEl) {
      var lp = loadingEl.querySelector('p');
      if (lp) {
        lp.textContent = pro.audio
          ? 'Transcribing audio and writing platform copy…'
          : 'Writing Pro copy from your transcript…';
      }
    }

    var run = function (turnstileToken) {
      var headers =
        Auth && Auth.authHeaders
          ? Auth.authHeaders()
          : { Authorization: 'Bearer ' + getToken() };
      var fetchOpts;

      if (pro.audio) {
        var fd = new FormData();
        fd.append('brief', data.brief);
        fd.append('keywords', data.keywords || '');
        fd.append('tone', data.tone);
        fd.append('cta', data.cta);
        fd.append('outline', data.outline || '');
        fd.append('platforms', JSON.stringify(data.platforms));
        if (data.durationMinutes) fd.append('durationMinutes', String(data.durationMinutes));
        if (pro.transcript) fd.append('transcript', pro.transcript);
        if (turnstileToken) fd.append('turnstile_token', turnstileToken);
        fd.append('audio', pro.audio, pro.audio.name);
        // Let the browser set multipart boundary — do not force Content-Type.
        var authHeaders = {};
        if (headers.Authorization) authHeaders.Authorization = headers.Authorization;
        fetchOpts = { method: 'POST', headers: authHeaders, body: fd };
      } else {
        var body = {
          brief: data.brief,
          keywords: data.keywords,
          tone: data.tone,
          cta: data.cta,
          outline: data.outline,
          platforms: data.platforms,
          transcript: pro.transcript,
          turnstile_token: turnstileToken || undefined
        };
        if (data.durationMinutes) body.durationMinutes = data.durationMinutes;
        fetchOpts = {
          method: 'POST',
          headers: Object.assign(
            { 'Content-Type': 'application/json' },
            headers.Authorization ? { Authorization: headers.Authorization } : headers
          ),
          body: JSON.stringify(body)
        };
      }

      fetch(BACKEND + '/api/video-seo/pro', fetchOpts)
        .then(function (res) {
          return res.json().then(function (respBody) {
            return { res: res, data: respBody };
          });
        })
        .then(function (x) {
          setBusy(btn, false);
          if (mainBtn) {
            mainBtn.disabled = false;
            mainBtn.classList.remove('is-disabled');
          }
          setLoading(false);
          resetTurnstile();
          if (loadingEl) {
            var resetP = loadingEl.querySelector('p');
            if (resetP) resetP.textContent = 'Writing platform copy…';
          }

          if (x.res.status === 503) {
            setFormError(
              (x.data && x.data.error) ||
                'Pro AI / transcription is temporarily unavailable. Try again shortly.'
            );
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
          if (x.res.status === 413 || (x.data && x.data.reason === 'file_too_large')) {
            setFormError('Audio file is too large (max 25 MB).');
            return;
          }
          if (x.res.status === 400) {
            setFormError((x.data && x.data.error) || 'Check your Pro inputs and try again.');
            return;
          }
          if (x.res.status === 402) {
            var need =
              x.data && x.data.credits_required != null ? x.data.credits_required : cost;
            var paidLeft =
              x.data && x.data.paid_credits_remaining != null
                ? x.data.paid_credits_remaining
                : 0;
            setFormError(
              'Need ' +
                need +
                ' purchased credit' +
                (need === 1 ? '' : 's') +
                ' for Pro (you have ' +
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
            setFormError(
              (x.data && x.data.error) || 'Pro generate failed. No charge if it failed.'
            );
            return;
          }

          lastResults = results;
          lastFormData = data;
          saveForm(data, results);
          pushHistory(data, results);
          renderResults(data, results);

          if (x.data.paid_credits_remaining != null && creditsState) {
            creditsState.paidRemaining = Number(x.data.paid_credits_remaining);
          }

          var charged =
            x.data.credits_charged != null ? x.data.credits_charged : cost;
          var src =
            x.data.transcript_source === 'audio' ? 'audio transcript' : 'pasted transcript';
          setFormError(
            'Done · Pro (' +
              src +
              ') · charged ' +
              charged +
              ' credit' +
              (charged === 1 ? '' : 's') +
              (x.data.paid_credits_remaining != null
                ? ' · ' + x.data.paid_credits_remaining + ' purchased remaining'
                : ''),
            false,
            'ok'
          );
          updateCreditsPanel();
        })
        .catch(function () {
          setBusy(btn, false);
          if (mainBtn) {
            mainBtn.disabled = false;
            mainBtn.classList.remove('is-disabled');
          }
          setLoading(false);
          resetTurnstile();
          if (loadingEl) {
            var resetP2 = loadingEl.querySelector('p');
            if (resetP2) resetP2.textContent = 'Writing platform copy…';
          }
          setFormError('Could not reach the server. Try again.');
        });
    };

    if (window.CuemarkTurnstile && CuemarkTurnstile.enabled && CuemarkTurnstile.enabled()) {
      CuemarkTurnstile.requireToken('vseo-turnstile')
        .then(run)
        .catch(function (err) {
          setBusy(btn, false);
          if (mainBtn) {
            mainBtn.disabled = false;
            mainBtn.classList.remove('is-disabled');
          }
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

  function regeneratePlatform(platform, btn) {
    generate({
      scope: { platforms: [platform] },
      prior: lastResults,
      busyBtn: btn,
      busyLabel: 'Regenerating…'
    });
  }

  function refineWith(chip, btn) {
    var refine = chip;
    if (chip === 'force keyword') {
      var seeds = cleanText($('vseo-keywords').value);
      if (!seeds) {
        setFormError('Add keywords above, then use Force keyword.');
        $('vseo-keywords').focus();
        return;
      }
      refine = 'force keyword: weave these into titles/tags/captions — ' + seeds;
    }
    generate({
      scope: { refine: refine },
      prior: lastResults,
      busyBtn: btn,
      busyLabel: 'Refining…'
    });
  }

  function clearAll() {
    $('vseo-brief').value = '';
    $('vseo-keywords').value = '';
    $('vseo-outline').value = '';
    var transcript = $('vseo-transcript');
    if (transcript) transcript.value = '';
    var audio = $('vseo-audio');
    if (audio) audio.value = '';
    $('vseo-tone').value = 'educational';
    $('vseo-cta').value = 'none';
    var dur = $('vseo-duration');
    if (dur) dur.value = '';
    ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
      var el = $('plat-' + p);
      if (el) el.checked = true;
    });
    lastResults = null;
    lastFormData = null;
    showingDemo = false;
    hideResults();
    var paywall = $('vseo-paywall');
    if (paywall) paywall.hidden = true;
    setLoading(false);
    setFormError('');
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    syncProButton();
    $('vseo-brief').focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadForm();
    renderHistory();
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

    var proBtn = $('vseo-generate-pro');
    if (proBtn) {
      proBtn.addEventListener('click', function () {
        generatePro();
      });
    }
    var transcriptEl = $('vseo-transcript');
    if (transcriptEl) {
      transcriptEl.addEventListener('input', syncProButton);
    }
    var audioEl = $('vseo-audio');
    if (audioEl) {
      audioEl.addEventListener('change', syncProButton);
    }
    syncProButton();

    var demoBtn = $('vseo-demo');
    if (demoBtn) demoBtn.addEventListener('click', showDemo);

    var dlTxt = $('vseo-dl-txt');
    if (dlTxt) dlTxt.addEventListener('click', function () { downloadPack('txt'); });
    var dlMd = $('vseo-dl-md');
    if (dlMd) dlMd.addEventListener('click', function () { downloadPack('md'); });

    var chips = $('vseo-refine-chips');
    if (chips) {
      chips.addEventListener('click', function (e) {
        var btn = e.target.closest('.vseo-chip');
        if (!btn || !btn.getAttribute('data-refine')) return;
        refineWith(btn.getAttribute('data-refine'), btn);
      });
    }

    document.addEventListener('click', function (e) {
      document.querySelectorAll('.nav-products[open]').forEach(function (d) {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
  });
})();
