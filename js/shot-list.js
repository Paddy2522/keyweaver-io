(function () {
  'use strict';

  var STORAGE_KEY = 'keyweaver.shotList.lastBrief';
  var VSEO_KEY = 'keyweaver.videoSeo.lastBrief';
  var CKIT_KEY = 'keyweaver.campaignKit.lastBrief';

  /** Base beat templates: weight shares sum ~1; scaled to target duration. */
  var TEMPLATES = {
    talking_head: [
      { framing: 'Wide establishing — talent + space', movement: 'Locked or very slow push-in', audio: 'Room tone bed; soft music under', w: 0.08, tag: 'open' },
      { framing: 'Medium — talent to camera (A-roll)', movement: 'Locked; slight settle', audio: 'Lav primary; clean dialogue', w: 0.22, tag: 'a_roll' },
      { framing: 'Close-up — eyes / emphasis moment', movement: 'Locked or micro push', audio: 'Same lav; hold music low', w: 0.1, tag: 'emphasis' },
      { framing: 'Over-shoulder / screen / prop insert', movement: 'Slow pan or locked', audio: 'SFX hits; dialogue continues', w: 0.12, tag: 'b_roll' },
      { framing: 'Medium — continue point / story beat', movement: 'Locked', audio: 'Lav; music bed', w: 0.18, tag: 'a_roll' },
      { framing: 'Detail cutaway — hands, UI, object', movement: 'Macro drift or locked', audio: 'Foley / UI ticks', w: 0.1, tag: 'detail' },
      { framing: 'Medium-close — CTA / takeaway', movement: 'Gentle push-in', audio: 'Lav; music lift', w: 0.12, tag: 'cta' },
      { framing: 'Wide outro — hold for end card', movement: 'Locked or pull-back', audio: 'Music resolve; VO optional', w: 0.08, tag: 'outro' }
    ],
    product: [
      { framing: 'Hero wide — product in context', movement: 'Slow orbit or locked beauty', audio: 'Music sting open; no VO yet', w: 0.1, tag: 'hero' },
      { framing: 'Medium — product + talent / hands', movement: 'Slider or gimbal pass', audio: 'VO intro; soft bed', w: 0.14, tag: 'context' },
      { framing: 'Macro — key feature / texture', movement: 'Macro push or rack focus', audio: 'Design SFX; VO feature 1', w: 0.14, tag: 'feature' },
      { framing: 'Lifestyle use — product in action', movement: 'Follow action; medium', audio: 'VO benefit; ambient', w: 0.16, tag: 'use' },
      { framing: 'Before / problem insert', movement: 'Locked or whip cut-ready', audio: 'Tension bed dip', w: 0.1, tag: 'problem' },
      { framing: 'After / reveal — product solves it', movement: 'Reveal tilt or push', audio: 'Music lift; VO payoff', w: 0.12, tag: 'reveal' },
      { framing: 'Packaging / UI / unbox detail', movement: 'Top-down locked or slow pan', audio: 'Foley; short VO', w: 0.1, tag: 'detail' },
      { framing: 'Hero close + CTA / logo hold', movement: 'Locked beauty; end card safe', audio: 'VO CTA; music resolve', w: 0.14, tag: 'cta' }
    ],
    tutorial: [
      { framing: 'Cold open — finished result flash', movement: 'Locked or quick push', audio: 'Hook line VO; music hit', w: 0.08, tag: 'hook' },
      { framing: 'Medium talking — what you’ll learn', movement: 'Locked A-roll', audio: 'Lav; agenda VO', w: 0.12, tag: 'agenda' },
      { framing: 'Screen / work surface — step 1', movement: 'Locked; cursor-safe framing', audio: 'VO step 1; quiet bed', w: 0.16, tag: 'step' },
      { framing: 'Close insert — critical click / tool', movement: 'Locked or slight zoom', audio: 'UI SFX; VO tip', w: 0.1, tag: 'insert' },
      { framing: 'Screen / bench — step 2', movement: 'Locked', audio: 'VO step 2', w: 0.14, tag: 'step' },
      { framing: 'Over-shoulder — hands-on step 3', movement: 'Gentle follow', audio: 'VO step 3; ambient', w: 0.14, tag: 'step' },
      { framing: 'Side-by-side / before-after', movement: 'Locked split-friendly', audio: 'VO compare; music lift', w: 0.1, tag: 'compare' },
      { framing: 'Medium — recap + next step CTA', movement: 'Locked or soft push', audio: 'Lav CTA; music out', w: 0.16, tag: 'cta' }
    ],
    event: [
      { framing: 'Arrival / venue wide establishing', movement: 'Handheld walk-in or locked wide', audio: 'Crowd bed; music under', w: 0.1, tag: 'est' },
      { framing: 'Crowd / energy medium', movement: 'Gimbal weave or locked', audio: 'Ambience; music', w: 0.1, tag: 'crowd' },
      { framing: 'Speaker / stage wide', movement: 'Locked or slow pan', audio: 'Board / PA feed if available', w: 0.12, tag: 'stage' },
      { framing: 'Speaker medium / close', movement: 'Locked; follow if needed', audio: 'Lav or board; isolate voice', w: 0.14, tag: 'speech' },
      { framing: 'Audience reaction cutaways', movement: 'Locked or quick handheld', audio: 'Room tone; soft bed', w: 0.1, tag: 'react' },
      { framing: 'Detail — signage, product, hands', movement: 'Macro / locked', audio: 'Foley; music continue', w: 0.1, tag: 'detail' },
      { framing: 'Networking / candid moments', movement: 'Observational handheld', audio: 'Ambience; sparse VO', w: 0.12, tag: 'candid' },
      { framing: 'Highlight montage picks', movement: 'Varied; cut-friendly', audio: 'Music peak; VO optional', w: 0.12, tag: 'montage' },
      { framing: 'Outro wide + logo / CTA hold', movement: 'Pull-back or locked', audio: 'Music resolve; VO CTA', w: 0.1, tag: 'outro' }
    ],
    custom: [
      { framing: 'Establishing — world / location', movement: 'Slow push or locked wide', audio: 'Bed open; room tone', w: 0.1, tag: 'est' },
      { framing: 'Character / subject introduce', movement: 'Medium locked or settle', audio: 'VO / dialogue start', w: 0.14, tag: 'intro' },
      { framing: 'Core action — main beat A', movement: 'Follow or locked coverage', audio: 'Primary dialogue / VO', w: 0.16, tag: 'beat_a' },
      { framing: 'Insert / evidence cutaway', movement: 'Locked detail', audio: 'SFX; bed under', w: 0.1, tag: 'insert' },
      { framing: 'Core action — main beat B', movement: 'Alternate angle', audio: 'Continue VO / dialogue', w: 0.14, tag: 'beat_b' },
      { framing: 'Reaction / emotional beat', movement: 'Close locked', audio: 'Music swell or silence', w: 0.1, tag: 'react' },
      { framing: 'Transition / travel / process', movement: 'Gimbal or whip-ready', audio: 'Bridge music / whoosh', w: 0.1, tag: 'bridge' },
      { framing: 'Climax / payoff moment', movement: 'Push-in or reveal', audio: 'Music peak; clear VO', w: 0.1, tag: 'payoff' },
      { framing: 'Resolve + CTA / end card safe', movement: 'Locked or pull-back', audio: 'Resolve; VO CTA', w: 0.06, tag: 'cta' }
    ]
  };

  var TYPE_LABELS = {
    talking_head: 'Talking head',
    product: 'Product',
    tutorial: 'Tutorial',
    event: 'Event',
    custom: 'Custom / mixed'
  };

  var lastShots = [];
  var lastMeta = null;

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

  function parseList(raw) {
    return cleanText(raw)
      .split(/[,;|/]+/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  function firstHook(concept) {
    var sents = cleanText(concept)
      .replace(/([.!?])\s+/g, '$1\n')
      .split(/\n+/)
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
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

  function shotCountForDuration(seconds, baseLen) {
    if (seconds <= 30) return Math.min(5, baseLen);
    if (seconds <= 60) return Math.min(7, baseLen);
    if (seconds <= 90) return Math.min(8, baseLen);
    if (seconds <= 180) return baseLen;
    if (seconds <= 300) return Math.min(baseLen + 2, 12);
    return Math.min(baseLen + 3, 14);
  }

  function expandTemplate(type, targetSec) {
    var base = TEMPLATES[type] || TEMPLATES.custom;
    var count = shotCountForDuration(targetSec, base.length);
    var picks = base.slice(0, Math.min(count, base.length));

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

  function enrichShots(shots, opts) {
    var hook = firstHook(opts.concept);
    var keys = pickKeywords(opts.concept);
    var locs = opts.locations;
    var talent = cleanText(opts.talent);
    var keyPhrase = keys.length ? keys.slice(0, 2).join(' / ') : '';

    return shots.map(function (s, idx) {
      var loc = locs.length ? locs[idx % locs.length] : '';
      var framing = s.framing;
      var detail = '';

      if (idx === 0 && hook) {
        detail = 'Story: ' + hook;
      } else if (keyPhrase && (s.tag.indexOf('a_roll') >= 0 || s.tag.indexOf('step') >= 0 || s.tag === 'use' || s.tag === 'beat_a')) {
        detail = 'Lean into: ' + keyPhrase;
      } else if (keys[idx % Math.max(keys.length, 1)] && (s.tag === 'detail' || s.tag === 'insert' || s.tag === 'feature')) {
        detail = 'Feature cue: ' + keys[idx % keys.length];
      }

      if (loc) {
        framing = framing + ' @ ' + loc;
      }
      if (talent && (s.tag.indexOf('a_roll') >= 0 || s.tag === 'speech' || s.tag === 'intro' || s.tag === 'cta' || idx === 1)) {
        detail = (detail ? detail + ' · ' : '') + 'Talent/gear: ' + talent;
      }

      return {
        num: idx + 1,
        framing: framing,
        detail: detail,
        movement: s.movement,
        audio: s.audio,
        seconds: s.seconds,
        timeLabel: formatTime(s.seconds)
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
    var raw = expandTemplate(opts.type, opts.duration);
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

  function render(shots, meta) {
    var body = $('slist-body');
    var html = shots.map(function (s) {
      var setup = '<span class="slist-setup">' + escapeHtml(s.framing) + '</span>';
      if (s.detail) setup += '<span class="slist-detail">' + escapeHtml(s.detail) + '</span>';
      return (
        '<tr>' +
        '<td>' + s.num + '</td>' +
        '<td>' + setup + '</td>' +
        '<td>' + escapeHtml(s.movement) + '</td>' +
        '<td>' + escapeHtml(s.audio) + '</td>' +
        '<td>' + escapeHtml(s.timeLabel) + '</td>' +
        '</tr>'
      );
    }).join('');
    body.innerHTML = html;

    var total = shots.reduce(function (a, s) { return a + s.seconds; }, 0);
    $('slist-summary').textContent =
      (TYPE_LABELS[meta.type] || 'Custom') +
      ' · ' + shots.length + ' shots · ~' + formatTime(total).replace(/^~/, '') +
      ' total (target ' + formatTime(meta.duration).replace(/^~/, '') + '). Edit freely, then copy or download.';

    $('slist-results').classList.add('is-visible');
    lastShots = shots;
    lastMeta = meta;
  }

  function shotsToText(shots, meta) {
    var lines = [
      'Keyweaver Shot List',
      'Type: ' + (TYPE_LABELS[meta.type] || meta.type),
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
    lines.push('Generated free at https://keyweaver.io/shot-list');
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

  function loadBrief() {
    var saved = readJson(STORAGE_KEY);
    if (saved && saved.concept) {
      $('slist-concept').value = saved.concept || '';
      if (saved.duration) $('slist-duration').value = String(saved.duration);
      if (saved.type) $('slist-type').value = saved.type;
      if (saved.locations) $('slist-locations').value = Array.isArray(saved.locations) ? saved.locations.join(', ') : saved.locations;
      if (saved.talent) $('slist-talent').value = saved.talent;
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
        'Prefilling concept from your last <a href="/' +
        (source === 'Campaign Kit' ? 'campaign-kit' : 'video-seo') +
        '">' + source + '</a> brief.';
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

  function onSubmit(e) {
    e.preventDefault();
    showError('');
    var concept = cleanText($('slist-concept').value);
    if (concept.length < 12) {
      showError('Add a short concept (at least a sentence) so the shot list has something to hang on.');
      return;
    }
    var duration = parseInt($('slist-duration').value, 10) || 60;
    var type = $('slist-type').value || 'custom';
    var locations = parseList($('slist-locations').value);
    var talent = cleanText($('slist-talent').value);

    var opts = { concept: concept, duration: duration, type: type, locations: locations, talent: talent };
    saveBrief({
      concept: concept,
      duration: duration,
      type: type,
      locations: locations,
      talent: talent,
      savedAt: Date.now()
    });

    var shots = generate(opts);
    render(shots, opts);
    $('slist-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onClear() {
    $('slist-form').reset();
    $('slist-duration').value = '60';
    $('slist-type').value = 'talking_head';
    showError('');
    $('slist-results').classList.remove('is-visible');
    $('slist-body').innerHTML = '';
    $('slist-handoff-banner').style.display = 'none';
    lastShots = [];
    lastMeta = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function init() {
    loadBrief();
    $('slist-form').addEventListener('submit', onSubmit);
    $('slist-clear').addEventListener('click', onClear);

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
