(function () {
  'use strict';

  var Auth = window.KeyweaverToolsAuth;
  var BACKEND = (Auth && Auth.BACKEND) || 'https://keyweaver-backend.vercel.app';
  var LABELS = {
    image: 'Image',
    video: 'Video',
    music: 'Music',
    sfx: 'Sound effects',
    model3d: '3D model'
  };
  var VIDEO_CREDITS = { '4': 25, '5': 30, '8': 45 };
  var MUSIC_GENRES = [
    'Ambient', 'Electronic', 'Hip Hop', 'Pop', 'Rock', 'Cinematic',
    'Corporate', 'Lo-fi', 'Jazz', 'Classical', 'R&B', 'Dance'
  ];
  var MUSIC_MOODS = [
    'Upbeat', 'Calm', 'Dark', 'Epic', 'Happy', 'Melancholic',
    'Dreamy', 'Energetic', 'Mysterious', 'Inspiring'
  ];

  var kind = 'image';
  var creditsRemaining = null;
  var lastObjectUrl = '';
  var musicGenre = '';
  var musicMood = '';

  function $(id) {
    return document.getElementById(id);
  }

  function getToken() {
    if (Auth && Auth.getToken) return Auth.getToken();
    try { return localStorage.getItem('cc_token') || ''; } catch (e) { return ''; }
  }

  function loginHref() {
    return '/signup?next=/create';
  }

  function setError(msg, ok) {
    var el = $('create-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-ok', !!ok && !!msg);
  }

  function currentCost() {
    if (kind === 'image') return 4;
    if (kind === 'model3d') return 12;
    if (kind === 'video') {
      var vd = ($('create-video-duration') && $('create-video-duration').value) || '4';
      return VIDEO_CREDITS[vd] || 25;
    }
    if (kind === 'music') {
      var ms = Number(($('create-music-duration') && $('create-music-duration').value) || 10);
      return Math.max(5, Math.ceil(ms / 10) * 5);
    }
    if (kind === 'sfx') {
      var ss = Number(($('create-sfx-duration') && $('create-sfx-duration').value) || 2);
      return Math.max(3, Math.ceil(ss * 2));
    }
    return 4;
  }

  function buildMusicPrompt(base) {
    var bits = [];
    if (musicGenre) bits.push(musicGenre + ' genre');
    if (musicMood) bits.push(musicMood.toLowerCase() + ' mood');
    if (!bits.length) return base;
    return base + '. Style: ' + bits.join(', ') + '.';
  }

  function buildVideoPrompt(base) {
    var dialogue = $('create-video-dialogue');
    if (dialogue && dialogue.checked) {
      return base +
        ' Include clear spoken dialogue or voiceover that matches the scene (lip-synced where a face is visible).';
    }
    return base;
  }

  function fillChips(hostId, items, getSelected, setSelected) {
    var host = $(hostId);
    if (!host) return;
    host.innerHTML = '';
    items.forEach(function (label) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'create-chip' + (getSelected() === label ? ' is-on' : '');
      btn.textContent = label;
      btn.addEventListener('click', function () {
        setSelected(getSelected() === label ? '' : label);
        fillChips(hostId, items, getSelected, setSelected);
        syncKinds();
      });
      host.appendChild(btn);
    });
  }

  function syncKinds() {
    document.querySelectorAll('.create-kind').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-kind') === kind);
      btn.setAttribute('aria-pressed', btn.getAttribute('data-kind') === kind ? 'true' : 'false');
    });

    var cost = $('create-cost');
    if (cost) {
      cost.textContent = currentCost() + ' credits · ' + LABELS[kind];
    }

    var aspectWrap = $('create-aspect-wrap');
    if (aspectWrap) aspectWrap.hidden = kind === 'music' || kind === 'sfx' || kind === 'model3d';

    var videoOpts = $('create-video-opts');
    if (videoOpts) videoOpts.hidden = kind !== 'video';
    var musicOpts = $('create-music-opts');
    if (musicOpts) musicOpts.hidden = kind !== 'music';
    var sfxOpts = $('create-sfx-opts');
    if (sfxOpts) sfxOpts.hidden = kind !== 'sfx';

    var refWrap = $('create-ref-wrap');
    var refInput = $('create-reference');
    var refNote = $('create-ref-note');
    var refLabel = $('create-ref-label');
    var allowRef = kind === 'image' || kind === 'video' || kind === 'model3d';
    if (refWrap) refWrap.hidden = !allowRef;
    if (!allowRef && refInput) refInput.value = '';
    if (refLabel) {
      refLabel.textContent =
        kind === 'video' ? 'Reference still (optional)' :
        kind === 'model3d' ? 'Reference image for 3D (optional)' :
        'Reference image (optional)';
    }
    if (refNote) {
      refNote.textContent =
        kind === 'video'
          ? 'Optional still to animate (image-to-video). PNG, JPEG, or WebP, max 8 MB.'
          : kind === 'model3d'
            ? 'Optional still for image-to-3D. Without one we use text-to-3D.'
            : 'Optional PNG, JPEG, or WebP (max 8 MB).';
    }

    var prompt = $('create-prompt');
    if (prompt && !prompt.value) {
      prompt.placeholder =
        kind === 'music'
          ? 'Upbeat lo-fi bed for a product unboxing, soft vinyl crackle, no vocals.'
          : kind === 'sfx'
            ? 'Short whoosh into a soft UI click, clean and modern.'
            : kind === 'video'
              ? 'A handheld night shot of a neon noodle stall in the rain, shallow depth of field.'
              : kind === 'model3d'
                ? 'A low-poly game-ready lamp, clean topology, matte ceramic.'
                : 'A handheld night shot of a neon noodle stall in the rain, shallow depth of field, film grain.';
    }
  }

  function openModal(id) {
    var dlg = $(id);
    if (dlg && dlg.showModal) dlg.showModal();
  }

  function closeModal(id) {
    var dlg = $(id);
    if (dlg && dlg.open) dlg.close();
  }

  function updateBalance(n) {
    creditsRemaining = n;
    var el = $('create-balance');
    if (el) {
      if (!getToken()) {
        el.textContent = 'Sign up free for 60 credits. Verify your email, then generate here.';
      } else if (n == null) {
        el.textContent = 'Checking your credits…';
      } else {
        el.textContent = n + ' credits left on this account.';
      }
    }
    if (getToken() && n != null && isFinite(n)) {
      var navBals = document.querySelectorAll('.nav-credit-balance');
      for (var i = 0; i < navBals.length; i++) {
        navBals[i].textContent = n === 1 ? '1 credit' : Math.floor(n) + ' credits';
      }
    }
  }

  function loadCredits() {
    var token = getToken();
    if (!token) {
      updateBalance(null);
      return;
    }
    fetch(BACKEND + '/api/captio/credits', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (res) { return res.json().then(function (body) { return { res: res, body: body }; }); })
      .then(function (x) {
        if (!x.res.ok) {
          updateBalance(null);
          return;
        }
        updateBalance(Number(x.body.credits_remaining || 0));
      })
      .catch(function () { updateBalance(null); });
  }

  function revokePreview() {
    if (lastObjectUrl) {
      URL.revokeObjectURL(lastObjectUrl);
      lastObjectUrl = '';
    }
  }

  function attachMedia(host, el) {
    host.appendChild(el);
  }

  /** fal URLs often block hotlink playback — proxy through our download route for preview. */
  function previewRemoteMedia(host, result, tagName) {
    var loading = document.createElement('p');
    loading.className = 'create-hint';
    loading.textContent = 'Loading preview…';
    host.appendChild(loading);

    fetch(BACKEND + '/api/prompt-lab/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + getToken()
      },
      body: JSON.stringify({ url: result.url, filename: result.filename || 'preview' })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('preview');
        return res.blob();
      })
      .then(function (blob) {
        revokePreview();
        lastObjectUrl = URL.createObjectURL(blob);
        host._blob = blob;
        host.innerHTML = '';
        var el = document.createElement(tagName);
        if (tagName === 'video') {
          el.controls = true;
          el.playsInline = true;
          el.preload = 'metadata';
        } else {
          el.alt = 'Generated image';
        }
        el.src = lastObjectUrl;
        attachMedia(host, el);
      })
      .catch(function () {
        host.innerHTML = '';
        var el = document.createElement(tagName);
        if (tagName === 'video') {
          el.controls = true;
          el.playsInline = true;
          el.preload = 'metadata';
        } else {
          el.alt = 'Generated image';
        }
        el.src = result.url;
        el.addEventListener('error', function () {
          host.innerHTML = '';
          var card = document.createElement('div');
          card.className = 'create-model-card';
          card.innerHTML = '<strong>File ready</strong><p class="create-hint">Preview blocked by the file host — use Download.</p>';
          host.appendChild(card);
        });
        attachMedia(host, el);
      });
  }

  function showPreview(result) {
    var host = $('create-preview');
    if (!host) return;
    revokePreview();
    host.innerHTML = '';
    var download = $('create-download');
    if (download) download.hidden = false;

    if (result.base64) {
      var binary = atob(result.base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var blob = new Blob([bytes], { type: result.mime || 'audio/mpeg' });
      lastObjectUrl = URL.createObjectURL(blob);
      var audio = document.createElement('audio');
      audio.controls = true;
      audio.src = lastObjectUrl;
      host.appendChild(audio);
      host._blob = blob;
      host._filename = result.filename;
      host._remote = '';
      return;
    }

    host._blob = null;
    host._filename = result.filename;
    host._remote = result.url || '';

    if (result.kind === 'model3d' || /\.(glb|gltf|obj|fbx|usdz)(\?|$)/i.test(String(result.url || result.filename || ''))) {
      var card = document.createElement('div');
      card.className = 'create-model-card';
      card.innerHTML = '<strong>3D model ready</strong><p class="create-hint">Download the file and open it in Blender, After Effects, or a game engine.</p>';
      host.appendChild(card);
      return;
    }

    if (result.kind === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(String(result.url || result.filename || ''))) {
      previewRemoteMedia(host, result, 'video');
      return;
    }

    if (result.url) {
      previewRemoteMedia(host, result, 'img');
      return;
    }

    var empty = document.createElement('p');
    empty.className = 'create-empty';
    empty.textContent = 'File ready — use Download.';
    host.appendChild(empty);
  }

  function downloadResult() {
    var host = $('create-preview');
    if (!host) return;
    var name = host._filename || 'keyweaver-file';
    if (host._blob) {
      var a = document.createElement('a');
      a.href = lastObjectUrl || URL.createObjectURL(host._blob);
      a.download = name;
      a.click();
      return;
    }
    if (!host._remote) return;
    var btn = $('create-download');
    if (btn) btn.disabled = true;
    fetch(BACKEND + '/api/prompt-lab/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + getToken()
      },
      body: JSON.stringify({ url: host._remote, filename: name })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('download');
        return res.blob();
      })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      })
      .catch(function () {
        window.open(host._remote, '_blank', 'noopener');
      })
      .then(function () {
        if (btn) btn.disabled = false;
      });
  }

  function finishGenerate(btn) {
    btn.disabled = false;
    btn.textContent = 'Generate';
    if (window.CuemarkTurnstile) CuemarkTurnstile.reset('create-turnstile');
  }

  function handleAuthPaywall(res, data) {
    if (res.status === 401) {
      openModal('create-signup-modal');
      return true;
    }
    if (res.status === 402) {
      if (data && data.credits_remaining != null) updateBalance(Number(data.credits_remaining));
      openModal('create-pay-modal');
      return true;
    }
    return false;
  }

  function pollJob(requestId, modelId, jobKind, btn, creditsCharged) {
    var started = Date.now();
    var maxMs = jobKind === 'video' ? 10 * 60 * 1000 : 12 * 60 * 1000;
    var attempt = 0;
    var label = jobKind === 'video' ? 'Video' : '3D';

    function tick() {
      if (Date.now() - started > maxMs) {
        finishGenerate(btn);
        setError(label + ' is still running. Stay on this page a bit longer, or try again — failed jobs refund credits.');
        return;
      }
      attempt += 1;
      var secs = Math.max(1, Math.round((Date.now() - started) / 1000));
      btn.textContent = 'Building ' + label + '\u2026 (' + secs + 's)';
      setError(
        jobKind === 'video'
          ? 'Rendering on the GPU queue — usually 1–3 minutes. Stay on this page.'
          : 'Building the model — often 2–5 minutes. Stay on this page.',
        true
      );

      fetch(BACKEND + '/api/prompt-lab/job', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + getToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          request_id: requestId,
          model_id: modelId,
          kind: jobKind,
          credits_charged: creditsCharged
        })
      })
        .then(function (res) {
          return res.json().then(function (data) { return { res: res, data: data }; }).catch(function () {
            return { res: res, data: null };
          });
        })
        .then(function (x) {
          if (handleAuthPaywall(x.res, x.data)) {
            finishGenerate(btn);
            return;
          }
          if (x.data && x.data.pending) {
            setTimeout(tick, attempt < 8 ? 2500 : 4500);
            return;
          }
          finishGenerate(btn);
          if (!x.res.ok || !x.data || !x.data.url) {
            setError((x.data && x.data.error) || label + ' failed. Credits refunded if the job failed.');
            loadCredits();
            return;
          }
          showPreview(x.data);
          if (x.data.credits_remaining != null) updateBalance(Number(x.data.credits_remaining));
          setError('Done · ' + (x.data.credits_charged || creditsCharged) + ' credits used.', true);
          loadCredits();
        })
        .catch(function () {
          setTimeout(tick, 4000);
        });
    }

    setTimeout(tick, 2000);
  }

  function generate() {
    var promptRaw = ($('create-prompt').value || '').trim();
    if (promptRaw.length < 8) {
      setError('Add a prompt (at least a short sentence).');
      $('create-prompt').focus();
      return;
    }
    if (!getToken()) {
      openModal('create-signup-modal');
      return;
    }
    var cost = currentCost();
    if (creditsRemaining != null && creditsRemaining < cost) {
      openModal('create-pay-modal');
      return;
    }

    var prompt = promptRaw;
    if (kind === 'music') prompt = buildMusicPrompt(promptRaw);
    if (kind === 'video') prompt = buildVideoPrompt(promptRaw);

    var btn = $('create-generate');
    btn.disabled = true;
    btn.textContent =
      kind === 'model3d' ? 'Starting 3D\u2026' :
      kind === 'video' ? 'Queuing video\u2026' :
      'Generating\u2026';
    setError(
      kind === 'model3d' || kind === 'video'
        ? 'Queued — we\u2019ll keep this page updated until it finishes.'
        : '',
      true
    );

    var body = new FormData();
    body.append('kind', kind);
    body.append('prompt', prompt);
    body.append('aspect', ($('create-aspect') && $('create-aspect').value) || '16:9');

    if (kind === 'video') {
      body.append('duration', ($('create-video-duration') && $('create-video-duration').value) || '4');
      body.append('generate_audio', '1');
    }
    if (kind === 'music') {
      body.append('duration_sec', ($('create-music-duration') && $('create-music-duration').value) || '10');
      body.append(
        'instrumental',
        ($('create-music-instrumental') && $('create-music-instrumental').checked) ? '1' : '0'
      );
    }
    if (kind === 'sfx') {
      body.append('duration_sec', ($('create-sfx-duration') && $('create-sfx-duration').value) || '2');
    }

    var allowRef = kind === 'image' || kind === 'video' || kind === 'model3d';
    var file = allowRef && $('create-reference') && $('create-reference').files && $('create-reference').files[0];
    if (file) body.append('reference', file);

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutMs = kind === 'model3d' || kind === 'video' ? 90000 : 150000;
    var timer = controller
      ? setTimeout(function () { try { controller.abort(); } catch (e) {} }, timeoutMs)
      : null;

    var run = function (token) {
      if (token) body.set('turnstile_token', token);
      fetch(BACKEND + '/api/prompt-lab/generate', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + getToken() },
        body: body,
        signal: controller ? controller.signal : undefined
      })
        .then(function (res) {
          return res.json().then(function (data) { return { res: res, data: data }; }).catch(function () {
            return { res: res, data: null };
          });
        })
        .then(function (x) {
          if (timer) clearTimeout(timer);
          if (window.CuemarkTurnstile) CuemarkTurnstile.reset('create-turnstile');
          if (handleAuthPaywall(x.res, x.data)) {
            finishGenerate(btn);
            return;
          }
          if (!x.res.ok || !x.data) {
            finishGenerate(btn);
            setError((x.data && x.data.error) || 'Generate failed. Credits refunded if it failed.');
            return;
          }
          if (x.data.credits_remaining != null) updateBalance(Number(x.data.credits_remaining));

          if (x.data.pending && x.data.request_id && x.data.model_id) {
            pollJob(
              x.data.request_id,
              x.data.model_id,
              x.data.kind === 'video' ? 'video' : 'model3d',
              btn,
              x.data.credits_charged || cost
            );
            return;
          }

          finishGenerate(btn);
          if (!x.data.url && !x.data.base64) {
            setError((x.data && x.data.error) || 'Generate failed. Credits refunded if it failed.');
            return;
          }
          showPreview(x.data);
          setError('Done · ' + x.data.credits_charged + ' credits used.', true);
        })
        .catch(function (err) {
          if (timer) clearTimeout(timer);
          finishGenerate(btn);
          if (err && err.name === 'AbortError') {
            setError('That took too long. Try again — shorter prompts usually finish faster.');
            return;
          }
          setError('Could not reach the server. Try again.');
        });
    };

    if (window.CuemarkTurnstile && CuemarkTurnstile.enabled && CuemarkTurnstile.enabled()) {
      CuemarkTurnstile.requireToken('create-turnstile').then(run).catch(function (err) {
        if (timer) clearTimeout(timer);
        finishGenerate(btn);
        setError((err && err.message) || 'Complete the security check, then try again.');
      });
    } else {
      run('');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    fillChips(
      'create-music-genres',
      MUSIC_GENRES,
      function () { return musicGenre; },
      function (v) { musicGenre = v; }
    );
    fillChips(
      'create-music-moods',
      MUSIC_MOODS,
      function () { return musicMood; },
      function (v) { musicMood = v; }
    );

    document.querySelectorAll('.create-kind').forEach(function (btn) {
      btn.addEventListener('click', function () {
        kind = btn.getAttribute('data-kind') || 'image';
        syncKinds();
      });
    });
    ;['create-video-duration', 'create-music-duration', 'create-sfx-duration'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', syncKinds);
    });
    syncKinds();
    loadCredits();

    if (window.CuemarkTurnstile) {
      CuemarkTurnstile.prepare('create-turnstile-wrap', 'create-turnstile').catch(function () {});
    }

    $('create-generate').addEventListener('click', generate);
    $('create-download').addEventListener('click', downloadResult);
    document.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { closeModal(btn.getAttribute('data-close')); });
    });
    var signup = $('create-signup-go');
    if (signup) signup.href = loginHref();
  });
})();
