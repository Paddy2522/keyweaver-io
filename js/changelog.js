/**
 * Renders Cuemark release notes from /changelog.json
 */
(function (global) {
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return iso;
    }
  }

  function listHtml(items) {
    if (!items || !items.length) { return ''; }
    return '<ul>' + items.map(function (item) {
      return '<li>' + esc(item) + '</li>';
    }).join('') + '</ul>';
  }

  function releaseBlock(release, opts) {
    opts = opts || {};
    var isLatest = !!opts.isLatest;
    var html = '<article class="changelog-release' + (isLatest ? ' is-latest' : '') + '">';
    html += '<div class="changelog-release-head">';
    html += '<h2 class="changelog-version">v' + esc(release.version) + '</h2>';
    html += '<time class="changelog-date" datetime="' + esc(release.date) + '">' + esc(formatDate(release.date)) + '</time>';
    if (isLatest) { html += '<span class="changelog-badge">Latest</span>'; }
    html += '</div>';
    if (release.panel && release.panel.length) {
      html += '<h3 class="changelog-section-title">Plugin</h3>' + listHtml(release.panel);
    }
    if (release.website && release.website.length) {
      html += '<h3 class="changelog-section-title">Website</h3>' + listHtml(release.website);
    }
    html += '</article>';
    return html;
  }

  async function fetchChangelog() {
    var res = await fetch('/changelog.json');
    if (!res.ok) { throw new Error('Could not load changelog'); }
    return res.json();
  }

  global.CuemarkChangelog = {
    fetchChangelog: fetchChangelog,
    renderLatest: function (container, data) {
      if (!container || !data || !data.releases || !data.releases.length) { return; }
      container.innerHTML = releaseBlock(data.releases[0], { isLatest: true });
    },
    renderAll: function (container, data) {
      if (!container || !data || !data.releases) { return; }
      container.innerHTML = data.releases.map(function (release, i) {
        return releaseBlock(release, { isLatest: i === 0 });
      }).join('');
    }
  };
})(window);
