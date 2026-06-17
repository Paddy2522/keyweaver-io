(function () {
  'use strict';

  var BACKEND = 'https://keyweaver-backend.vercel.app';

  var TYPES = [
    { value: 'help', label: 'Request help' },
    { value: 'bug', label: 'Report a bug' },
    { value: 'feature', label: 'Suggest a feature' },
    { value: 'question', label: 'Ask a question' },
    { value: 'other', label: 'Something else' }
  ];

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'className') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  function buildTypeOptions() {
    return TYPES.map(function (t) {
      return '<option value="' + t.value + '">' + t.label + '</option>';
    }).join('');
  }

  var launcher = el('button', {
    type: 'button',
    className: 'kw-help-launcher',
    'aria-expanded': 'false',
    'aria-controls': 'kw-help-panel',
    'aria-label': 'Open help and contact form'
  }, (
    '<span class="kw-help-launcher-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>' +
    '</span>' +
    '<span class="kw-help-launcher-label">Help</span>'
  ));

  var backdrop = el('div', { className: 'kw-help-backdrop', id: 'kw-help-backdrop' });

  var panel = el('div', {
    className: 'kw-help-panel',
    id: 'kw-help-panel',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'kw-help-title',
    'aria-hidden': 'true'
  }, (
    '<div class="kw-help-header">' +
      '<div class="kw-help-header-text">' +
        '<h2 id="kw-help-title">How can we help?</h2>' +
        '<p>We usually reply within 24 hours.</p>' +
      '</div>' +
      '<button type="button" class="kw-help-close" aria-label="Close">' +
        '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="kw-help-body">' +
      '<div class="kw-help-alert" id="kw-help-alert" role="alert"></div>' +
      '<form class="kw-help-form" id="kw-help-form" novalidate>' +
        '<div class="kw-field">' +
          '<label for="kw-help-name">Your name</label>' +
          '<input type="text" id="kw-help-name" name="name" autocomplete="name" placeholder="Alex" maxlength="80" required />' +
        '</div>' +
        '<div class="kw-field">' +
          '<label for="kw-help-email">Email</label>' +
          '<input type="email" id="kw-help-email" name="email" autocomplete="email" placeholder="you@example.com" required />' +
        '</div>' +
        '<div class="kw-field">' +
          '<label for="kw-help-type">What is this about?</label>' +
          '<select id="kw-help-type" name="type" required>' + buildTypeOptions() + '</select>' +
        '</div>' +
        '<div class="kw-field">' +
          '<label for="kw-help-message">Message</label>' +
          '<textarea id="kw-help-message" name="message" placeholder="Tell us what you need…" maxlength="4000" required></textarea>' +
        '</div>' +
        '<input type="text" class="kw-help-hp" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
        '<div class="kw-field cuemark-turnstile-wrap" id="kw-help-turnstile-wrap"><div id="kw-help-turnstile"></div></div>' +
        '<button type="submit" class="kw-help-submit" id="kw-help-submit">' +
          '<span class="kw-help-submit-label">Send message</span>' +
          '<span class="kw-help-spinner" aria-hidden="true"></span>' +
        '</button>' +
        '<p class="kw-help-footer-note">Or email <a href="mailto:hello@keyweaver.io" style="color:#7b8bff;text-decoration:underline;">hello@keyweaver.io</a> directly.</p>' +
      '</form>' +
      '<div class="kw-help-success" id="kw-help-success">' +
        '<div class="kw-help-success-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</div>' +
        '<h3>Message sent</h3>' +
        '<p>Thanks for reaching out. We&rsquo;ll get back to you at the email you provided within <strong>24 hours</strong>.</p>' +
      '</div>' +
    '</div>'
  ));

  document.body.appendChild(launcher);
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  var form = document.getElementById('kw-help-form');
  var alertEl = document.getElementById('kw-help-alert');
  var successEl = document.getElementById('kw-help-success');
  var submitBtn = document.getElementById('kw-help-submit');
  var closeBtn = panel.querySelector('.kw-help-close');
  var lastFocus = null;

  function setOpen(open) {
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    panel.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';

    if (open) {
      lastFocus = document.activeElement;
      var nameInput = document.getElementById('kw-help-name');
      if (nameInput) nameInput.focus();
      if (window.CuemarkTurnstile) {
        CuemarkTurnstile.prepare('kw-help-turnstile-wrap', 'kw-help-turnstile').catch(function () {});
      }
    } else if (lastFocus && lastFocus.focus) {
      lastFocus.focus();
    }
  }

  function showError(msg) {
    alertEl.textContent = msg;
    alertEl.className = 'kw-help-alert is-error';
  }

  function clearError() {
    alertEl.textContent = '';
    alertEl.className = 'kw-help-alert';
  }

  function resetForm() {
    form.reset();
    form.style.display = '';
    successEl.classList.remove('is-visible');
    clearError();
    submitBtn.disabled = false;
    submitBtn.classList.remove('is-loading');
  }

  launcher.addEventListener('click', function () {
    var isOpen = panel.classList.contains('is-open');
    if (isOpen) {
      setOpen(false);
    } else {
      resetForm();
      setOpen(true);
    }
  });

  closeBtn.addEventListener('click', function () { setOpen(false); });
  backdrop.addEventListener('click', function () { setOpen(false); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) {
      setOpen(false);
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var name = document.getElementById('kw-help-name').value.trim();
    var email = document.getElementById('kw-help-email').value.trim();
    var type = document.getElementById('kw-help-type').value;
    var message = document.getElementById('kw-help-message').value.trim();
    var honeypot = form.querySelector('[name="company"]').value;

    if (honeypot) {
      form.style.display = 'none';
      successEl.classList.add('is-visible');
      return;
    }

    if (!name) {
      showError('Please enter your name.');
      return;
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }
    if (!message || message.length < 10) {
      showError('Please include a bit more detail (at least 10 characters).');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');

    var turnstilePromise = window.CuemarkTurnstile
      ? CuemarkTurnstile.requireToken('kw-help-turnstile')
      : Promise.resolve('');

    turnstilePromise.then(function (turnstileToken) {
      return fetch(BACKEND + '/api/captio/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          type: type,
          message: message,
          page: window.location.href,
          turnstile_token: turnstileToken || undefined
        })
      });
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) {
          showError((result.data && result.data.error) || 'Could not send your message. Try again or email hello@keyweaver.io.');
          if (window.CuemarkTurnstile) CuemarkTurnstile.reset('kw-help-turnstile');
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
          return;
        }
        form.style.display = 'none';
        successEl.classList.add('is-visible');
        submitBtn.classList.remove('is-loading');
      })
      .catch(function (err) {
        showError(err && err.message ? err.message : 'Could not reach the server. Check your connection or email hello@keyweaver.io.');
        if (window.CuemarkTurnstile) CuemarkTurnstile.reset('kw-help-turnstile');
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      });
  });
})();
