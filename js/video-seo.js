(function () {
  'use strict';

  var STORAGE_KEY = 'keyweaver.videoSeo.lastBrief';

  var STOP = {
    a: 1, an: 1, the: 1, and: 1, or: 1, but: 1, in: 1, on: 1, at: 1, to: 1, for: 1,
    of: 1, with: 1, by: 1, from: 1, as: 1, is: 1, are: 1, was: 1, were: 1, be: 1,
    been: 1, being: 1, this: 1, that: 1, these: 1, those: 1, it: 1, its: 1, we: 1,
    you: 1, your: 1, our: 1, they: 1, their: 1, i: 1, my: 1, me: 1, he: 1, she: 1,
    his: 1, her: 1, how: 1, what: 1, when: 1, where: 1, why: 1, who: 1, which: 1,
    will: 1, can: 1, could: 1, should: 1, would: 1, about: 1, into: 1, over: 1,
    under: 1, than: 1, then: 1, so: 1, if: 1, not: 1, no: 1, yes: 1, just: 1,
    also: 1, very: 1, more: 1, most: 1, some: 1, any: 1, all: 1, each: 1, every: 1,
    video: 1, videos: 1, watch: 1, today: 1, here: 1, there: 1, like: 1, get: 1,
    got: 1, make: 1, made: 1, using: 1, use: 1, used: 1, show: 1, shows: 1,
    showing: 1, explain: 1, explains: 1, tutorial: 1
  };

  var TONE_MAP = {
    clear: { yt: '', short: '', fb: '' },
    professional: {
      yt: 'Clear, practical walkthrough.',
      short: 'Straight talk, no fluff.',
      fb: 'A clear look at'
    },
    casual: {
      yt: 'Friendly, no-jargon take.',
      short: 'Real talk.',
      fb: 'A casual look at'
    },
    energetic: {
      yt: 'Fast, high-energy breakdown.',
      short: 'Let’s go.',
      fb: 'An energetic take on'
    },
    educational: {
      yt: 'Step-by-step teaching focus.',
      short: 'Learn this.',
      fb: 'A practical guide to'
    }
  };

  var CTA_MAP = {
    none: '',
    subscribe: 'If this helped, subscribe for more.',
    comment: 'Drop your question in the comments.',
    link: 'Link in the description / bio.',
    follow: 'Follow for more like this.',
    share: 'Share this with someone who needs it.'
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

  function titleCaseWord(w) {
    if (!w) return w;
    if (/^[A-Z0-9]{2,}$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  function toTitleCase(s) {
    var small = { and: 1, or: 1, the: 1, a: 1, an: 1, of: 1, in: 1, on: 1, for: 1, to: 1, with: 1 };
    return cleanText(s)
      .split(/\s+/)
      .map(function (w, i) {
        var lower = w.toLowerCase();
        if (i > 0 && small[lower]) return lower;
        return titleCaseWord(w);
      })
      .join(' ');
  }

  function splitSentences(text) {
    return cleanText(text)
      .replace(/([.!?])\s+/g, '$1\n')
      .split(/\n+/)
      .map(function (s) { return s.replace(/^[\u2022\-\*]\s*/, '').trim(); })
      .filter(Boolean);
  }

  function extractKeywords(brief, seeds) {
    var bag = {};
    var words = cleanText(brief).toLowerCase().replace(/[^a-z0-9\s\-']/g, ' ').split(/\s+/);
    words.forEach(function (w) {
      if (w.length < 3 || STOP[w]) return;
      bag[w] = (bag[w] || 0) + 1;
    });

    // Prefer bigrams that appear
    var bigrams = [];
    for (var i = 0; i < words.length - 1; i++) {
      var a = words[i];
      var b = words[i + 1];
      if (STOP[a] || STOP[b] || a.length < 3 || b.length < 3) continue;
      bigrams.push(a + ' ' + b);
    }
    var biCount = {};
    bigrams.forEach(function (bg) { biCount[bg] = (biCount[bg] || 0) + 1; });

    var ranked = Object.keys(bag)
      .sort(function (x, y) { return bag[y] - bag[x] || y.length - x.length; });

    var biRanked = Object.keys(biCount)
      .sort(function (x, y) { return biCount[y] - biCount[x] || y.length - x.length; });

    var seedList = cleanText(seeds)
      .split(/[,;\n]+/)
      .map(function (s) { return s.trim().toLowerCase(); })
      .filter(function (s) { return s.length > 1; });

    var out = [];
    seedList.forEach(function (s) {
      if (out.indexOf(s) === -1) out.push(s);
    });
    biRanked.slice(0, 4).forEach(function (s) {
      if (out.indexOf(s) === -1) out.push(s);
    });
    ranked.slice(0, 10).forEach(function (s) {
      if (out.indexOf(s) === -1) out.push(s);
    });
    return out.slice(0, 14);
  }

  function firstHook(brief) {
    var sents = splitSentences(brief);
    var first = sents[0] || brief;
    first = first.replace(/[.!?]+$/, '');
    if (first.length > 90) first = first.slice(0, 87).replace(/\s+\S*$/, '') + '…';
    return sentenceCase(first);
  }

  function topicPhrase(keywords, brief) {
    if (keywords[0]) return toTitleCase(keywords[0]);
    var hook = firstHook(brief);
    return hook.length > 48 ? hook.slice(0, 45).replace(/\s+\S*$/, '') : hook;
  }

  function clip(s, max) {
    s = cleanText(s);
    if (s.length <= max) return s;
    return s.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[,;:.\-]+$/, '') + '…';
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

  function formatChapters(items) {
    if (!items.length) return '';
    var lines = ['0:00 Intro'];
    var t = 45;
    items.forEach(function (item, idx) {
      var m = Math.floor(t / 60);
      var s = t % 60;
      var stamp = m + ':' + String(s).padStart(2, '0');
      lines.push(stamp + ' ' + sentenceCase(item));
      t += 40 + (idx % 3) * 15;
    });
    return lines.join('\n');
  }

  function hashtagify(keywords, limit, style) {
    var tags = [];
    keywords.forEach(function (k) {
      var tag = '#' + k.replace(/[^a-z0-9]+/gi, '').replace(/^\d+/, '');
      if (tag.length < 3 || tag.length > 28) return;
      if (tags.indexOf(tag) === -1) tags.push(tag);
    });
    if (style === 'tiktok') {
      ['#fyp', '#foryou', '#viral'].forEach(function (t) {
        if (tags.indexOf(t) === -1) tags.push(t);
      });
    } else if (style === 'ig') {
      ['#reels', '#creators', '#contentcreator'].forEach(function (t) {
        if (tags.indexOf(t) === -1) tags.push(t);
      });
    }
    return tags.slice(0, limit);
  }

  function ytTags(keywords) {
    var tags = keywords.slice();
    ['video', 'tutorial', 'how to', 'tips', 'guide'].forEach(function (t) {
      if (tags.indexOf(t) === -1) tags.push(t);
    });
    return tags.slice(0, 18).join(', ');
  }

  function buildCta(ctaKey, platform) {
    var base = CTA_MAP[ctaKey] || '';
    if (!base) return '';
    if (platform === 'youtube' && ctaKey === 'subscribe') {
      return 'If this was useful, subscribe for more practical video workflows.';
    }
    if (platform === 'tiktok' && ctaKey === 'follow') {
      return 'Follow for more short tips.';
    }
    if (platform === 'instagram' && ctaKey === 'link') {
      return 'Link in bio.';
    }
    return base;
  }

  function buildYoutube(brief, keywords, tone, cta, outlineItems) {
    var topic = topicPhrase(keywords, brief);
    var hook = firstHook(brief);
    var sents = splitSentences(brief);
    var bodyBits = sents.slice(0, 4).map(sentenceCase);
    var toneBit = (TONE_MAP[tone] || TONE_MAP.clear).yt;
    var ctaLine = buildCta(cta, 'youtube');

    var titles = [
      clip(topic + (keywords[1] ? ' - ' + toTitleCase(keywords[1]) : ''), 70),
      clip('How to ' + topic.replace(/^How To /i, ''), 70),
      clip(hook.replace(/\.$/, '') + (topic ? ' | ' + topic : ''), 70)
    ];
    // Deduplicate similar titles
    var uniq = [];
    titles.forEach(function (t) {
      var key = t.toLowerCase();
      if (uniq.every(function (u) { return u.toLowerCase() !== key; })) uniq.push(t);
    });
    while (uniq.length < 3) {
      uniq.push(clip(topic + ' Tips That Actually Help', 70));
    }

    var desc = [];
    desc.push(hook + (hook.slice(-1).match(/[.!?]/) ? '' : '.'));
    desc.push('');
    if (toneBit) desc.push(toneBit);
    if (bodyBits.length) {
      desc.push('');
      desc.push('In this video:');
      bodyBits.forEach(function (b) {
        desc.push('• ' + clip(b.replace(/[.!?]+$/, ''), 110));
      });
    }
    if (keywords.length) {
      desc.push('');
      desc.push('Topics: ' + keywords.slice(0, 6).map(toTitleCase).join(' · '));
    }
    if (ctaLine) {
      desc.push('');
      desc.push(ctaLine);
    }
    var chapters = formatChapters(outlineItems);
    if (chapters) {
      desc.push('');
      desc.push('Chapters');
      desc.push(chapters);
    }
    desc.push('');
    desc.push(hashtagify(keywords, 5, 'yt').join(' '));

    var pinned = [
      'Thanks for watching.',
      keywords[0] ? 'Biggest takeaway: ' + sentenceCase(keywords[0]) + '.' : '',
      ctaLine || 'What should I cover next? Tell me below.',
      outlineItems[0] ? 'Chapter tip: start at “' + sentenceCase(outlineItems[0]) + '” if you’re short on time.' : ''
    ].filter(Boolean).join(' ');

    var thumbs = [
      clip(toTitleCase(keywords[0] || topic).toUpperCase(), 28),
      clip((keywords[1] ? toTitleCase(keywords[1]) : 'WATCH THIS').toUpperCase(), 24),
      clip(('HOW TO ' + (keywords[0] || 'DO THIS')).toUpperCase(), 26)
    ];

    return {
      titles: uniq.slice(0, 3),
      description: desc.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
      tags: ytTags(keywords),
      pinned: pinned,
      chapters: chapters || 'Add an outline above to generate chapter placeholders.',
      thumbs: thumbs
    };
  }

  function buildShortDesc(brief, keywords, tone, cta, platform) {
    var hook = firstHook(brief);
    var sents = splitSentences(brief);
    var second = sents[1] ? sentenceCase(sents[1].replace(/[.!?]+$/, '')) : '';
    var toneBit = (TONE_MAP[tone] || TONE_MAP.clear).short;
    var ctaLine = buildCta(cta, platform);
    var tags = hashtagify(keywords, platform === 'tiktok' ? 6 : 8, platform === 'tiktok' ? 'tiktok' : 'ig');

    var parts = [hook + (hook.slice(-1).match(/[.!?]/) ? '' : '.')];
    if (second) parts.push(clip(second, 120) + (second.slice(-1).match(/[.!?]/) ? '' : '.'));
    if (toneBit) parts.push(toneBit);
    if (ctaLine) parts.push(ctaLine);
    parts.push('');
    parts.push(tags.join(' '));

    var text = parts.join(' ').replace(/\s+\n/g, '\n').replace(/\n /g, '\n');
    // Soft platform limits
    var limit = platform === 'tiktok' ? 2200 : 2100;
    return {
      description: clip(text, limit),
      hashtags: tags.join(' ')
    };
  }

  function buildFacebook(brief, keywords, tone, cta) {
    var hook = firstHook(brief);
    var sents = splitSentences(brief);
    var lead = (TONE_MAP[tone] || TONE_MAP.clear).fb;
    var topic = topicPhrase(keywords, brief);
    var ctaLine = buildCta(cta, 'facebook');
    var lines = [];
    lines.push((lead ? lead + ' ' : '') + topic.toLowerCase() + '.');
    lines.push('');
    lines.push(hook + (hook.slice(-1).match(/[.!?]/) ? '' : '.'));
    if (sents[1]) {
      lines.push('');
      lines.push(sentenceCase(sents[1]));
    }
    if (keywords.length) {
      lines.push('');
      lines.push(keywords.slice(0, 4).map(toTitleCase).join(' · '));
    }
    if (ctaLine) {
      lines.push('');
      lines.push(ctaLine);
    }
    return clip(lines.join('\n'), 1800);
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
      tone: $('vseo-tone').value || 'clear',
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
      if (!raw) return;
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
    } catch (e) { /* ignore */ }
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
    wrap.appendChild(input);
    wrap._getValue = function () { return input.value; };
    wrap._copyBtn = btn;
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

  function renderResults(data) {
    var host = $('vseo-results-body');
    var jump = $('vseo-jump');
    var extras = $('vseo-extras-body');
    host.innerHTML = '';
    jump.innerHTML = '';
    extras.innerHTML = '';

    var keywords = extractKeywords(data.brief, data.keywords);
    var outlineItems = parseOutline(data.outline);
    var yt = null;

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
        yt = buildYoutube(data.brief, keywords, data.tone, data.cta, outlineItems);
        host.appendChild(platformSection(
          'youtube',
          'YouTube',
          'Aim for a clear title under ~70 characters. Description can be longer; front-load the hook.',
          [
            { label: 'Title A', value: yt.titles[0], limit: 70, soft: 60 },
            { label: 'Title B', value: yt.titles[1], limit: 70, soft: 60 },
            { label: 'Title C', value: yt.titles[2], limit: 70, soft: 60 },
            { label: 'Description', value: yt.description, multiline: true, rows: 10, limit: 5000, soft: 3000 },
            { label: 'Tags', value: yt.tags, multiline: true, rows: 2, limit: 500, soft: 400 }
          ],
          function (blocks) {
            return [
              'Title A: ' + blocks[0]._getValue(),
              'Title B: ' + blocks[1]._getValue(),
              'Title C: ' + blocks[2]._getValue(),
              '',
              blocks[3]._getValue(),
              '',
              'Tags: ' + blocks[4]._getValue()
            ].join('\n');
          }
        ));
      }

      if (p === 'tiktok') {
        var tt = buildShortDesc(data.brief, keywords, data.tone, data.cta, 'tiktok');
        host.appendChild(platformSection(
          'tiktok',
          'TikTok',
          'Lead with the hook. Keep hashtags relevant - a handful beats a wall of spam.',
          [
            { label: 'Description', value: tt.description, multiline: true, rows: 6, limit: 2200, soft: 300 },
            { label: 'Hashtags', value: tt.hashtags, multiline: true, rows: 2, limit: 200, soft: 150 }
          ],
          function (blocks) {
            return blocks[0]._getValue() + '\n\n' + blocks[1]._getValue();
          }
        ));
      }

      if (p === 'instagram') {
        var ig = buildShortDesc(data.brief, keywords, data.tone, data.cta, 'instagram');
        host.appendChild(platformSection(
          'instagram',
          'Instagram',
          'Caption first, hashtags after a break. Soft limit around a short scroll for mobile.',
          [
            { label: 'Description', value: ig.description, multiline: true, rows: 6, limit: 2100, soft: 400 },
            { label: 'Hashtags', value: ig.hashtags, multiline: true, rows: 2, limit: 300, soft: 220 }
          ],
          function (blocks) {
            return blocks[0]._getValue() + '\n\n' + blocks[1]._getValue();
          }
        ));
      }

      if (p === 'facebook') {
        var fb = buildFacebook(data.brief, keywords, data.tone, data.cta);
        host.appendChild(platformSection(
          'facebook',
          'Facebook',
          'Conversational and skimmable. Native posts usually perform better than link dumps.',
          [
            { label: 'Description', value: fb, multiline: true, rows: 7, limit: 1800, soft: 500 }
          ],
          function (blocks) { return blocks[0]._getValue(); }
        ));
      }
    });

    // Extras from YouTube (or generic if YT not selected)
    if (!yt) {
      yt = buildYoutube(data.brief, keywords, data.tone, data.cta, outlineItems);
    }

    extras.appendChild(fieldBlock({
      label: 'Thumbnail text ideas',
      value: yt.thumbs.join('\n'),
      multiline: true,
      rows: 3,
      limit: 90,
      soft: 70
    }));
    extras.appendChild(fieldBlock({
      label: 'YouTube pinned comment',
      value: yt.pinned,
      multiline: true,
      rows: 3,
      limit: 400,
      soft: 280
    }));
    extras.appendChild(fieldBlock({
      label: 'Chapter placeholders',
      value: yt.chapters,
      multiline: true,
      rows: Math.min(8, 2 + outlineItems.length),
      limit: 800,
      soft: 600
    }));

    $('vseo-results').classList.add('is-visible');
    $('vseo-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function generate() {
    var err = $('vseo-error');
    err.classList.remove('is-visible');
    err.textContent = '';

    var data = readForm();
    if (!data.brief || data.brief.length < 12) {
      err.textContent = 'Add a short video brief (at least a sentence) so we can shape titles and descriptions.';
      err.classList.add('is-visible');
      $('vseo-brief').focus();
      return;
    }
    if (!data.platforms.length) {
      err.textContent = 'Select at least one platform.';
      err.classList.add('is-visible');
      return;
    }

    saveForm(data);
    renderResults(data);
  }

  function clearAll() {
    $('vseo-brief').value = '';
    $('vseo-keywords').value = '';
    $('vseo-outline').value = '';
    $('vseo-tone').value = 'clear';
    $('vseo-cta').value = 'none';
    ['youtube', 'tiktok', 'instagram', 'facebook'].forEach(function (p) {
      var el = $('plat-' + p);
      if (el) el.checked = true;
    });
    $('vseo-results').classList.remove('is-visible');
    $('vseo-results-body').innerHTML = '';
    $('vseo-extras-body').innerHTML = '';
    $('vseo-jump').innerHTML = '';
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    $('vseo-brief').focus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadForm();
    var form = $('vseo-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        generate();
      });
    }
    var clearBtn = $('vseo-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearAll);

    // Close nav dropdowns on outside click (shared pattern safety)
    document.addEventListener('click', function (e) {
      document.querySelectorAll('.nav-products[open]').forEach(function (d) {
        if (!d.contains(e.target)) d.removeAttribute('open');
      });
    });
  });
})();
