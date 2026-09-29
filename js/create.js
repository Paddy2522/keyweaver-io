(function () {
  'use strict';

  var Auth = window.KeyweaverToolsAuth;
  var BACKEND = (Auth && Auth.BACKEND) || 'https://keyweaver-backend.vercel.app';
  var LABELS = {
    image: 'Image',
    video: 'Video',
    music: 'Music',
    sfx: 'Sound effects',
    voice: 'Voiceover',
    model3d: '3D model'
  };
  var VIDEO_CREDITS_720 = { '4': 25, '5': 30, '8': 45 };
  var VOICES = [
    { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel · American · female' },
    { id: '29vD33N1CtxCimIQ48CI', label: 'Drew · American · male' },
    { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah · American · female' },
    { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni · American · male' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli · American · female' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh · American · male' },
    { id: 'LcfcDJNUP1GQjkzn1xUU', label: 'Emily · American · female' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam · American · male' }
  ];
  var MUSIC_GENRES = [
    'Ambient', 'Electronic', 'Hip Hop', 'Pop', 'Rock', 'Cinematic',
    'Corporate', 'Lo-fi', 'Jazz', 'Classical', 'R&B', 'Dance'
  ];
  var MUSIC_MOODS = [
    'Upbeat', 'Calm', 'Dark', 'Epic', 'Happy', 'Melancholic',
    'Dreamy', 'Energetic', 'Mysterious', 'Inspiring'
  ];
  var MUSIC_THEMES = [
    'Corporate', 'Travel', 'Tech', 'Nature', 'Sports', 'Fashion',
    'Gaming', 'Documentary', 'Social media', 'Product demo'
  ];
  var MUSIC_INSTRUMENTS = [
    'Piano', 'Acoustic guitar', 'Electric guitar', 'Synth', 'Drums',
    'Bass', 'Strings', 'Pads', 'Percussion', 'Violin'
  ];

  var kind = 'image';
  var creditsRemaining = null;
  var lastObjectUrl = '';
  var musicGenre = '';
  var musicMood = '';
  var musicTheme = '';
  var musicInstrument = '';
  var promptsByKind = {
    image: '',
    video: '',
    music: '',
    sfx: '',
    voice: '',
    model3d: ''
  };
  var PENDING_KEY = 'keyweaver.create.pendingJob';
  var RESULT_KEY = 'keyweaver.create.lastResult';
  var activePoll = false;
  var pixelAnim = null;

  function stopPixelAnim() {
    if (pixelAnim) {
      cancelAnimationFrame(pixelAnim);
      pixelAnim = null;
    }
  }

  function showGeneratingVisual(statusText) {
    var host = $('create-preview');
    if (!host) return;
    stopPixelAnim();
    revokePreview();
    host.innerHTML = '';
    var download = $('create-download');
    if (download) download.hidden = true;

    var wrap = document.createElement('div');
    wrap.className = 'create-gen-visual';
    wrap.setAttribute('aria-live', 'polite');
    var canvas = document.createElement('canvas');
    canvas.className = 'create-pixel-canvas';
    canvas.width = 56;
    canvas.height = 32;
    canvas.setAttribute('aria-hidden', 'true');
    var status = document.createElement('p');
    status.className = 'create-gen-status';
    status.id = 'create-gen-status';
    status.textContent = statusText || 'Generating\u2026';
    wrap.appendChild(canvas);
    wrap.appendChild(status);
    host.appendChild(wrap);

    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var cols = 28;
    var rows = 16;
    var cellW = canvas.width / cols;
    var cellH = canvas.height / rows;
    var t0 = performance.now();

    function frame(now) {
      var t = (now - t0) / 1000;
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var n =
            Math.sin(x * 0.55 + t * 2.4) * 0.5 +
            Math.cos(y * 0.7 - t * 1.8) * 0.5 +
            Math.sin((x + y) * 0.35 + t * 3.1) * 0.35;
          var v = (n + 1.2) / 2.4;
          if (v < 0.28) continue;
          var a = Math.min(1, (v - 0.28) * 1.6);
          var pulse = 0.55 + 0.45 * Math.sin(t * 4 + x * 0.2 + y * 0.15);
          ctx.fillStyle =
            'rgba(120, 140, 255,' + (a * pulse * 0.95).toFixed(3) + ')';
          ctx.fillRect(x * cellW + 0.4, y * cellH + 0.4, cellW - 0.8, cellH - 0.8);
        }
      }
      pixelAnim = requestAnimationFrame(frame);
    }
    pixelAnim = requestAnimationFrame(frame);
  }

  function updateGeneratingStatus(text) {
    var el = $('create-gen-status');
    if (el) el.textContent = text;
  }

  function savePendingJob(job) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(job));
    } catch (e) {}
  }

  function clearPendingJob() {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch (e) {}
  }

  function loadPendingJob() {
    try {
      var raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      var job = JSON.parse(raw);
      if (!job || !job.request_id || !job.model_id) return null;
      var age = Date.now() - Number(job.started_at || 0);
      if (!job.started_at || age > 20 * 60 * 1000) {
        clearPendingJob();
        return null;
      }
      return job;
    } catch (e) {
      return null;
    }
  }

  function saveLastResult(result) {
    try {
      if (!result) return;
      localStorage.setItem(
        RESULT_KEY,
        JSON.stringify({
          kind: result.kind,
          mime: result.mime,
          filename: result.filename,
          url: result.url || null,
          base64: result.base64 || null,
          credits_charged: result.credits_charged,
          saved_at: Date.now()
        })
      );
    } catch (e) {}
  }

  function clearLastResult() {
    try {
      localStorage.removeItem(RESULT_KEY);
    } catch (e) {}
  }

  function loadLastResult() {
    try {
      var raw = localStorage.getItem(RESULT_KEY);
      if (!raw) return null;
      var result = JSON.parse(raw);
      if (!result || (!result.url && !result.base64)) return null;
      if (Date.now() - Number(result.saved_at || 0) > 2 * 60 * 60 * 1000) {
        clearLastResult();
        return null;
      }
      return result;
    } catch (e) {
      return null;
    }
  }

  function saveCurrentPrompt() {
    var el = $('create-prompt');
    if (!el) return;
    promptsByKind[kind] = el.value;
  }

  function restorePromptForKind(nextKind) {
    var el = $('create-prompt');
    if (!el) return;
    el.value = promptsByKind[nextKind] || '';
  }

  function switchKind(nextKind) {
    var next = nextKind || 'image';
    if (next === kind) {
      syncKinds();
      return;
    }
    saveCurrentPrompt();
    kind = next;
    restorePromptForKind(kind);
    syncKinds();
  }

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

  function videoCredits(duration, resolution, tier) {
    var base = VIDEO_CREDITS_720[duration] || 25;
    var atRes = resolution === '480p' ? Math.max(15, Math.round(base * 0.7)) : base;
    if (tier === 'draft') return Math.max(10, Math.round(atRes * 0.5));
    return atRes;
  }

  function currentVideoTier() {
    return ($('create-video-tier') && $('create-video-tier').value) || 'draft';
  }

  function currentCost() {
    if (kind === 'image') return 4;
    if (kind === 'model3d') return 12;
    if (kind === 'video') {
      var vd = ($('create-video-duration') && $('create-video-duration').value) || '4';
      var vr = ($('create-video-resolution') && $('create-video-resolution').value) || '480p';
      return videoCredits(vd, vr, currentVideoTier());
    }
    if (kind === 'music') {
      var ms = Number(($('create-music-duration') && $('create-music-duration').value) || 10);
      return Math.max(5, Math.ceil(ms / 10) * 5);
    }
    if (kind === 'sfx') {
      var ss = Number(($('create-sfx-duration') && $('create-sfx-duration').value) || 2);
      return Math.max(3, Math.ceil(ss * 2));
    }
    if (kind === 'voice') {
      var text = ($('create-prompt') && $('create-prompt').value || '').trim();
      if (!text) return 3;
      return Math.max(3, Math.ceil(text.length / 200));
    }
    return 4;
  }

  function refreshVideoDurationLabels() {
    var sel = $('create-video-duration');
    var res = ($('create-video-resolution') && $('create-video-resolution').value) || '480p';
    var tier = currentVideoTier();
    if (!sel) return;
    Array.prototype.forEach.call(sel.options, function (opt) {
      opt.textContent = opt.value + ' seconds · ' + videoCredits(opt.value, res, tier) + ' credits';
    });
  }

  function buildMusicPrompt(base) {
    var bits = [];
    if (musicGenre) bits.push(musicGenre + ' genre');
    if (musicMood) bits.push(musicMood.toLowerCase() + ' mood');
    if (musicTheme) bits.push(musicTheme.toLowerCase() + ' theme');
    if (musicInstrument) bits.push(musicInstrument.toLowerCase() + ' featured');
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
    if (aspectWrap) aspectWrap.hidden = kind === 'music' || kind === 'sfx' || kind === 'voice' || kind === 'model3d';

    var videoOpts = $('create-video-opts');
    if (videoOpts) videoOpts.hidden = kind !== 'video';
    var musicOpts = $('create-music-opts');
    if (musicOpts) musicOpts.hidden = kind !== 'music';
    var sfxOpts = $('create-sfx-opts');
    if (sfxOpts) sfxOpts.hidden = kind !== 'sfx';
    var voiceOpts = $('create-voice-opts');
    if (voiceOpts) voiceOpts.hidden = kind !== 'voice';
    if (kind === 'video') refreshVideoDurationLabels();

    var voiceHint = $('create-voice-cost-hint');
    if (voiceHint && kind === 'voice') {
      var chars = ($('create-prompt') && $('create-prompt').value || '').trim().length;
      voiceHint.textContent =
        (chars ? chars + ' characters · ' : '') +
        currentCost() +
        ' credits (3 minimum · ~200 characters per credit).';
    }

    var promptLabel = document.querySelector('label[for="create-prompt"]');
    if (promptLabel) promptLabel.textContent = kind === 'voice' ? 'Script' : 'Prompt';

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
    if (prompt) {
      prompt.placeholder =
        kind === 'music'
          ? 'Upbeat lo-fi bed for a product unboxing, soft vinyl crackle, no vocals.'
          : kind === 'sfx'
            ? 'Short whoosh into a soft UI click, clean and modern.'
            : kind === 'voice'
              ? 'Welcome back. Today I am walking you through three simple edits that make your cuts feel sharper.'
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
    stopPixelAnim();
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
      var isObj = /\.obj(\?|$)/i.test(String(result.url || result.filename || ''));
      if (isObj) {
        var objCard = document.createElement('div');
        objCard.className = 'create-model-card';
        objCard.innerHTML =
          '<strong>3D model ready</strong><p class="create-hint">OBJ download — open in Blender or a DCC app (browser preview needs GLB).</p>';
        host.appendChild(objCard);
        return;
      }

      var loading3d = document.createElement('p');
      loading3d.className = 'create-hint';
      loading3d.textContent = 'Loading 3D preview\u2026';
      host.appendChild(loading3d);

      fetch(BACKEND + '/api/prompt-lab/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getToken()
        },
        body: JSON.stringify({ url: result.url, filename: result.filename || 'model.glb' })
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
          if (customElements.get('model-viewer') || window.customElements) {
            var viewer = document.createElement('model-viewer');
            viewer.setAttribute('src', lastObjectUrl);
            viewer.setAttribute('camera-controls', '');
            viewer.setAttribute('touch-action', 'pan-y');
            viewer.setAttribute('auto-rotate', '');
            viewer.setAttribute('shadow-intensity', '0.6');
            viewer.style.width = '100%';
            viewer.style.height = '320px';
            host.appendChild(viewer);
            var note = document.createElement('p');
            note.className = 'create-hint';
            note.textContent = 'Drag to orbit. Download GLB for Blender, AE, or a game engine.';
            host.appendChild(note);
          } else {
            var card = document.createElement('div');
            card.className = 'create-model-card';
            card.innerHTML = '<strong>3D model ready</strong><p class="create-hint">Download the GLB and open it in Blender, After Effects, or a game engine.</p>';
            host.appendChild(card);
          }
        })
        .catch(function () {
          host.innerHTML = '';
          var card = document.createElement('div');
          card.className = 'create-model-card';
          card.innerHTML = '<strong>3D model ready</strong><p class="create-hint">Preview unavailable — use Download.</p>';
          host.appendChild(card);
        });
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
    stopPixelAnim();
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

  function pollJob(requestId, modelId, jobKind, btn, creditsCharged, startedAt) {
    var started = Number(startedAt) || Date.now();
    var maxMs = jobKind === 'video' ? 10 * 60 * 1000 : 12 * 60 * 1000;
    var attempt = 0;
    var label = jobKind === 'video' ? 'Video' : '3D';
    var typical = jobKind === 'video' ? 'Draft often under a minute' : 'usually 2–5 min';
    activePoll = true;

    savePendingJob({
      request_id: requestId,
      model_id: modelId,
      kind: jobKind,
      credits_charged: creditsCharged,
      started_at: started
    });

    if (btn) {
      btn.disabled = true;
    }

    showGeneratingVisual(
      jobKind === 'video'
        ? 'Rendering video pixels\u2026'
        : 'Building 3D mesh\u2026'
    );

    function tick() {
      if (Date.now() - started > maxMs) {
        activePoll = false;
        // Keep pending so a refresh can try again while fal may still finish.
        finishGenerate(btn);
        updateGeneratingStatus('Still running — refresh to keep checking.');
        setError(
          label +
            ' is taking longer than usual. Refresh this page to keep checking — your credits stay with this job until it finishes or fails (failed jobs refund).',
          true
        );
        return;
      }
      attempt += 1;
      var secs = Math.max(1, Math.round((Date.now() - started) / 1000));
      if (btn) btn.textContent = 'Building ' + label + '\u2026 ' + secs + 's';
      updateGeneratingStatus(
        label + ' in progress · ' + secs + 's · ' + typical
      );
      setError(
        'In the provider queue (' +
          typical +
          '). Elapsed ' +
          secs +
          's — safe to refresh; we\u2019ll resume automatically.',
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
            activePoll = false;
            clearPendingJob();
            finishGenerate(btn);
            return;
          }
          if (x.data && x.data.pending) {
            // Snappier early polls so Draft finishes feel closer to fal.ai.
            var delay = attempt < 12 ? 900 : attempt < 30 ? 1600 : 3200;
            setTimeout(tick, delay);
            return;
          }
          activePoll = false;
          finishGenerate(btn);
          if (!x.res.ok || !x.data || !x.data.url) {
            clearPendingJob();
            setError((x.data && x.data.error) || label + ' failed. Credits refunded if the job failed.');
            loadCredits();
            return;
          }
          clearPendingJob();
          saveLastResult(x.data);
          showPreview(x.data);
          if (x.data.credits_remaining != null) updateBalance(Number(x.data.credits_remaining));
          setError('Done · ' + (x.data.credits_charged || creditsCharged) + ' credits used.', true);
          loadCredits();
        })
        .catch(function () {
          setTimeout(tick, 2500);
        });
    }

    setTimeout(tick, 600);
  }

  function resumePendingJobIfAny() {
    if (activePoll || !getToken()) return false;
    var job = loadPendingJob();
    if (!job) return false;
    var btn = $('create-generate');
    var jobKind = job.kind === 'video' ? 'video' : 'model3d';
    kind = jobKind;
    syncKinds();
    setError('Resuming your ' + (jobKind === 'video' ? 'video' : '3D') + ' job\u2026', true);
    pollJob(
      job.request_id,
      job.model_id,
      jobKind,
      btn,
      job.credits_charged || (jobKind === 'video' ? 18 : 12),
      job.started_at
    );
    return true;
  }

  function generate() {
    if (activePoll || loadPendingJob()) {
      if (!activePoll) resumePendingJobIfAny();
      else setError('Your previous generate is still running — wait or refresh; it will resume.', true);
      return;
    }

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
    showGeneratingVisual(
      kind === 'video' ? 'Queuing video\u2026' :
      kind === 'model3d' ? 'Starting 3D\u2026' :
      'Generating\u2026'
    );
    setError(
      kind === 'model3d' || kind === 'video'
        ? 'Queued — safe to refresh; we\u2019ll keep this job and resume when you come back.'
        : '',
      true
    );

    var body = new FormData();
    body.append('kind', kind);
    body.append('prompt', prompt);
    body.append('aspect', ($('create-aspect') && $('create-aspect').value) || '16:9');

    if (kind === 'video') {
      body.append('duration', ($('create-video-duration') && $('create-video-duration').value) || '4');
      body.append('resolution', ($('create-video-resolution') && $('create-video-resolution').value) || '480p');
      body.append('video_tier', currentVideoTier());
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
    if (kind === 'voice') {
      body.append('voice_id', ($('create-voice-id') && $('create-voice-id').value) || VOICES[0].id);
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
            if (x.data && x.data.blocked) {
              setError(x.data.error || 'That prompt is blocked by our safety policy.');
              return;
            }
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
              x.data.credits_charged || cost,
              Date.now()
            );
            return;
          }

          finishGenerate(btn);
          if (!x.data.url && !x.data.base64) {
            setError((x.data && x.data.error) || 'Generate failed. Credits refunded if it failed.');
            return;
          }
          clearPendingJob();
          saveLastResult(x.data);
          showPreview(x.data);
          setError('Done · ' + x.data.credits_charged + ' credits used.', true);
        })
        .catch(function (err) {
          if (timer) clearTimeout(timer);
          finishGenerate(btn);
          if (err && err.name === 'AbortError') {
            setError(
              'Connection interrupted. If credits were charged, open Create again in a minute — for video/3D we resume automatically. Otherwise try Generate once more.'
            );
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
    var voiceSel = $('create-voice-id');
    if (voiceSel) {
      VOICES.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.label;
        voiceSel.appendChild(opt);
      });
    }

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
    fillChips(
      'create-music-themes',
      MUSIC_THEMES,
      function () { return musicTheme; },
      function (v) { musicTheme = v; }
    );
    fillChips(
      'create-music-instruments',
      MUSIC_INSTRUMENTS,
      function () { return musicInstrument; },
      function (v) { musicInstrument = v; }
    );

    document.querySelectorAll('.create-kind').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchKind(btn.getAttribute('data-kind') || 'image');
      });
    });
    ;['create-video-duration', 'create-video-resolution', 'create-video-tier', 'create-music-duration', 'create-sfx-duration'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', syncKinds);
    });
    var promptEl = $('create-prompt');
    if (promptEl) {
      promptEl.addEventListener('input', function () {
        promptsByKind[kind] = promptEl.value;
        if (kind === 'voice') syncKinds();
      });
    }
    syncKinds();
    loadCredits();

    if (!resumePendingJobIfAny()) {
      var last = loadLastResult();
      if (last) {
        showPreview(last);
        setError('Restored your last Create file from this browser.', true);
      }
    }

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
