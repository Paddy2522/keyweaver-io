(function () {
  'use strict';

  var Auth = window.KeyweaverToolsAuth;
  var BACKEND = (Auth && Auth.BACKEND) || 'https://keyweaver-backend.vercel.app';
  var AI_CREDITS = 2;
  var STORAGE_KEY = 'keyweaver.shotList.lastBrief';
  var VSEO_KEY = 'keyweaver.videoSeo.lastBrief';
  var CKIT_KEY = 'keyweaver.campaignKit.lastBrief';

  var creditsState = null;

  /** Base beat templates: weight shares sum ~1; scaled to target duration. */
  var TEMPLATES = {
    talking_head: [
      { framing: 'Wide establishing - talent + space', movement: 'Locked or very slow push-in', audio: 'Room tone bed; soft music under', w: 0.08, tag: 'open' },
      { framing: 'Medium - talent to camera (A-roll)', movement: 'Locked; slight settle', audio: 'Lav primary; clean dialogue', w: 0.22, tag: 'a_roll' },
      { framing: 'Close-up - eyes / emphasis moment', movement: 'Locked or micro push', audio: 'Same lav; hold music low', w: 0.1, tag: 'emphasis' },
      { framing: 'Over-shoulder / screen / prop insert', movement: 'Slow pan or locked', audio: 'SFX hits; dialogue continues', w: 0.12, tag: 'b_roll' },
      { framing: 'Medium - continue point / story beat', movement: 'Locked', audio: 'Lav; music bed', w: 0.18, tag: 'a_roll' },
      { framing: 'Detail cutaway - hands, UI, object', movement: 'Macro drift or locked', audio: 'Foley / UI ticks', w: 0.1, tag: 'detail' },
      { framing: 'Medium-close - CTA / takeaway', movement: 'Gentle push-in', audio: 'Lav; music lift', w: 0.12, tag: 'cta' },
      { framing: 'Wide outro - hold for end card', movement: 'Locked or pull-back', audio: 'Music resolve; VO optional', w: 0.08, tag: 'outro' }
    ],
    product: [
      { framing: 'Hero wide - product in context', movement: 'Slow orbit or locked beauty', audio: 'Music sting open; no VO yet', w: 0.1, tag: 'hero' },
      { framing: 'Medium - product + talent / hands', movement: 'Slider or gimbal pass', audio: 'VO intro; soft bed', w: 0.14, tag: 'context' },
      { framing: 'Macro - key feature / texture', movement: 'Macro push or rack focus', audio: 'Design SFX; VO feature 1', w: 0.14, tag: 'feature' },
      { framing: 'Lifestyle use - product in action', movement: 'Follow action; medium', audio: 'VO benefit; ambient', w: 0.16, tag: 'use' },
      { framing: 'Before / problem insert', movement: 'Locked or whip cut-ready', audio: 'Tension bed dip', w: 0.1, tag: 'problem' },
      { framing: 'After / reveal - product solves it', movement: 'Reveal tilt or push', audio: 'Music lift; VO payoff', w: 0.12, tag: 'reveal' },
      { framing: 'Packaging / UI / unbox detail', movement: 'Top-down locked or slow pan', audio: 'Foley; short VO', w: 0.1, tag: 'detail' },
      { framing: 'Hero close + CTA / logo hold', movement: 'Locked beauty; end card safe', audio: 'VO CTA; music resolve', w: 0.14, tag: 'cta' }
    ],
    product_review: [
      { framing: 'Cold open - honest first impression', movement: 'Locked or quick push', audio: 'Hook VO; music hit', w: 0.08, tag: 'hook' },
      { framing: 'Medium - host to camera (who this is for)', movement: 'Locked A-roll', audio: 'Lav; agenda VO', w: 0.12, tag: 'agenda' },
      { framing: 'Hero product + hands unbox / setup', movement: 'Top-down or medium', audio: 'Foley; short VO', w: 0.12, tag: 'unbox' },
      { framing: 'Use case A - real environment', movement: 'Follow or locked', audio: 'VO benefit; ambient', w: 0.14, tag: 'use' },
      { framing: 'Close insert - key feature / flaw', movement: 'Macro locked', audio: 'VO honesty beat', w: 0.12, tag: 'feature' },
      { framing: 'Use case B - contrast / comparison', movement: 'Locked split-friendly', audio: 'VO compare', w: 0.12, tag: 'compare' },
      { framing: 'Medium - who should buy / skip', movement: 'Locked', audio: 'Lav; music soft', w: 0.14, tag: 'verdict' },
      { framing: 'Close + CTA / where to learn more', movement: 'Gentle push-in', audio: 'VO CTA; music out', w: 0.16, tag: 'cta' }
    ],
    vlog: [
      { framing: 'Wide establishing - day / place', movement: 'Handheld walk-in or locked wide', audio: 'Ambience; soft bed', w: 0.1, tag: 'est' },
      { framing: 'Medium - host to camera (today’s plan)', movement: 'Locked or settle', audio: 'Lav; VO intro', w: 0.14, tag: 'intro' },
      { framing: 'Action beat - main activity', movement: 'Follow handheld / gimbal', audio: 'Dialogue / VO; ambient', w: 0.16, tag: 'action' },
      { framing: 'Detail cutaway - hands, food, screen, prop', movement: 'Locked or macro', audio: 'Foley; bed under', w: 0.1, tag: 'detail' },
      { framing: 'Travel / transition beat', movement: 'Gimbal or whip-ready', audio: 'Bridge music', w: 0.1, tag: 'bridge' },
      { framing: 'Medium - reflection / lesson', movement: 'Locked talking', audio: 'Lav; quieter bed', w: 0.14, tag: 'reflect' },
      { framing: 'B-roll montage picks', movement: 'Varied; cut-friendly', audio: 'Music lift', w: 0.12, tag: 'montage' },
      { framing: 'Close / medium - wrap + CTA', movement: 'Soft push or locked', audio: 'VO CTA; music resolve', w: 0.14, tag: 'cta' }
    ],
    short_hook: [
      { framing: '0-2s hook - face / result / bold prop', movement: 'Locked punch-in ready', audio: 'Cold open line; music hit', w: 0.18, tag: 'hook' },
      { framing: 'Problem beat - what hurts', movement: 'Locked or whip', audio: 'Tension bed; short VO', w: 0.16, tag: 'problem' },
      { framing: 'Demo / proof - hands or screen', movement: 'Locked; phone-safe framing', audio: 'VO tip; UI SFX', w: 0.22, tag: 'proof' },
      { framing: 'Payoff - after / result', movement: 'Reveal push', audio: 'Music lift; VO payoff', w: 0.2, tag: 'payoff' },
      { framing: 'CTA - follow / comment / watch longer', movement: 'Locked close', audio: 'Lav CTA; sting out', w: 0.24, tag: 'cta' }
    ],
    launch_trailer: [
      { framing: 'Teaser wide - world / mood', movement: 'Slow push or crane-feel', audio: 'Bed open; no VO yet', w: 0.12, tag: 'mood' },
      { framing: 'Hero subject silhouette / logo-safe frame', movement: 'Locked beauty', audio: 'Sting; sparse VO', w: 0.12, tag: 'hero' },
      { framing: 'Feature flash 1 - bold visual', movement: 'Whip or smash cut-ready', audio: 'Hit; short VO', w: 0.14, tag: 'feature' },
      { framing: 'Feature flash 2 - human reaction', movement: 'Close locked', audio: 'Music build', w: 0.12, tag: 'react' },
      { framing: 'Montage - three quick beats', movement: 'Varied; trailer pace', audio: 'Music peak; VO optional', w: 0.18, tag: 'montage' },
      { framing: 'Title card safe - name / date / CTA', movement: 'Locked end card', audio: 'Resolve; VO CTA', w: 0.2, tag: 'title' },
      { framing: 'Logo / end hold', movement: 'Locked', audio: 'Music out', w: 0.12, tag: 'outro' }
    ],
    tutorial: [
      { framing: 'Cold open - show the finished result first', movement: 'Locked or quick push', audio: 'One-line hook VO; music hit', w: 0.08, tag: 'hook' },
      { framing: 'Medium to camera - who this is for + promise', movement: 'Locked A-roll', audio: 'Lav; short agenda', w: 0.12, tag: 'agenda' },
      { framing: 'Screen / bench - step 1 (slow enough to follow)', movement: 'Locked; cursor-safe', audio: 'VO step 1; quiet bed', w: 0.16, tag: 'step' },
      { framing: 'Close insert - the click / tool people miss', movement: 'Locked or slight zoom', audio: 'UI SFX; tip VO', w: 0.1, tag: 'insert' },
      { framing: 'Screen / bench - step 2', movement: 'Locked', audio: 'VO step 2', w: 0.14, tag: 'step' },
      { framing: 'Over-shoulder - hands-on step 3', movement: 'Gentle follow', audio: 'VO step 3; light ambient', w: 0.14, tag: 'step' },
      { framing: 'Before / after or side-by-side proof', movement: 'Locked split-friendly', audio: 'VO compare; music lift', w: 0.1, tag: 'compare' },
      { framing: 'Medium - recap in 3 bullets + CTA', movement: 'Locked or soft push', audio: 'Lav CTA; music out', w: 0.16, tag: 'cta' }
    ],
    event: [
      { framing: 'Arrival / venue wide establishing', movement: 'Handheld walk-in or locked wide', audio: 'Crowd bed; music under', w: 0.1, tag: 'est' },
      { framing: 'Crowd / energy medium', movement: 'Gimbal weave or locked', audio: 'Ambience; music', w: 0.1, tag: 'crowd' },
      { framing: 'Speaker / stage wide', movement: 'Locked or slow pan', audio: 'Board / PA feed if available', w: 0.12, tag: 'stage' },
      { framing: 'Speaker medium / close', movement: 'Locked; follow if needed', audio: 'Lav or board; isolate voice', w: 0.14, tag: 'speech' },
      { framing: 'Audience reaction cutaways', movement: 'Locked or quick handheld', audio: 'Room tone; soft bed', w: 0.1, tag: 'react' },
      { framing: 'Detail - signage, product, hands', movement: 'Macro / locked', audio: 'Foley; music continue', w: 0.1, tag: 'detail' },
      { framing: 'Networking / candid moments', movement: 'Observational handheld', audio: 'Ambience; sparse VO', w: 0.12, tag: 'candid' },
      { framing: 'Highlight montage picks', movement: 'Varied; cut-friendly', audio: 'Music peak; VO optional', w: 0.12, tag: 'montage' },
      { framing: 'Outro wide + logo / CTA hold', movement: 'Pull-back or locked', audio: 'Music resolve; VO CTA', w: 0.1, tag: 'outro' }
    ],
    custom: [
      { framing: 'Establishing - world / location', movement: 'Slow push or locked wide', audio: 'Bed open; room tone', w: 0.1, tag: 'est' },
      { framing: 'Character / subject introduce', movement: 'Medium locked or settle', audio: 'VO / dialogue start', w: 0.14, tag: 'intro' },
      { framing: 'Core action - main beat A', movement: 'Follow or locked coverage', audio: 'Primary dialogue / VO', w: 0.16, tag: 'beat_a' },
      { framing: 'Insert / evidence cutaway', movement: 'Locked detail', audio: 'SFX; bed under', w: 0.1, tag: 'insert' },
      { framing: 'Core action - main beat B', movement: 'Alternate angle', audio: 'Continue VO / dialogue', w: 0.14, tag: 'beat_b' },
      { framing: 'Reaction / emotional beat', movement: 'Close locked', audio: 'Music swell or silence', w: 0.1, tag: 'react' },
      { framing: 'Transition / travel / process', movement: 'Gimbal or whip-ready', audio: 'Bridge music / whoosh', w: 0.1, tag: 'bridge' },
      { framing: 'Climax / payoff moment', movement: 'Push-in or reveal', audio: 'Music peak; clear VO', w: 0.1, tag: 'payoff' },
      { framing: 'Resolve + CTA / end card safe', movement: 'Locked or pull-back', audio: 'Resolve; VO CTA', w: 0.06, tag: 'cta' }
    ]
  };

  var TYPE_LABELS = {
    talking_head: 'Talking head',
    product: 'Product review',
    product_review: 'Product review',
    tutorial: 'Tutorial',
    vlog: 'Vlog',
    short_hook: 'Short-form hook',
    launch_trailer: 'Launch trailer',
    event: 'Event',
    custom: 'Custom / mixed'
  };

  /** Beats where talent/gear notes belong (A-roll / to-camera / CTA). */
  var TALENT_TAGS = {
    a_roll: 1,
    agenda: 1,
    intro: 1,
    cta: 1,
    speech: 1,
    verdict: 1,
    reflect: 1,
    title: 1
  };

  var lastShots = [];
  var lastMeta = null;
  var persistTimer = null;

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

  function formatTime(sec) {
    sec = Math.max(1, Math.round(sec));
    if (sec < 60) return '~' + sec + 's';
    var m = Math.floor(sec / 60);
    var r = sec % 60;
    if (r === 0) return '~' + m + 'm';
    return '~' + m + 'm ' + r + 's';
  }

  function parseTimeInput(raw) {
    var s = cleanText(raw).toLowerCase().replace(/^~/, '');
    if (!s) return null;
    var mColon = s.match(/^(\d+)\s*:\s*(\d{1,2})$/);
    if (mColon) {
      return Math.max(1, parseInt(mColon[1], 10) * 60 + parseInt(mColon[2], 10));
    }
    var mCombo = s.match(/^(?:(\d+)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+)\s*s(?:ec(?:ond)?s?)?)?$/);
    if (mCombo && (mCombo[1] || mCombo[2])) {
      return Math.max(1, (parseInt(mCombo[1] || '0', 10) * 60) + parseInt(mCombo[2] || '0', 10));
    }
    var n = parseInt(s.replace(/[^\d]/g, ''), 10);
    if (!isNaN(n) && n > 0) return n;
    return null;
  }

  function parseList(raw) {
    return cleanText(raw)
      .split(/[,;|/]+/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  function splitSentences(concept) {
    return cleanText(concept)
      .replace(/([.!?])\s+/g, '$1\n')
      .split(/\n+/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  function firstHook(concept) {
    var sents = splitSentences(concept);
    var first = (sents[0] || concept).replace(/[.!?]+$/, '');
    if (first.length > 90) first = first.slice(0, 87).replace(/\s+\S*$/, '') + '…';
    return sentenceCase(first);
  }

  function pickKeywords(concept) {
    var stop = {
      a: 1, an: 1, the: 1, and: 1, or: 1, for: 1, with: 1, from: 1, that: 1, this: 1,
      into: 1, onto: 1, about: 1, show: 1, showing: 1, video: 1, demo: 1, aimed: 1,
      who: 1, what: 1, how: 1, your: 1, you: 1, our: 1, their: 1, become: 1, becomes: 1
    };
    var bag = {};
    cleanText(concept)
      .toLowerCase()
      .replace(/[^a-z0-9\s\-']/g, ' ')
      .split(/\s+/)
      .forEach(function (w) {
        if (w.length < 4 || stop[w]) return;
        bag[w] = (bag[w] || 0) + 1;
      });
    return Object.keys(bag)
      .sort(function (a, b) { return bag[b] - bag[a]; })
      .slice(0, 4);
  }

  function baseTag(tag) {
    return String(tag || '').replace(/_x$/, '');
  }

  function isTalentBeat(tag) {
    var t = baseTag(tag);
    if (TALENT_TAGS[t]) return true;
    return t.indexOf('a_roll') >= 0;
  }

  function shotCountForDuration(seconds, baseLen) {
    if (seconds <= 30) return Math.min(5, baseLen);
    if (seconds <= 60) return Math.min(7, baseLen);
    if (seconds <= 90) return Math.min(8, baseLen);
    if (seconds <= 180) return baseLen;
    if (seconds <= 300) return Math.min(baseLen + 2, 12);
    return Math.min(baseLen + 3, 14);
  }

  function normalizeType(type) {
    if (type === 'product') return 'product_review';
    return type || 'tutorial';
  }

  function normalizeDensity(d) {
    return d === 'short' ? 'short' : 'full';
  }

  /** Evenly pick short-arc beats from a template (open → middle → CTA). */
  function pickShortBeats(base) {
    if (base.length <= 5) return base.slice();
    var want = 5;
    var indices = [];
    var i;
    for (i = 0; i < want; i++) {
      indices.push(Math.round((i / (want - 1)) * (base.length - 1)));
    }
    var seen = {};
    var out = [];
    indices.forEach(function (idx) {
      if (seen[idx]) return;
      seen[idx] = 1;
      out.push(base[idx]);
    });
    // Prefer keeping a real CTA/outro if the last pick was not one
    var last = base[base.length - 1];
    if (out.length && baseTag(out[out.length - 1].tag) !== baseTag(last.tag)) {
      out[out.length - 1] = last;
    }
    return out;
  }

  function expandTemplate(type, targetSec, density) {
    type = normalizeType(type);
    density = normalizeDensity(density);
    var base = TEMPLATES[type] || TEMPLATES.custom;
    var picks;
    var count;

    if (density === 'short') {
      picks = pickShortBeats(base);
      // Cap further for very short targets
      if (targetSec <= 30 && picks.length > 4) picks = picks.slice(0, 4);
    } else {
      count = shotCountForDuration(targetSec, base.length);
      picks = base.slice(0, Math.min(count, base.length));

      // Longer videos: duplicate middle coverage beats with variant labels
      if (count > picks.length) {
        var mid = picks.slice(2, picks.length - 2);
        var i = 0;
        while (picks.length < count && mid.length) {
          var src = mid[i % mid.length];
          picks.splice(picks.length - 2, 0, {
            framing: src.framing.replace(/step \d+/i, 'extra coverage').replace(/beat [AB]/i, 'extended beat'),
            movement: src.movement,
            audio: src.audio,
            w: src.w * 0.85,
            tag: src.tag + '_x'
          });
          i++;
        }
      }
    }

    var sumW = picks.reduce(function (a, s) { return a + s.w; }, 0);
    return picks.map(function (s) {
      return {
        framing: s.framing,
        movement: s.movement,
        audio: s.audio,
        tag: s.tag,
        seconds: Math.max(2, Math.round((s.w / sumW) * targetSec))
      };
    });
  }

  function sentenceForShot(sentences, idx, total) {
    if (!sentences.length || total < 1) return '';
    if (sentences.length === 1) return idx === 0 ? sentences[0] : '';
    var mapped = Math.min(
      sentences.length - 1,
      Math.floor((idx / Math.max(total - 1, 1)) * (sentences.length - 1))
    );
    // Prefer unique mapping when enough sentences
    if (sentences.length >= total) return sentences[idx] || '';
    return sentences[mapped] || '';
  }

  function enrichShots(shots, opts) {
    var sentences = splitSentences(opts.concept);
    var hook = firstHook(opts.concept);
    var keys = pickKeywords(opts.concept);
    var locs = opts.locations || [];
    var talent = cleanText(opts.talent);
    var keyPhrase = keys.length ? keys.slice(0, 2).join(' / ') : '';
    var total = shots.length;

    return shots.map(function (s, idx) {
      var loc = locs.length ? locs[idx % locs.length] : '';
      var framing = s.framing;
      var detail = '';
      var beatLine = sentenceForShot(sentences, idx, total);

      if (beatLine) {
        var trimmed = beatLine.replace(/[.!?]+$/, '');
        if (trimmed.length > 110) trimmed = trimmed.slice(0, 107).replace(/\s+\S*$/, '') + '…';
        detail = 'Beat: ' + sentenceCase(trimmed);
      } else if (idx === 0 && hook) {
        detail = 'Story: ' + hook;
      }

      if (keyPhrase && (s.tag.indexOf('a_roll') >= 0 || s.tag.indexOf('step') >= 0 || s.tag === 'use' || s.tag === 'beat_a' || s.tag === 'proof')) {
        detail = (detail ? detail + ' · ' : '') + 'Lean into: ' + keyPhrase;
      } else if (keys.length && (s.tag === 'detail' || s.tag === 'insert' || s.tag === 'feature')) {
        detail = (detail ? detail + ' · ' : '') + 'Feature cue: ' + keys[idx % keys.length];
      }

      if (loc) {
        framing = framing + ' @ ' + loc;
      }
      if (talent && isTalentBeat(s.tag)) {
        detail = (detail ? detail + ' · ' : '') + 'Talent/gear: ' + talent;
      }

      return {
        num: idx + 1,
        framing: framing,
        detail: detail,
        movement: s.movement,
        audio: s.audio,
        seconds: s.seconds,
        timeLabel: formatTime(s.seconds),
        tag: s.tag
      };
    });
  }

  function rebalanceTimes(shots, targetSec) {
    var sum = shots.reduce(function (a, s) { return a + s.seconds; }, 0);
    if (sum === targetSec || !sum) return shots;
    var scale = targetSec / sum;
    var acc = 0;
    shots.forEach(function (s, i) {
      if (i === shots.length - 1) {
        s.seconds = Math.max(2, targetSec - acc);
      } else {
        s.seconds = Math.max(2, Math.round(s.seconds * scale));
        acc += s.seconds;
      }
      s.timeLabel = formatTime(s.seconds);
    });
    return shots;
  }

  function generate(opts) {
    var raw = expandTemplate(opts.type, opts.duration, opts.density);
    var shots = enrichShots(raw, opts);
    return rebalanceTimes(shots, opts.duration);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renumber(shots) {
    shots.forEach(function (s, i) {
      s.num = i + 1;
      if (!s.timeLabel) s.timeLabel = formatTime(s.seconds || 5);
    });
    return shots;
  }

  function getToken() {
    return Auth && Auth.getToken ? Auth.getToken() : '';
  }

  function loginHref() {
    return Auth && Auth.loginUrl ? Auth.loginUrl('/shot-list') : '/login?next=' + encodeURIComponent('/shot-list');
  }

  function purchaseLinksHtml() {
    return (
      '<span class="tools-inline-cta">' +
      '<a href="/pricing">Buy credits</a>' +
      '<a href="/account">Account</a>' +
      '</span>'
    );
  }

  function apiVideoType(type) {
    type = normalizeType(type);
    if (type === 'short_hook') return 'short_form_hook';
    return type;
  }

  function mapAiShots(apiShots) {
    if (!Array.isArray(apiShots)) return [];
    return apiShots.map(function (s, i) {
      var detail = '';
      var beat = cleanText(s && s.beat);
      var note = cleanText(s && s.note);
      var talent = cleanText(s && s.talent);
      if (beat) detail = 'Beat: ' + beat;
      if (note) detail = (detail ? detail + ' · ' : '') + note;
      if (talent) detail = (detail ? detail + ' · ' : '') + 'Talent/gear: ' + talent;
      var seconds = Math.max(2, Math.round(Number(s && (s.timeSec != null ? s.timeSec : s.seconds)) || 5));
      return {
        num: i + 1,
        framing: cleanText(s && s.framing) || beat || 'Shot ' + (i + 1),
        detail: detail,
        movement: cleanText(s && s.movement) || 'Locked',
        audio: cleanText(s && s.audio) || 'TBD',
        seconds: seconds,
        timeLabel: formatTime(seconds),
        tag: 'ai'
      };
    });
  }

  function syncCreditActions() {
    if (!Auth || !Auth.syncCreditActions) return;
    Auth.syncCreditActions({
      signin: $('slist-credits-signin'),
      buy: $('slist-credits-buy'),
      account: $('slist-credits-account'),
      nextPath: '/shot-list',
      signedIn: !!getToken(),
      paidRemaining: creditsState ? creditsState.paidRemaining : getToken() ? null : 0
    });
  }

  function syncTurnstileVisibility() {
    var wrap = $('slist-turnstile-wrap');
    if (!wrap) return;
    var show =
      !!getToken() &&
      creditsState &&
      creditsState.paidRemaining >= AI_CREDITS;
    wrap.hidden = !show;
    if (show && window.CuemarkTurnstile) {
      CuemarkTurnstile.prepare('slist-turnstile-wrap', 'slist-turnstile').catch(function () {});
    }
  }

  function syncAiButton() {
    var btn = $('slist-ai-submit');
    var note = $('slist-form-note');
    if (!btn) return;
    var gate = aiGateReason();
    btn.disabled = !!btn.classList.contains('is-busy') ? true : !gate.ok;
    btn.classList.toggle('is-disabled', !gate.ok);
    btn.title = gate.ok
      ? 'Charges ' + AI_CREDITS + ' purchased credits'
      : 'Purchased credits required';
    if (note && !btn.classList.contains('is-busy')) {
      note.innerHTML = gate.reason;
    }
    syncTurnstileVisibility();
  }

  function aiGateReason() {
    if (!getToken()) {
      return {
        ok: false,
        reason:
          'Free templates never charge. <a href="' +
          loginHref() +
          '">Sign in</a> for AI generate (purchased credits only).'
      };
    }
    if (!creditsState) {
      return { ok: false, reason: 'Checking purchased credit balance…' };
    }
    if (!creditsState.hasPaid || creditsState.paidRemaining <= 0) {
      return {
        ok: false,
        reason:
          'Signed in with 0 purchased credits. Free signup credits cannot run AI generate. ' +
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
      reason:
        'Purchased credits remaining: ' +
        creditsState.paidRemaining +
        ' · AI generate charges ' +
        AI_CREDITS +
        ' (signup/promo never cover). Free templates stay $0.'
    };
  }

  function updateCreditsPanel() {
    var bal = $('slist-balance');
    var meter = $('slist-credit-meter');
    var paidEl = $('slist-paid-value');
    var token = getToken();
    syncCreditActions();
    if (!token) {
      creditsState = null;
      if (meter) meter.hidden = true;
      if (bal) {
        bal.className = 'tools-credit-status is-warn';
        bal.textContent =
          'Free templates never charge. Sign in to use AI generate with purchased credits.';
      }
      syncAiButton();
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
            'Session expired. <a href="' + loginHref() + '">Sign in</a> for AI generate.';
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
      if (snap.paidRemaining >= AI_CREDITS) {
        bal.className = 'tools-credit-status is-ok';
        bal.textContent =
          'Ready for AI generate · ' + snap.paidRemaining + ' purchased credits remaining.';
      } else if (snap.paidRemaining > 0) {
        bal.className = 'tools-credit-status is-warn';
        bal.innerHTML =
          'Need ' +
          AI_CREDITS +
          ' purchased credits (you have ' +
          snap.paidRemaining +
          '). ' +
          purchaseLinksHtml();
      } else {
        bal.className = 'tools-credit-status is-warn';
        bal.innerHTML =
          'Signed in with 0 purchased credits. Free signup credits cannot run AI generate. ' +
          purchaseLinksHtml();
      }
      syncCreditActions();
      syncAiButton();
    }

    if (Auth && Auth.fetchCredits) {
      Auth.fetchCredits().then(applyCredits);
    } else {
      applyCredits({ ok: false });
    }
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
      CuemarkTurnstile.reset('slist-turnstile');
    }
  }

  function withTurnstile(run) {
    if (window.CuemarkTurnstile && CuemarkTurnstile.enabled && CuemarkTurnstile.enabled()) {
      return CuemarkTurnstile.requireToken('slist-turnstile').then(run);
    }
    if (window.CuemarkTurnstile) {
      return CuemarkTurnstile.loadConfig().then(function () {
        if (CuemarkTurnstile.enabled()) {
          return CuemarkTurnstile.requireToken('slist-turnstile').then(run);
        }
        return run('');
      });
    }
    return Promise.resolve(run(''));
  }

  function onAiGenerate() {
    showError('');
    var opts = readFormOpts();
    if (opts.concept.length < 12) {
      showError('Add a short concept (at least a sentence) so AI has something to expand.');
      $('slist-concept').focus();
      return;
    }

    var gate = aiGateReason();
    if (!gate.ok) {
      showError('');
      var note = $('slist-form-note');
      if (note) note.innerHTML = gate.reason;
      var bal = $('slist-balance');
      if (bal) {
        bal.className = 'tools-credit-status is-warn';
        bal.innerHTML = gate.reason;
      }
      $('slist-credits').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    saveBrief({
      concept: opts.concept,
      duration: opts.duration,
      type: opts.type,
      locations: opts.locations,
      talent: opts.talent,
      density: opts.density,
      savedAt: Date.now()
    });

    var btn = $('slist-ai-submit');
    var freeBtn = $('slist-submit');
    setBusy(btn, true, 'Generating…');
    if (freeBtn) freeBtn.disabled = true;

    withTurnstile(function (turnstileToken) {
      var body = {
        brief: opts.concept,
        concept: opts.concept,
        type: apiVideoType(opts.type),
        videoType: apiVideoType(opts.type),
        density: opts.density,
        duration: opts.duration,
        durationSec: opts.duration,
        locations: opts.locations,
        talent: opts.talent,
        turnstile_token: turnstileToken || undefined
      };
      return fetch(BACKEND + '/api/shot-list/generate', {
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
          return res.json().then(function (data) {
            return { res: res, data: data };
          });
        })
        .then(function (x) {
          setBusy(btn, false);
          if (freeBtn) freeBtn.disabled = false;
          resetTurnstile();

          if (x.res.status === 503 && x.data && x.data.reason === 'provider_not_configured') {
            showError(
              'Shot List AI is temporarily unavailable. Free templates still work - try Generate free.'
            );
            syncAiButton();
            return;
          }
          if (x.res.status === 400 && x.data && /security check/i.test(x.data.error || '')) {
            showError((x.data && x.data.error) || 'Complete the security check, then try again.');
            syncAiButton();
            return;
          }
          if (x.res.status === 401) {
            if (Auth && Auth.clearToken) Auth.clearToken();
            creditsState = null;
            showError('');
            updateCreditsPanel();
            var note401 = $('slist-form-note');
            if (note401) {
              note401.innerHTML =
                'Session expired. <a href="' + loginHref() + '">Sign in</a> again for AI generate.';
            }
            return;
          }
          if (x.res.status === 402) {
            var needCr =
              x.data && x.data.credits_required != null ? x.data.credits_required : AI_CREDITS;
            var paidLeft =
              x.data && x.data.paid_credits_remaining != null
                ? x.data.paid_credits_remaining
                : 0;
            if (creditsState) creditsState.paidRemaining = paidLeft;
            if (x.data && x.data.reason === 'paid_credits_required') {
              showError('');
              var msg402 =
                'Purchased credits required (need ' +
                needCr +
                ', you have ' +
                paidLeft +
                '). Free signup credits cannot run AI generate. ' +
                purchaseLinksHtml();
              var note402 = $('slist-form-note');
              if (note402) note402.innerHTML = msg402;
              var bal402 = $('slist-balance');
              if (bal402) {
                bal402.className = 'tools-credit-status is-warn';
                bal402.innerHTML = msg402;
              }
            } else {
              showError('Not enough credits (need ' + needCr + ').');
            }
            updateCreditsPanel();
            return;
          }
          if (x.res.status === 429) {
            showError((x.data && x.data.error) || 'Too many requests. Try again in a bit.');
            syncAiButton();
            return;
          }
          if (!x.res.ok) {
            showError(
              (x.data && x.data.error) || 'Could not generate. No charge if the provider failed.'
            );
            syncAiButton();
            return;
          }

          var shots = mapAiShots(x.data.shots);
          if (!shots.length) {
            showError('AI returned an empty list. No charge applied - try again.');
            syncAiButton();
            return;
          }

          if (x.data.paid_credits_remaining != null && creditsState) {
            creditsState.paidRemaining = Number(x.data.paid_credits_remaining);
            creditsState.hasPaid = creditsState.paidRemaining > 0;
          }

          render(shots, opts);
          persistState();
          updateCreditsPanel();
          $('slist-results').scrollIntoView({ behavior: 'smooth', block: 'start' });

          var charged =
            x.data.credits_charged != null ? x.data.credits_charged : AI_CREDITS;
          var paidRemain =
            x.data.paid_credits_remaining != null ? x.data.paid_credits_remaining : null;
          var noteOk = $('slist-form-note');
          if (noteOk) {
            noteOk.textContent =
              'AI shot list ready. Charged ' +
              charged +
              ' purchased credit' +
              (charged === 1 ? '' : 's') +
              (paidRemain != null ? ' · ' + paidRemain + ' purchased remaining' : '') +
              '. Edit freely below.';
          }
        })
        .catch(function () {
          setBusy(btn, false);
          if (freeBtn) freeBtn.disabled = false;
          resetTurnstile();
          showError('Network error. Try again - no charge if the request failed.');
          syncAiButton();
        });
    }).catch(function (err) {
      setBusy(btn, false);
      if (freeBtn) freeBtn.disabled = false;
      showError((err && err.message) || 'Complete the security check, then try again.');
      syncAiButton();
    });
  }

  function blankShot() {
    return {
      num: 1,
      framing: 'New shot - describe setup',
      detail: '',
      movement: 'Locked',
      audio: 'TBD',
      seconds: 5,
      timeLabel: formatTime(5),
      tag: 'custom'
    };
  }

  function updateSummary() {
    if (!lastMeta) return;
    var total = lastShots.reduce(function (a, s) { return a + (s.seconds || 0); }, 0);
    var dens = normalizeDensity(lastMeta.density) === 'short' ? 'Short · ' : '';
    $('slist-summary').textContent =
      dens +
      (TYPE_LABELS[lastMeta.type] || 'Custom') +
      ' · ' + lastShots.length + ' shots · ~' + formatTime(total).replace(/^~/, '') +
      ' total (target ' + formatTime(lastMeta.duration).replace(/^~/, '') + '). Edit freely, then copy, download, or print.';
  }

  function render(shots, meta) {
    lastShots = renumber(shots || []);
    lastMeta = meta;
    var body = $('slist-body');
    var html = lastShots.map(function (s, idx) {
      return (
        '<tr data-idx="' + idx + '">' +
        '<td class="slist-num">' + s.num + '</td>' +
        '<td>' +
        '<textarea class="slist-cell" data-field="framing" rows="2" aria-label="Setup / framing">' + escapeHtml(s.framing) + '</textarea>' +
        (s.detail
          ? '<textarea class="slist-cell slist-cell-detail" data-field="detail" rows="1" aria-label="Note">' + escapeHtml(s.detail) + '</textarea>'
          : '<textarea class="slist-cell slist-cell-detail" data-field="detail" rows="1" aria-label="Note" placeholder="Note (optional)"></textarea>') +
        '</td>' +
        '<td><textarea class="slist-cell" data-field="movement" rows="2" aria-label="Movement">' + escapeHtml(s.movement) + '</textarea></td>' +
        '<td><textarea class="slist-cell" data-field="audio" rows="2" aria-label="Audio">' + escapeHtml(s.audio) + '</textarea></td>' +
        '<td><input class="slist-cell slist-cell-time" data-field="time" type="text" value="' + escapeHtml(s.timeLabel) + '" aria-label="Time" /></td>' +
        '<td class="slist-row-actions no-print">' +
        '<button type="button" class="slist-icon-btn" data-action="up" title="Move up" aria-label="Move up"' + (idx === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="slist-icon-btn" data-action="down" title="Move down" aria-label="Move down"' + (idx === lastShots.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" class="slist-icon-btn slist-icon-danger" data-action="delete" title="Delete" aria-label="Delete row">×</button>' +
        '</td>' +
        '</tr>'
      );
    }).join('');
    body.innerHTML = html;

    updateSummary();

    var empty = $('slist-empty');
    if (empty) empty.classList.add('is-hidden');
    $('slist-results').classList.add('is-visible');
  }

  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persistState, 200);
  }

  function persistState() {
    if (!lastMeta) return;
    saveBrief({
      concept: lastMeta.concept,
      duration: lastMeta.duration,
      type: lastMeta.type,
      locations: lastMeta.locations || [],
      talent: lastMeta.talent || '',
      density: normalizeDensity(lastMeta.density),
      shots: lastShots,
      savedAt: Date.now()
    });
  }

  function readFormOpts() {
    return {
      concept: cleanText($('slist-concept').value),
      duration: parseInt($('slist-duration').value, 10) || 60,
      type: normalizeType($('slist-type').value || 'tutorial'),
      locations: parseList($('slist-locations').value),
      talent: cleanText($('slist-talent').value),
      density: normalizeDensity(
        (document.querySelector('input[name="slist-density"]:checked') || {}).value || 'full'
      )
    };
  }

  function setDensity(value) {
    value = normalizeDensity(value);
    var el = document.querySelector('input[name="slist-density"][value="' + value + '"]');
    if (el) el.checked = true;
  }

  function shotsToText(shots, meta) {
    var lines = [
      'Keyweaver Shot List',
      'Type: ' + (TYPE_LABELS[meta.type] || meta.type),
      'Density: ' + (normalizeDensity(meta.density) === 'short' ? 'Short' : 'Full'),
      'Target: ' + formatTime(meta.duration),
      'Concept: ' + cleanText(meta.concept).replace(/\n/g, ' '),
      ''
    ];
    if (meta.locations && meta.locations.length) {
      lines.push('Locations: ' + meta.locations.join(', '));
    }
    if (meta.talent) {
      lines.push('Talent / gear: ' + meta.talent);
    }
    if (lines[lines.length - 1] !== '') lines.push('');

    shots.forEach(function (s) {
      lines.push(
        'Shot ' + s.num + ' (' + s.timeLabel + ')' +
        '\n  Setup: ' + s.framing +
        (s.detail ? '\n  Note: ' + s.detail : '') +
        '\n  Move:  ' + s.movement +
        '\n  Audio: ' + s.audio +
        '\n'
      );
    });
    lines.push('Generated at https://keyweaver.io/shot-list');
    return lines.join('\n');
  }

  function shotsToCsv(shots) {
    function cell(v) {
      var s = String(v == null ? '' : v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var rows = [['Shot', 'Setup / framing', 'Note', 'Movement', 'Audio', 'Time (sec)', 'Time label']];
    shots.forEach(function (s) {
      rows.push([s.num, s.framing, s.detail || '', s.movement, s.audio, s.seconds, s.timeLabel]);
    });
    return rows.map(function (r) {
      return r.map(cell).join(',');
    }).join('\n');
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    } finally {
      ta.remove();
    }
  }

  function readJson(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveBrief(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore quota */ }
  }

  function restoreShots(saved) {
    if (!saved || !Array.isArray(saved.shots) || !saved.shots.length) return false;
    var meta = {
      concept: saved.concept || '',
      duration: saved.duration || 60,
      type: normalizeType(saved.type),
      locations: Array.isArray(saved.locations) ? saved.locations : parseList(saved.locations),
      talent: saved.talent || '',
      density: normalizeDensity(saved.density)
    };
    var shots = saved.shots.map(function (s, i) {
      var seconds = parseInt(s.seconds, 10);
      if (isNaN(seconds) || seconds < 1) seconds = 5;
      return {
        num: i + 1,
        framing: s.framing || '',
        detail: s.detail || '',
        movement: s.movement || '',
        audio: s.audio || '',
        seconds: seconds,
        timeLabel: s.timeLabel || formatTime(seconds),
        tag: s.tag || 'custom'
      };
    });
    render(shots, meta);
    return true;
  }

  function loadBrief() {
    var saved = readJson(STORAGE_KEY);
    if (saved && saved.concept) {
      $('slist-concept').value = saved.concept || '';
      if (saved.duration) $('slist-duration').value = String(saved.duration);
      if (saved.type) $('slist-type').value = normalizeType(saved.type);
      if (saved.locations) $('slist-locations').value = Array.isArray(saved.locations) ? saved.locations.join(', ') : saved.locations;
      if (saved.talent) $('slist-talent').value = saved.talent;
      if (saved.density) setDensity(saved.density);
      if (restoreShots(saved)) return 'saved-shots';
      return 'saved';
    }

    var vseo = readJson(VSEO_KEY);
    var ckit = readJson(CKIT_KEY);
    var handoff = null;
    var source = '';

    if (ckit && ckit.brief) {
      handoff = ckit.brief;
      source = 'Campaign Kit';
    } else if (vseo && vseo.brief) {
      handoff = vseo.brief;
      source = 'Video SEO';
    }

    if (handoff) {
      $('slist-concept').value = handoff;
      var banner = $('slist-handoff-banner');
      banner.style.display = 'block';
      banner.innerHTML =
        'Using your last <a href="/' +
        (source === 'Campaign Kit' ? 'campaign-kit' : 'video-seo') +
        '">' +
        source +
        '</a> brief in this shot list. Edit freely, then Generate free (templates) or AI generate (purchased credits).';
      return 'handoff';
    }
    return null;
  }

  function showError(msg) {
    var el = $('slist-error');
    if (!msg) {
      el.textContent = '';
      el.classList.remove('is-visible');
      return;
    }
    el.textContent = msg;
    el.classList.add('is-visible');
  }

  function flashBtn(btn, label) {
    var prev = btn.textContent;
    btn.textContent = label;
    setTimeout(function () { btn.textContent = prev; }, 1400);
  }

  function onCellInput(e) {
    var field = e.target.getAttribute('data-field');
    if (!field) return;
    var row = e.target.closest('tr');
    if (!row) return;
    var idx = parseInt(row.getAttribute('data-idx'), 10);
    if (isNaN(idx) || !lastShots[idx]) return;

    if (field === 'time') {
      var parsed = parseTimeInput(e.target.value);
      if (parsed != null) {
        lastShots[idx].seconds = parsed;
        lastShots[idx].timeLabel = formatTime(parsed);
      }
    } else {
      lastShots[idx][field] = e.target.value;
    }
    updateSummary();
    schedulePersist();
  }

  function onCellBlur(e) {
    var field = e.target.getAttribute('data-field');
    if (field !== 'time') return;
    var row = e.target.closest('tr');
    if (!row) return;
    var idx = parseInt(row.getAttribute('data-idx'), 10);
    if (isNaN(idx) || !lastShots[idx]) return;
    var parsed = parseTimeInput(e.target.value);
    if (parsed != null) {
      lastShots[idx].seconds = parsed;
      lastShots[idx].timeLabel = formatTime(parsed);
      e.target.value = lastShots[idx].timeLabel;
    } else {
      e.target.value = lastShots[idx].timeLabel;
    }
    updateSummary();
    schedulePersist();
  }

  function onRowAction(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var row = btn.closest('tr');
    if (!row) return;
    var idx = parseInt(row.getAttribute('data-idx'), 10);
    if (isNaN(idx)) return;

    if (action === 'delete') {
      if (lastShots.length <= 1) return;
      lastShots.splice(idx, 1);
    } else if (action === 'up' && idx > 0) {
      var up = lastShots[idx - 1];
      lastShots[idx - 1] = lastShots[idx];
      lastShots[idx] = up;
    } else if (action === 'down' && idx < lastShots.length - 1) {
      var down = lastShots[idx + 1];
      lastShots[idx + 1] = lastShots[idx];
      lastShots[idx] = down;
    } else {
      return;
    }
    render(lastShots, lastMeta);
    persistState();
  }

  function onAddRow() {
    if (!lastMeta) return;
    lastShots.push(blankShot());
    render(lastShots, lastMeta);
    persistState();
  }

  function onSubmit(e) {
    e.preventDefault();
    showError('');
    var opts = readFormOpts();
    if (opts.concept.length < 12) {
      showError('Add a short concept (at least a sentence) so the shot list has something to hang on.');
      $('slist-concept').focus();
      return;
    }

    saveBrief({
      concept: opts.concept,
      duration: opts.duration,
      type: opts.type,
      locations: opts.locations,
      talent: opts.talent,
      density: opts.density,
      savedAt: Date.now()
    });

    var submit = $('slist-submit');
    var aiBtn = $('slist-ai-submit');
    if (submit) {
      submit.classList.add('is-busy');
      submit.disabled = true;
      submit.dataset.prevLabel = submit.textContent;
      submit.textContent = 'Generating…';
    }
    if (aiBtn) aiBtn.disabled = true;
    setTimeout(function () {
      var shots = generate(opts);
      render(shots, opts);
      persistState();
      $('slist-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (submit) {
        submit.classList.remove('is-busy');
        submit.disabled = false;
        if (submit.dataset.prevLabel) submit.textContent = submit.dataset.prevLabel;
        delete submit.dataset.prevLabel;
      }
      syncAiButton();
    }, 10);
  }

  function onClear() {
    $('slist-form').reset();
    $('slist-duration').value = '60';
    $('slist-type').value = 'tutorial';
    setDensity('full');
    showError('');
    $('slist-results').classList.remove('is-visible');
    $('slist-body').innerHTML = '';
    var empty = $('slist-empty');
    if (empty) empty.classList.remove('is-hidden');
    $('slist-handoff-banner').style.display = 'none';
    lastShots = [];
    lastMeta = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function init() {
    loadBrief();
    $('slist-form').addEventListener('submit', onSubmit);
    $('slist-clear').addEventListener('click', onClear);

    var aiBtn = $('slist-ai-submit');
    if (aiBtn) aiBtn.addEventListener('click', onAiGenerate);

    var body = $('slist-body');
    body.addEventListener('input', onCellInput);
    body.addEventListener('change', onCellInput);
    body.addEventListener('blur', onCellBlur, true);
    body.addEventListener('click', onRowAction);

    var addBtn = $('slist-add-row');
    if (addBtn) addBtn.addEventListener('click', onAddRow);

    var printBtn = $('slist-print');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        if (!lastShots.length) return;
        window.print();
      });
    }

    $('slist-copy').addEventListener('click', function () {
      if (!lastShots.length || !lastMeta) return;
      copyText(shotsToText(lastShots, lastMeta)).then(function () {
        flashBtn($('slist-copy'), 'Copied');
      });
    });

    $('slist-dl-txt').addEventListener('click', function () {
      if (!lastShots.length || !lastMeta) return;
      download('keyweaver-shot-list.txt', shotsToText(lastShots, lastMeta), 'text/plain;charset=utf-8');
    });

    $('slist-dl-csv').addEventListener('click', function () {
      if (!lastShots.length) return;
      download('keyweaver-shot-list.csv', shotsToCsv(lastShots), 'text/csv;charset=utf-8');
    });

    updateCreditsPanel();
    if (window.CuemarkTurnstile) {
      CuemarkTurnstile.prepare('slist-turnstile-wrap', 'slist-turnstile').catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
