(function () {
  var PHRASE =
    'This is Trillian by Keyweaver. An AI voiceover plugin for After Effects and Premiere.';

  var scriptEl = document.getElementById('trillian-script-text');
  var listEl = document.getElementById('trillian-voice-list');
  if (!scriptEl || !listEl) return;

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var audio = null;
  var activeBtn = null;

  function stopAudio() {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio = null;
    }
    if (activeBtn) {
      activeBtn.classList.remove('is-playing');
      activeBtn.setAttribute('aria-pressed', 'false');
      var playIcon = activeBtn.querySelector('[data-icon="play"]');
      var stopIcon = activeBtn.querySelector('[data-icon="stop"]');
      if (playIcon) playIcon.hidden = false;
      if (stopIcon) stopIcon.hidden = true;
      activeBtn = null;
    }
  }

  function playVoice(btn) {
    var src = btn.getAttribute('data-src');
    if (!src) return;

    if (activeBtn === btn) {
      stopAudio();
      return;
    }

    stopAudio();
    activeBtn = btn;
    btn.classList.add('is-playing');
    btn.setAttribute('aria-pressed', 'true');
    var playIcon = btn.querySelector('[data-icon="play"]');
    var stopIcon = btn.querySelector('[data-icon="stop"]');
    if (playIcon) playIcon.hidden = true;
    if (stopIcon) stopIcon.hidden = false;

    audio = new Audio(src);
    audio.addEventListener('ended', stopAudio);
    audio.addEventListener('error', stopAudio);
    var playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function () {
        stopAudio();
      });
    }
  }

  listEl.addEventListener('click', function (event) {
    var btn = event.target.closest('.trillian-voice-row');
    if (!btn || !listEl.contains(btn)) return;
    playVoice(btn);
  });

  function typePhrase() {
    if (reduceMotion) {
      scriptEl.textContent = PHRASE;
      scriptEl.classList.add('is-done');
      return;
    }

    var i = 0;
    scriptEl.innerHTML = '<span class="trillian-caret" aria-hidden="true"></span>';
    var caret = scriptEl.querySelector('.trillian-caret');

    function tick() {
      if (i >= PHRASE.length) {
        scriptEl.classList.add('is-done');
        return;
      }
      scriptEl.insertBefore(document.createTextNode(PHRASE.charAt(i)), caret);
      i += 1;
      var delay = PHRASE.charAt(i - 1) === '.' ? 220 : 22 + Math.floor(Math.random() * 18);
      window.setTimeout(tick, delay);
    }

    window.setTimeout(tick, 350);
  }

  if ('IntersectionObserver' in window) {
    var started = false;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || started) return;
          started = true;
          observer.disconnect();
          typePhrase();
        });
      },
      { threshold: 0.35 }
    );
    observer.observe(scriptEl);
  } else {
    typePhrase();
  }
})();
