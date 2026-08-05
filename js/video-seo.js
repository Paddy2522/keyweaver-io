(function () {
  'use strict';

  var STORAGE_KEY = 'keyweaver.videoSeo.lastBrief';
  var CKIT_KEY = 'keyweaver.campaignKit.lastBrief';
  var SHOT_KEY = 'keyweaver.shotList.lastBrief';
  var Auth = window.KeyweaverToolsAuth;
  var BACKEND = (Auth && Auth.BACKEND) || 'https://keyweaver-backend.vercel.app';
  /** Must match .backend-checkout/lib/video-seo-policy.ts */
  var AI_CREDITS = 2;
  /** @type {{ remaining: number, total: number, paidRemaining: number, hasPaid: boolean } | null} */
  var creditsState = null;

  var CTA_HINTS = {
    none: '',
    subscribe: 'Ask viewers to subscribe if this helped.',
    comment: 'Ask one specific question in the comments.',
    link: 'Point to the link in description / bio.',
    follow: 'Ask them to follow for more like this.',
    share: 'Ask them to share with someone who needs it.'
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

  function parseSeeds(raw) {
    return cleanText(raw)
      .split(/[,;\n]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 1; })
      .slice(0, 12);
  }

  function parseOutline(outline) {
    return cleanText(outline)
      .split(/\n+/)
      .map(function (line) {
        return line.replace(/^\s*(\d+[\.\)]\s*|[-•*]\s*)/, '').trim();
      })
      .filter(Boolean)
      .slice(0, 12);
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
        note.style.marginTop = '0.75rem';
        note.innerHTML =
          'Prefilling from your last <a href="/' +
          (source === 'Shot List' ? 'shot-list' : 'campaign-kit') +
          '">' +
          source +
          '</a> brief. Use AI write for paste-ready copy, or Free structure for empty fields.';
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

  function syncCreditActions() {
    var token = getToken();
    var paidRemaining =
      token && creditsState ? creditsState.paidRemaining : token ? null : 0;
    if (Auth && Auth.syncCreditActions) {
      Auth.syncCreditActions({
        signin: $('vseo-credits-signin'),
        buy: $('vseo-credits-buy'),
        account: $('vseo-credits-account'),
        nextPath: '/video-seo',
        signedIn: !!token,
        paidRemaining: paidRemaining,
        signinLabel: 'Sign in'
      });
      return;
    }
    var signin = $('vseo-credits-signin');
    var buy = $('vseo-credits-buy');
    var account = $('vseo-credits-account');
    var zeroPaid = !!(token && creditsState && creditsState.paidRemaining <= 0);
    if (signin) {
      signin.hidden = !!token;
      if (!token) {
        signin.href = loginHref();
        signin.className = 'btn btn-primary';
      }
    }
    if (buy) {
      buy.hidden = false;
      buy.className = zeroPaid ? 'btn btn-primary' : 'btn btn-ghost';
    }
    if (account) account.hidden = !token;
  }

  function aiGateReason() {
    if (!getToken()) {
      return {
        ok: false,
        reason:
          'Sign in to use AI write. Needs purchased credits - <a href="' +
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
          'Signed in with 0 purchased credits. Free signup credits cannot cover AI write. ' +
          purchaseLinksHtml()
      };
    }
    if (creditsState.paidRemaining < AI_CREDITS) {
      return {
        ok: false,
        reason:
          'Need ' +
          AI_CREDITS +
          ' purchased credits (you have ' +
          creditsState.paidRemaining +
          '). ' +
          purchaseLinksHtml()
      };
    }
    return {
      ok: true,
      reason: 'Will charge ' + AI_CREDITS + ' purchased credits for a full multi-platform write.'
    };
  }

  function syncAiButton() {
    var btn = $('vseo-ai');
    var note = $('vseo-cost-note');
    var gate = aiGateReason();
    if (btn && !btn.classList.contains('is-busy')) {
      btn.disabled = !gate.ok;
      btn.classList.toggle('is-disabled', !gate.ok);
      btn.title = gate.ok
        ? 'Charges ' + AI_CREDITS + ' purchased credits'
        : 'Purchased credits required - see Pricing';
    }
    if (note) {
      if (!getToken()) {
        note.innerHTML =
          'AI write needs sign-in + purchased credits. <a href="' +
          loginHref() +
          '">Sign in</a> · Free structure never charges.';
      } else if (!creditsState) {
        note.textContent = 'Checking purchased credit balance…';
      } else if (!gate.ok) {
        note.innerHTML =
          'Signed in · need purchased credits for AI write. ' + purchaseLinksHtml();
      } else {
        note.textContent =
          'AI write charges ' +
          AI_CREDITS +
          ' purchased credits (you have ' +
          creditsState.paidRemaining +
          '). Free structure never charges.';
      }
    }
  }

  function updateCreditsPanel() {
    var bal = $('vseo-balance');
    var meter = $('vseo-credit-meter');
    var paidEl = $('vseo-paid-value');
    var poolEl = $('vseo-pool-value');
    var token = getToken();
    syncCreditActions();
    if (!token) {
      creditsState = null;
      if (meter) meter.hidden = true;
      if (bal) {
        bal.className = 'tools-credit-status is-warn';
        bal.textContent =
          'Sign in to see purchased credits and unlock AI write. Free structure stays free.';
      }
      syncAiButton();
      return;
    }
    if (bal) {
      bal.className = 'tools-credit-status';
      bal.textContent = 'Checking purchased credit balance…';
    }

    function apply(snap) {
      if (!bal) return;
      if (!snap || !snap.ok) {
        creditsState = null;
        if (meter) meter.hidden = true;
        if (snap && snap.unauthorized) {
          bal.className = 'tools-credit-status is-warn';
          bal.innerHTML =
            'Session expired. <a href="' + loginHref() + '">Sign in</a> to unlock AI write.';
        } else {
          bal.className = 'tools-credit-status is-err';
          bal.innerHTML =
            'Could not load credits. Try <a href="/account">Account</a> or refresh.';
        }
        syncCreditActions();
        syncAiButton();
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
      if (poolEl) poolEl.textContent = snap.remaining + ' / ' + snap.total;
      if (snap.paidRemaining <= 0) {
        bal.className = 'tools-credit-status is-warn';
        bal.innerHTML =
          'Signed in with <strong>0 purchased credits</strong>. Free signup credits cannot run AI write. ' +
          purchaseLinksHtml();
      } else {
        bal.className = 'tools-credit-status is-ok';
        bal.textContent =
          'Ready for AI write. Purchased credits: ' +
          snap.paidRemaining +
          ' (cost ' +
          AI_CREDITS +
          ' per generate).';
      }
      syncCreditActions();
      syncAiButton();
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
                hasPaid: paid > 0 || !!data.has_paid_credits
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

  function platformSection(id, title, sub, fields, copyAllText) {
    var sec = document.createElement('section');
    sec.className = 'vseo-platform-block';
    sec.id = 'result-' + id;

    var headRow = document.createElement('div');
    headRow.className = 'vseo-field-out-head';
    var h3 = document.createElement('h3');
    h3.textContent = title;
    var copyAll = document.createElement('button');
    copyAll.type = 'button';
    copyAll.className = 'vseo-copy';
    copyAll.textContent = 'Copy all';
    headRow.appendChild(h3);
    headRow.appendChild(copyAll);
    sec.appendChild(headRow);

    var subEl = document.createElement('p');
    subEl.className = 'plat-sub';
    subEl.textContent = sub;
    sec.appendChild(subEl);

    var blocks = [];
    fields.forEach(function (f) {
      var b = fieldBlock(f);
      blocks.push(b);
      sec.appendChild(b);
    });

    copyAll.addEventListener('click', function () {
      copyText(typeof copyAllText === 'function' ? copyAllText(blocks) : copyAllText, copyAll);
    });

    return sec;
  }

  function showResultsShell(mode) {
    var empty = $('vseo-empty');
    if (empty) empty.classList.add('is-hidden');
    $('vseo-results').classList.add('is-visible');
    var title = $('vseo-results-title');
    var sub = $('vseo-results-sub');
    if (mode === 'structure') {
      if (title) title.textContent = 'Free structure pack';
      if (sub) {
        sub.textContent =
          'Empty fields with length tips. Fill these yourself - or run AI write for draft copy.';
      }
    } else {
      if (title) title.textContent = 'AI copy to paste';
      if (sub) {
        sub.textContent =
          'Generated for your platforms. Edit freely, then copy field-by-field or copy all.';
      }
    }
  }

  function renderChecklist(items) {
    var host = $('vseo-checklist');
    if (!host) return;
    host.innerHTML = '';
    if (!items || !items.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    var h = document.createElement('h3');
    h.textContent = 'Before you publish';
    host.appendChild(h);
    var ul = document.createElement('ul');
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    host.appendChild(ul);
  }

  function structurePlaceholders(seeds, outlineItems, cta) {
    var seedHint = seeds.length
      ? 'Try weaving: ' + seeds.slice(0, 4).join(', ')
      : 'Add a searchable phrase + a benefit (under ~70 chars).';
    var ctaHint = CTA_HINTS[cta] || '';
    return {
      youtube: {
        titles: ['', '', ''],
        titleTips: [
          'Curiosity + benefit. Not “A video where…”.',
          'Alternate angle or keyword-forward option.',
          'Shorter punchy option for mobile truncation.'
        ],
        description: '',
        descriptionTip:
          'Hook in line 1. Then what they learn, who it’s for, timestamps if you have them. ' +
          seedHint +
          (ctaHint ? ' ' + ctaHint : ''),
        tags: seeds.slice(0, 8).join(', '),
        tagsTip: 'Comma-separated. Mix broad + specific. Seeds prefilled when you provided them.',
        chapters: outlineItems.length
          ? outlineItems
              .map(function (item, i) {
                var t = i === 0 ? '0:00' : String(Math.floor((45 + i * 50) / 60)) + ':' + String((45 + i * 50) % 60).padStart(2, '0');
                return t + ' ' + item;
              })
              .join('\n')
          : '',
        thumbs: ['', ''],
        pinned: ctaHint
      },
      short: {
        caption: '',
        captionTip:
          'First line is the hook. Keep it skimmable. ' + seedHint + (ctaHint ? ' ' + ctaHint : ''),
        hashtags: seeds
          .slice(0, 5)
          .map(function (s) {
            return '#' + s.replace(/[^a-z0-9]+/gi, '');
          })
          .filter(function (t) {
            return t.length > 2;
          })
          .join(' ')
      },
      facebook: {
        post: '',
        tip: 'Lead with the outcome, then one detail from the brief. ' + (ctaHint || '')
      }
    };
  }

  function renderStructure(data) {
    var host = $('vseo-results-body');
    var jump = $('vseo-jump');
    var extras = $('vseo-extras-body');
    var extrasWrap = $('vseo-extras');
    host.innerHTML = '';
    jump.innerHTML = '';
    if (extras) extras.innerHTML = '';

    var seeds = parseSeeds(data.keywords);
    var outlineItems = parseOutline(data.outline);
    var pack = structurePlaceholders(seeds, outlineItems, data.cta);

    renderChecklist([
      'Write titles under ~70 characters - benefit + topic, not a synopsis',
      'Put the hook in the first two lines of every description',
      'Use 3–8 real tags/hashtags people search - skip #fyp spam walls',
      'Match tone to the platform (YouTube can be longer; Shorts/Reels stay punchy)',
      'Preview the title truncated on mobile before you publish'
    ]);

    showResultsShell('structure');
    if (extrasWrap) extrasWrap.hidden = data.platforms.indexOf('youtube') === -1;

    data.platforms.forEach(function (p) {
      var a = document.createElement('a');
      a.href = '#result-' + p;
      a.textContent = ({
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        facebook: 'Facebook'
      })[p];
      jump.appendChild(a);

      if (p === 'youtube') {
        host.appendChild(
          platformSection(
            'youtube',
            'YouTube - fill upload details',
            'Empty fields on purpose. AI write fills these if you want a draft.',
            [
              {
                label: 'Title option A',
                value: '',
                placeholder: 'e.g. CapCut Text Tricks That Keep Viewers Watching',
                tip: pack.youtube.titleTips[0],
                limit: 70,
                soft: 60
              },
              {
                label: 'Title option B',
                value: '',
                placeholder: 'e.g. How I Edit TikToks Faster in CapCut',
                tip: pack.youtube.titleTips[1],
                limit: 70,
                soft: 60
              },
              {
                label: 'Title option C',
                value: '',
                placeholder: 'e.g. Stop Making CapCut Look Amateur',
                tip: pack.youtube.titleTips[2],
                limit: 70,
                soft: 60
              },
              {
                label: 'Description',
                value: '',
                tip: pack.youtube.descriptionTip,
                multiline: true,
                rows: 10,
                limit: 5000,
                soft: 3000
              },
              {
                label: 'Tags',
                value: pack.youtube.tags,
                tip: pack.youtube.tagsTip,
                multiline: true,
                rows: 2,
                limit: 500,
                soft: 400
              }
            ],
            function (blocks) {
              return blocks
                .map(function (b) {
                  return b._getValue();
                })
                .filter(Boolean)
                .join('\n\n');
            }
          )
        );
        if (extras) {
          extras.appendChild(
            fieldBlock({
              label: 'Pinned comment draft',
              value: pack.youtube.pinned,
              tip: 'Optional. One clear CTA or question.',
              multiline: true,
              rows: 3,
              limit: 400,
              soft: 280
            })
          );
          extras.appendChild(
            fieldBlock({
              label: 'Chapter placeholders',
              value: pack.youtube.chapters,
              tip: outlineItems.length
                ? 'From your outline - adjust timestamps after you edit.'
                : 'Add outline beats above, or write chapters after the cut.',
              multiline: true,
              rows: 6,
              limit: 2000,
              soft: 1200
            })
          );
          extras.appendChild(
            fieldBlock({
              label: 'Thumb text idea A',
              value: '',
              placeholder: '3–5 BIG WORDS',
              tip: 'Keep under ~6 words for readability.',
              limit: 28,
              soft: 22
            })
          );
          extras.appendChild(
            fieldBlock({
              label: 'Thumb text idea B',
              value: '',
              placeholder: 'RESULT / MISTAKE / TIP',
              limit: 24,
              soft: 20
            })
          );
        }
      } else if (p === 'tiktok' || p === 'instagram') {
        var label = p === 'tiktok' ? 'TikTok' : 'Instagram';
        host.appendChild(
          platformSection(
            p,
            label + ' - caption',
            'Write a hook first. Hashtags optional and light.',
            [
              {
                label: 'Caption',
                value: '',
                tip: pack.short.captionTip,
                multiline: true,
                rows: 6,
                limit: p === 'tiktok' ? 2200 : 2100,
                soft: 400
              },
              {
                label: 'Hashtags',
                value: pack.short.hashtags,
                tip: 'Seeds converted when provided. Trim to what fits the niche.',
                multiline: true,
                rows: 2,
                limit: 300,
                soft: 200
              }
            ],
            function (blocks) {
              return blocks
                .map(function (b) {
                  return b._getValue();
                })
                .filter(Boolean)
                .join('\n\n');
            }
          )
        );
      } else if (p === 'facebook') {
        host.appendChild(
          platformSection(
            'facebook',
            'Facebook - post',
            'Lead with the outcome for people skimming the feed.',
            [
              {
                label: 'Post text',
                value: '',
                tip: pack.facebook.tip,
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

    $('vseo-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderAiCopy(data, copy) {
    var host = $('vseo-results-body');
    var jump = $('vseo-jump');
    var extras = $('vseo-extras-body');
    var extrasWrap = $('vseo-extras');
    host.innerHTML = '';
    jump.innerHTML = '';
    if (extras) extras.innerHTML = '';
    renderChecklist([]);
    showResultsShell('ai');
    if (extrasWrap) extrasWrap.hidden = !(copy.youtube && data.platforms.indexOf('youtube') !== -1);

    data.platforms.forEach(function (p) {
      var a = document.createElement('a');
      a.href = '#result-' + p;
      a.textContent = ({
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        facebook: 'Facebook'
      })[p];
      jump.appendChild(a);

      if (p === 'youtube' && copy.youtube) {
        var yt = copy.youtube;
        var titles = yt.titles && yt.titles.length ? yt.titles.slice(0, 3) : [''];
        while (titles.length < 3) titles.push('');
        host.appendChild(
          platformSection(
            'youtube',
            'YouTube - paste into upload details',
            'Aim under ~70 characters. Front-load the description hook.',
            [
              { label: 'Title option A', value: titles[0], limit: 70, soft: 60 },
              { label: 'Title option B', value: titles[1], limit: 70, soft: 60 },
              { label: 'Title option C', value: titles[2], limit: 70, soft: 60 },
              {
                label: 'Description',
                value: yt.description || '',
                multiline: true,
                rows: 10,
                limit: 5000,
                soft: 3000
              },
              {
                label: 'Tags',
                value: yt.tags || '',
                multiline: true,
                rows: 2,
                limit: 500,
                soft: 400
              }
            ],
            function (blocks) {
              return blocks
                .map(function (b) {
                  return b._getValue();
                })
                .filter(Boolean)
                .join('\n\n');
            }
          )
        );
        if (extras) {
          if (yt.pinned) {
            extras.appendChild(
              fieldBlock({
                label: 'Pinned comment draft',
                value: yt.pinned,
                multiline: true,
                rows: 3,
                limit: 400,
                soft: 280
              })
            );
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
          }
          (yt.thumbs || []).slice(0, 3).forEach(function (t, i) {
            extras.appendChild(
              fieldBlock({
                label: 'Thumb text idea ' + String.fromCharCode(65 + i),
                value: t,
                limit: 28,
                soft: 22
              })
            );
          });
        }
      } else if ((p === 'tiktok' || p === 'instagram') && copy[p]) {
        var short = copy[p];
        var label = p === 'tiktok' ? 'TikTok' : 'Instagram';
        host.appendChild(
          platformSection(
            p,
            label + ' - caption',
            'Hook first. Trim hashtags if they feel spammy.',
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
                .map(function (b) {
                  return b._getValue();
                })
                .filter(Boolean)
                .join('\n\n');
            }
          )
        );
      } else if (p === 'facebook' && copy.facebook) {
        host.appendChild(
          platformSection(
            'facebook',
            'Facebook - post',
            'Skimmable first line wins.',
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

  function generateStructure() {
    var data = readForm();
    if (!validateForm(data)) return;
    saveForm(data);
    renderStructure(data);
  }

  function generateAi() {
    var data = readForm();
    if (!validateForm(data)) return;
    var gate = aiGateReason();
    if (!gate.ok) {
      setFormError(gate.reason, true);
      updateCreditsPanel();
      return;
    }

    var btn = $('vseo-ai');
    setBusy(btn, true, 'Writing…');
    setFormError('');
    saveForm(data);

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
        platforms: data.platforms
      })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { res: res, data: body };
        });
      })
      .then(function (x) {
        setBusy(btn, false);
        if (x.res.status === 503 && x.data && x.data.reason === 'provider_not_configured') {
          setFormError(
            'AI write is temporarily unavailable on the server. Use Free structure for now, or try again later.',
            false
          );
          syncAiButton();
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
        if (x.res.status === 402) {
          var need = x.data && x.data.credits_required != null ? x.data.credits_required : AI_CREDITS;
          var paidLeft =
            x.data && x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : 0;
          if (x.data && x.data.reason === 'paid_credits_required') {
            setFormError(
              'Purchased credits required (need ' +
                need +
                ', you have ' +
                paidLeft +
                '). Free signup credits cannot run AI write. ' +
                purchaseLinksHtml(),
              true
            );
          } else {
            setFormError(
              'Not enough credits (need ' + need + '). ' + purchaseLinksHtml(),
              true
            );
          }
          updateCreditsPanel();
          return;
        }
        if (!x.res.ok || !x.data || !x.data.copy) {
          setFormError((x.data && x.data.error) || 'AI write failed. No charge if generation failed.');
          syncAiButton();
          return;
        }
        renderAiCopy(data, x.data.copy);
        var charged = x.data.credits_charged != null ? x.data.credits_charged : AI_CREDITS;
        var remain =
          x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : null;
        setFormError(
          'Done - charged ' +
            charged +
            ' purchased credit' +
            (charged === 1 ? '' : 's') +
            (remain != null ? ' · ' + remain + ' purchased remaining' : '') +
            '.',
          false,
          'ok'
        );
        updateCreditsPanel();
      })
      .catch(function () {
        setBusy(btn, false);
        setFormError('Could not reach the server. Try again.');
        syncAiButton();
      });
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
    $('vseo-extras-body').innerHTML = '';
    $('vseo-jump').innerHTML = '';
    renderChecklist([]);
    var extras = $('vseo-extras');
    if (extras) extras.hidden = true;
    var empty = $('vseo-empty');
    if (empty) empty.classList.remove('is-hidden');
    setFormError('');
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    $('vseo-brief').focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadForm();
    updateCreditsPanel();

    var form = $('vseo-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        generateStructure();
      });
    }
    var aiBtn = $('vseo-ai');
    if (aiBtn) aiBtn.addEventListener('click', generateAi);
    var clearBtn = $('vseo-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);

    document.addEventListener('click', function (e) {
      document.querySelectorAll('.nav-products[open]').forEach(function (d) {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
  });
})();
