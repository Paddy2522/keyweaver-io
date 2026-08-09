(function () {
  var EXAMPLES = [
    {
      id: 'neon-rain',
      title: 'Neon rain street',
      meta: 'Cinematic b-roll · 16:9',
      prompt:
        'Cinematic night street in the rain, neon reflections on wet asphalt, slow dolly forward through shallow puddles, shallow depth of field, photoreal editorial b-roll, no text, no logos.',
      src: '/video/superconductor/neon-rain.mp4',
      poster: '/video/superconductor/neon-rain.jpg',
    },
    {
      id: 'product-studio',
      title: 'Product studio plate',
      meta: 'Compositing backdrop · 16:9',
      prompt:
        'Empty premium product pedestal in a dark cinematic studio, soft rim light, gentle slow camera orbit, pristine reflective floor with room for a hero product, compositing plate, no text, no logos.',
      src: '/video/superconductor/product-studio.mp4',
      poster: '/video/superconductor/product-studio.jpg',
    },
    {
      id: 'abstract-energy',
      title: 'Abstract energy',
      meta: 'Motion plate · 16:9',
      prompt:
        'Abstract electric blue and violet energy ribbons and particles flowing through deep charcoal space, smooth volumetric light shafts, slow camera push-in, premium motion graphics plate, no text, no logos.',
      src: '/video/superconductor/abstract-energy.mp4',
      poster: '/video/superconductor/abstract-energy.jpg',
    },
    {
      id: 'morning-coffee',
      title: 'Morning coffee steam',
      meta: 'Lifestyle cutaway · 16:9',
      prompt:
        'Close-up of coffee steam rising in warm morning window light, ceramic cup softly out of focus, shallow depth of field, slow subtle camera drift, photoreal lifestyle b-roll, no text, no logos.',
      src: '/video/superconductor/morning-coffee.mp4',
      poster: '/video/superconductor/morning-coffee.jpg',
    },
  ];

  var promptEl = document.getElementById('sc-example-prompt');
  var listEl = document.getElementById('sc-example-list');
  var videoEl = document.getElementById('sc-example-video');
  var playBtn = document.getElementById('sc-example-play');
  if (!promptEl || !listEl || !videoEl || !playBtn) return;

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    promptEl.innerHTML = '<span class="sc-caret" aria-hidden="true"></span>';
    var caret = promptEl.querySelector('.sc-caret');
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

  function syncPlayUi(playing) {
    playBtn.classList.toggle('is-playing', playing);
    playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    playBtn.setAttribute('aria-label', playing ? 'Pause example' : 'Play example');
    var playIcon = playBtn.querySelector('[data-icon="play"]');
    var pauseIcon = playBtn.querySelector('[data-icon="pause"]');
    if (playIcon) playIcon.hidden = !!playing;
    if (pauseIcon) pauseIcon.hidden = !playing;
  }

  function pauseVideo() {
    videoEl.pause();
    syncPlayUi(false);
  }

  function playVideo() {
    var p = videoEl.play();
    syncPlayUi(true);
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        syncPlayUi(false);
      });
    }
  }

  function selectExample(id, opts) {
    opts = opts || {};
    var ex = null;
    for (var i = 0; i < EXAMPLES.length; i++) {
      if (EXAMPLES[i].id === id) {
        ex = EXAMPLES[i];
        break;
      }
    }
    if (!ex) return;

    activeId = ex.id;
    listEl.querySelectorAll('.sc-example-row').forEach(function (row) {
      var on = row.getAttribute('data-id') === ex.id;
      row.classList.toggle('is-active', on);
      row.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    setPromptText(ex.prompt, opts.animate !== false);

    var wasPlaying = !videoEl.paused && !videoEl.ended;
    var nextSrc = ex.src;
    if (videoEl.getAttribute('src') !== nextSrc) {
      videoEl.setAttribute('src', nextSrc);
      if (ex.poster) videoEl.setAttribute('poster', ex.poster);
      videoEl.load();
    }

    if (opts.autoplay || wasPlaying) {
      playVideo();
    } else {
      pauseVideo();
      try {
        videoEl.currentTime = 0;
      } catch (e) {}
    }
  }

  listEl.addEventListener('click', function (event) {
    var btn = event.target.closest('.sc-example-row');
    if (!btn || !listEl.contains(btn)) return;
    var id = btn.getAttribute('data-id');
    if (!id) return;
    selectExample(id, { animate: true, autoplay: true });
  });

  playBtn.addEventListener('click', function () {
    if (videoEl.paused) playVideo();
    else pauseVideo();
  });

  videoEl.addEventListener('click', function () {
    if (videoEl.paused) playVideo();
    else pauseVideo();
  });

  videoEl.addEventListener('ended', function () {
    syncPlayUi(false);
    try {
      videoEl.currentTime = 0;
    } catch (e) {}
  });
  videoEl.addEventListener('pause', function () {
    if (!videoEl.ended) syncPlayUi(false);
  });
  videoEl.addEventListener('play', function () {
    syncPlayUi(true);
  });

  // Build rows if empty (markup may already include them)
  if (!listEl.children.length) {
    EXAMPLES.forEach(function (ex) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sc-example-row';
      btn.setAttribute('data-id', ex.id);
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML =
        '<span class="sc-example-play" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
        '</span>' +
        '<span class="sc-example-copy">' +
        '<span class="sc-example-name"></span>' +
        '<span class="sc-example-meta"></span>' +
        '</span>';
      btn.querySelector('.sc-example-name').textContent = ex.title;
      btn.querySelector('.sc-example-meta').textContent = ex.meta;
      listEl.appendChild(btn);
    });
  }

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
