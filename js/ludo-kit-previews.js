/**
 * Ludo marketing page - panel-style ease curve + hover previews.
 * Ease math mirrors Plugin/com.keyweaver.ludo.panel/js/main.js
 */
(function () {
  var root = document.getElementById('ludo-kit');
  if (!root) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function previewEase(id, t, dir, strength) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var d = dir || 'out';
    var amt = (strength != null ? strength : 70) / 100;
    if (amt < 0.01) amt = 0.01;

    function applyDir(fnOut) {
      if (d === 'in') return 1 - fnOut(1 - t);
      if (d === 'inout') {
        if (t < 0.5) return 0.5 * (1 - fnOut(1 - 2 * t));
        return 0.5 + 0.5 * fnOut(2 * t - 1);
      }
      return fnOut(t);
    }

    if (id === 'linear') return t;
    if (id === 'bezier') return applyDir(function (u) { return u * u * (3 - 2 * u); });
    if (id === 'circ') return applyDir(function (u) { return Math.sqrt(1 - (u - 1) * (u - 1)); });
    if (id === 'quad') return applyDir(function (u) { return u * (2 - u); });
    if (id === 'cubic') return applyDir(function (u) { var x = u - 1; return x * x * x + 1; });
    if (id === 'quart') return applyDir(function (u) { var x = u - 1; return 1 - x * x * x * x; });
    if (id === 'quint') return applyDir(function (u) { var x = u - 1; return x * x * x * x * x + 1; });
    if (id === 'expo') return applyDir(function (u) { return u === 1 ? 1 : 1.000976 * (-Math.pow(2, -10 * u) + 1); });
    if (id === 'overshoot') {
      var sAmt = 0.35 + amt * 3.0;
      return applyDir(function (u) { var x = u - 1; return x * x * ((sAmt + 1) * x + sAmt) + 1; });
    }
    if (id === 'spring') {
      var period = 1.35 - amt * 0.85;
      var k = 0.15 + amt * 1.15;
      return applyDir(function (u) {
        if (u === 0 || u === 1) return u;
        var s = period / 4;
        return 1 + k * Math.pow(2, -10 * u) * Math.sin((u - s) * (2 * Math.PI) / period);
      });
    }
    if (id === 'bounce') {
      return applyDir(function (u) {
        var x = u;
        var raw;
        if (x < 1 / 2.75) raw = 7.5625 * x * x;
        else if (x < 2 / 2.75) { x -= 1.5 / 2.75; raw = 7.5625 * x * x + 0.75; }
        else if (x < 2.5 / 2.75) { x -= 2.25 / 2.75; raw = 7.5625 * x * x + 0.9375; }
        else { x -= 2.625 / 2.75; raw = 7.5625 * x * x + 0.984375; }
        var soft = 1 - Math.pow(1 - u, 3);
        return soft + (raw - soft) * amt;
      });
    }
    return t;
  }

  function easeCurvePath(id) {
    var n = 36;
    var parts = [];
    var i;
    for (i = 0; i <= n; i++) {
      var u = i / n;
      var e = previewEase(id, u, 'out', 70);
      if (e > 1.4) e = 1.4;
      if (e < -0.2) e = -0.2;
      var x = 4 + 48 * u;
      var y = 20 - 14 * e;
      parts.push((i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2));
    }
    return parts.join(' ');
  }

  function easeDotXY(u, e) {
    if (e > 1.4) e = 1.4;
    if (e < -0.2) e = -0.2;
    return { x: 4 + 48 * u, y: 20 - 14 * e };
  }

  function stopDotAnim(chip) {
    if (chip._dotRaf) {
      cancelAnimationFrame(chip._dotRaf);
      chip._dotRaf = 0;
    }
    var dot = chip.querySelector('.ease-dot');
    if (dot) {
      dot.setAttribute('cx', '4');
      dot.setAttribute('cy', '20');
    }
  }

  function playDotAnim(chip, id) {
    if (reduce) return;
    stopDotAnim(chip);
    var dot = chip.querySelector('.ease-dot');
    var pathEl = chip.querySelector('.ease-curve');
    if (!dot) return;
    var advanced = id === 'bounce' || id === 'overshoot' || id === 'spring';
    var len = 0;
    try { if (pathEl) len = pathEl.getTotalLength(); } catch (e) { len = 0; }
    var dur = 1000;
    var t0 = null;
    function frame(now) {
      if (t0 == null) t0 = now;
      var u = (now - t0) / dur;
      if (u > 1) u = 1;
      var e = previewEase(id, u, 'out', 70);
      if (advanced || !pathEl || !len) {
        var xy = easeDotXY(u, e);
        dot.setAttribute('cx', String(xy.x));
        dot.setAttribute('cy', String(xy.y));
      } else {
        var p = e;
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        try {
          var pt = pathEl.getPointAtLength(p * len);
          dot.setAttribute('cx', String(pt.x));
          dot.setAttribute('cy', String(pt.y));
        } catch (err) {
          var fb = easeDotXY(u, e);
          dot.setAttribute('cx', String(fb.x));
          dot.setAttribute('cy', String(fb.y));
        }
      }
      if (u < 1) chip._dotRaf = requestAnimationFrame(frame);
      else chip._dotRaf = 0;
    }
    chip._dotRaf = requestAnimationFrame(frame);
  }

  function mountEaseIcons() {
    root.querySelectorAll('.ludo-chip-ease[data-ease]').forEach(function (chip) {
      var id = chip.getAttribute('data-ease');
      var host = chip.querySelector('.ludo-ease-icon');
      if (!host || !id) return;
      host.innerHTML =
        '<svg viewBox="0 0 56 24" aria-hidden="true">' +
        '<path class="ease-curve" d="' + easeCurvePath(id) + '"/>' +
        '<circle class="ease-dot" r="2.4" cx="4" cy="20"/>' +
        '</svg>';
      chip.addEventListener('mouseenter', function () { playDotAnim(chip, id); });
      chip.addEventListener('mouseleave', function () { stopDotAnim(chip); });
      chip.addEventListener('focus', function () { playDotAnim(chip, id); });
      chip.addEventListener('blur', function () { stopDotAnim(chip); });
      chip.addEventListener('click', function () { playDotAnim(chip, id); });
    });
  }

  function wireMotionChips() {
    root.querySelectorAll('.ludo-chip.has-preview:not(.ludo-chip-loop)').forEach(function (chip) {
      var timer = null;
      function play() {
        chip.classList.remove('is-playing');
        // force reflow so CSS animation restarts
        void chip.offsetWidth;
        chip.classList.add('is-playing');
        clearTimeout(timer);
        timer = setTimeout(function () { chip.classList.remove('is-playing'); }, 900);
      }
      chip.addEventListener('mouseenter', play);
      chip.addEventListener('click', play);
      chip.setAttribute('tabindex', '0');
      chip.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          play();
        }
      });
    });

    root.querySelectorAll('.ludo-chip[data-key], .ludo-chip[data-pattern]').forEach(function (chip) {
      chip.setAttribute('tabindex', '0');
      function play() {
        chip.classList.remove('is-playing');
        void chip.offsetWidth;
        chip.classList.add('is-playing');
        setTimeout(function () { chip.classList.remove('is-playing'); }, 900);
      }
      chip.addEventListener('mouseenter', play);
      chip.addEventListener('click', play);
    });
  }

  // Align key dots have staggered start Y via CSS vars
  root.querySelectorAll('.ludo-chip[data-key="align"] .ludo-key-dot').forEach(function (dot, i) {
    dot.style.setProperty('--dy', ((i - 1) * 4) + 'px');
  });

  mountEaseIcons();
  wireMotionChips();
})();
