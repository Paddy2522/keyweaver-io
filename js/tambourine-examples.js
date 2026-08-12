(function () {
  var EXAMPLES = [
    {
      id: 'soft-documentary',
      title: 'Soft documentary bed',
      meta: 'Music · Ambient piano · ~10s',
      prompt:
        'Soft documentary underscore, calm ambient piano and gentle pads, instrumental bed for video, warm and reflective, no vocals',
      src: '/audio/tambourine/soft-documentary.mp3',
    },
    {
      id: 'tech-pulse',
      title: 'Tech promo pulse',
      meta: 'Music · Electronic · ~10s',
      prompt:
        'Upbeat modern tech promo instrumental, clean electronic pulse, light synths and soft drums, energetic but controlled, no vocals',
      src: '/audio/tambourine/tech-pulse.mp3',
    },
    {
      id: 'cinematic-tension',
      title: 'Cinematic tension',
      meta: 'Music · Cinematic · ~10s',
      prompt:
        'Dark cinematic tension underscore, low strings and subtle percussion building slowly, mysterious instrumental bed, no vocals',
      src: '/audio/tambourine/cinematic-tension.mp3',
    },
    {
      id: 'soft-whoosh',
      title: 'Soft whoosh',
      meta: 'SFX · Transition',
      prompt: 'Soft airy whoosh transition, clean and short, suitable for a video cut or UI swipe',
      src: '/audio/tambourine/soft-whoosh.mp3',
    },
    {
      id: 'ui-click',
      title: 'UI click',
      meta: 'SFX · Interface',
      prompt: 'Soft premium UI click confirmation, short clean digital tap',
      src: '/audio/tambourine/ui-click.mp3',
    },
    {
      id: 'cinematic-hit',
      title: 'Cinematic hit',
      meta: 'SFX · Impact',
      prompt: 'Deep cinematic impact hit with short reverb tail, trailer style accent',
      src: '/audio/tambourine/cinematic-hit.mp3',
    },
  ];

  var promptEl = document.getElementById('tambourine-example-prompt');
  var listEl = document.getElementById('tambourine-example-list');
  if (!promptEl || !listEl) return;

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var audio = null;
  var activeId = EXAMPLES[0].id;
  var typeTimer = null;

  function stopTyping() {
    if (typeTimer) {
      window.clearTimeout(typeTimer);
      typeTimer = null;
    }
  }

  function setPromptText(text, animate) {
    stopTyping();
    promptEl.classList.remove('is-done');
    if (!animate || reduceMotion) {
      promptEl.textContent = text;
      promptEl.classList.add('is-done');
      return;
    }
    promptEl.innerHTML = '<span class="tambourine-caret" aria-hidden="true"></span>';
    var caret = promptEl.querySelector('.tambourine-caret');
    var i = 0;
    function tick() {
      if (i >= text.length) {
        promptEl.classList.add('is-done');
        return;
      }
      promptEl.insertBefore(document.createTextNode(text.charAt(i)), caret);
      i += 1;
      var ch = text.charAt(i - 1);
      var delay = ch === '.' || ch === ',' ? 40 : 10 + Math.floor(Math.random() * 12);
      typeTimer = window.setTimeout(tick, delay);
    }
    typeTimer = window.setTimeout(tick, 120);
  }

  function findExample(id) {
    for (var i = 0; i < EXAMPLES.length; i++) {
      if (EXAMPLES[i].id === id) return EXAMPLES[i];
    }
    return null;
  }

  function stopAudio() {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio = null;
    }
    listEl.querySelectorAll('.tambourine-example-row').forEach(function (row) {
      row.classList.remove('is-playing');
      var playIcon = row.querySelector('[data-icon="play"]');
      var stopIcon = row.querySelector('[data-icon="stop"]');
      if (playIcon) playIcon.hidden = false;
      if (stopIcon) stopIcon.hidden = true;
      if (row.getAttribute('data-id') !== activeId) {
        row.setAttribute('aria-pressed', 'false');
      }
    });
  }

  function syncActiveRow() {
    listEl.querySelectorAll('.tambourine-example-row').forEach(function (row) {
      var on = row.getAttribute('data-id') === activeId;
      row.classList.toggle('is-active', on);
      if (!row.classList.contains('is-playing')) {
        row.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    });
  }

  function playExample(ex) {
    stopAudio();
    activeId = ex.id;
    syncActiveRow();

    var btn = listEl.querySelector('[data-id="' + ex.id + '"]');
    if (btn) {
      btn.classList.add('is-playing');
      btn.setAttribute('aria-pressed', 'true');
      var playIcon = btn.querySelector('[data-icon="play"]');
      var stopIcon = btn.querySelector('[data-icon="stop"]');
      if (playIcon) playIcon.hidden = true;
      if (stopIcon) stopIcon.hidden = false;
    }

    audio = new Audio(ex.src);
    audio.addEventListener('ended', stopAudio);
    audio.addEventListener('error', stopAudio);
    var playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        stopAudio();
      });
    }
  }

  function selectExample(id, opts) {
    opts = opts || {};
    var ex = findExample(id);
    if (!ex) return;

    var wasSame = activeId === ex.id;
    activeId = ex.id;
    syncActiveRow();
    setPromptText(ex.prompt, opts.animate !== false);

    if (opts.autoplay) {
      if (wasSame && audio && !audio.paused) {
        stopAudio();
        return;
      }
      playExample(ex);
    }
  }

  listEl.addEventListener('click', function (event) {
    var btn = event.target.closest('.tambourine-example-row');
    if (!btn || !listEl.contains(btn)) return;
    var id = btn.getAttribute('data-id');
    if (!id) return;
    selectExample(id, { animate: true, autoplay: true });
  });

  selectExample(EXAMPLES[0].id, { animate: false, autoplay: false });

  if ('IntersectionObserver' in window) {
    var started = false;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || started) return;
          started = true;
          observer.disconnect();
          setPromptText(EXAMPLES[0].prompt, true);
        });
      },
      { threshold: 0.35 }
    );
    observer.observe(promptEl);
  } else {
    setPromptText(EXAMPLES[0].prompt, true);
  }
})();
