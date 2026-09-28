(function () {
  'use strict';

  var Auth = window.KeyweaverToolsAuth;
  var BACKEND = (Auth && Auth.BACKEND) || 'https://keyweaver-backend.vercel.app';
  var COSTS = { image: 4, video: 25, music: 5, sfx: 5, model3d: 12 };
  var LABELS = {
    image: 'Image',
    video: 'Video',
    music: 'Music',
    sfx: 'Sound effects',
    model3d: '3D model'
  };
  var kind = 'image';
  var creditsRemaining = null;
  var lastObjectUrl = '';

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

  function selectedKind() {
    return kind;
  }

  function syncKinds() {
    document.querySelectorAll('.create-kind').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-kind') === kind);
      btn.setAttribute('aria-pressed', btn.getAttribute('data-kind') === kind ? 'true' : 'false');
    });
    var cost = $('create-cost');
    if (cost) {
      cost.textContent = COSTS[kind] + ' credits · ' + LABELS[kind];
    }
    var refNote = $('create-ref-note');
    if (refNote) {
      refNote.textContent = (kind === 'music' || kind === 'sfx')
        ? 'Music and sound effects follow the prompt. Image references are for image, video, and 3D.'
        : 'Optional PNG, JPEG, or WebP reference (max 8 MB).';
    }
    var aspectWrap = $('create-aspect-wrap');
    if (aspectWrap) aspectWrap.hidden = kind === 'music' || kind === 'sfx' || kind === 'model3d';
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

    if (result.kind === 'video') {
      var video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.src = result.url;
      host.appendChild(video);
      return;
    }
    if (result.kind === 'model3d' || /\.(glb|gltf|obj|fbx|usdz)(\?|$)/i.test(String(result.url || result.filename || ''))) {
      var card = document.createElement('div');
      card.className = 'create-model-card';
      card.innerHTML = '<strong>3D model ready</strong><p class="create-hint">Download the file and open it in Blender, After Effects, or a game engine.</p>';
      host.appendChild(card);
      return;
    }
    var img = document.createElement('img');
    img.alt = 'Generated image';
    img.src = result.url;
    host.appendChild(img);
  }

  function downloadResult() {
    var host = $('create-preview');
    if (!host) return;
    var name = host._filename || 'keyweaver-file';
    if (host._blob) {
      var a = document.createElement('a');
      a.href = lastObjectUrl;
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

  function poll3dJob(requestId, modelId, btn, creditsCharged) {
    var started = Date.now();
    var maxMs = 12 * 60 * 1000;
    var attempt = 0;

    function tick() {
      if (Date.now() - started > maxMs) {
        finishGenerate(btn);
        setError('3D is still running on the server. Check back in a minute, or try again — if it failed, credits are refunded.');
        return;
      }
      attempt += 1;
      btn.textContent = 'Building 3D\u2026 (' + Math.max(1, Math.round((Date.now() - started) / 1000)) + 's)';
      setError('Building the model \u2014 often 2\u20135 minutes. Stay on this page.', true);

      fetch(BACKEND + '/api/prompt-lab/job', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + getToken(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ request_id: requestId, model_id: modelId })
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
            var wait = attempt < 6 ? 2500 : 5000;
            setTimeout(tick, wait);
            return;
          }
          finishGenerate(btn);
          if (!x.res.ok || !x.data || !x.data.url) {
            setError((x.data && x.data.error) || '3D generate failed. Credits refunded if the job failed.');
            loadCredits();
            return;
          }
          showPreview(x.data);
          if (x.data.credits_remaining != null) updateBalance(Number(x.data.credits_remaining));
          setError('Done · ' + (x.data.credits_charged || creditsCharged || COSTS.model3d) + ' credits used.', true);
          loadCredits();
        })
        .catch(function () {
          setTimeout(tick, 4000);
        });
    }

    setTimeout(tick, 2000);
  }

  function generate() {
    var prompt = ($('create-prompt').value || '').trim();
    if (prompt.length < 8) {
      setError('Add a prompt (at least a short sentence).');
      $('create-prompt').focus();
      return;
    }
    if (!getToken()) {
      openModal('create-signup-modal');
      return;
    }
    if (creditsRemaining != null && creditsRemaining < COSTS[kind]) {
      openModal('create-pay-modal');
      return;
    }

    var btn = $('create-generate');
    btn.disabled = true;
    btn.textContent = kind === 'model3d' ? 'Starting 3D\u2026' : 'Generating\u2026';
    setError(kind === 'model3d' ? 'Queuing the model \u2014 then we\u2019ll wait until it finishes.' : '', true);

    var body = new FormData();
    body.append('kind', kind);
    body.append('prompt', prompt);
    body.append('aspect', ($('create-aspect') && $('create-aspect').value) || '16:9');
    var file = $('create-reference') && $('create-reference').files && $('create-reference').files[0];
    if (file) body.append('reference', file);

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    // Submit is quick for 3D (async queue); video still needs a long sync wait.
    var timeoutMs = kind === 'model3d' ? 90000 : kind === 'video' ? 290000 : 150000;
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
            setError((x.data && x.data.error) || 'Generate failed. No charge if it failed.');
            return;
          }
          if (x.data.credits_remaining != null) updateBalance(Number(x.data.credits_remaining));

          // Async 3D: keep polling until fal finishes (beyond Vercel request limits).
          if (x.data.pending && x.data.request_id && x.data.model_id) {
            poll3dJob(x.data.request_id, x.data.model_id, btn, x.data.credits_charged);
            return;
          }

          finishGenerate(btn);
          if (!x.data.url && !x.data.base64) {
            setError((x.data && x.data.error) || 'Generate failed. No charge if it failed.');
            return;
          }
          showPreview(x.data);
          setError('Done · ' + x.data.credits_charged + ' credits used.', true);
        })
        .catch(function (err) {
          if (timer) clearTimeout(timer);
          finishGenerate(btn);
          if (err && err.name === 'AbortError') {
            setError('That took too long. Try a shorter prompt, or try again.');
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
    document.querySelectorAll('.create-kind').forEach(function (btn) {
      btn.addEventListener('click', function () {
        kind = btn.getAttribute('data-kind') || 'image';
        syncKinds();
      });
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
