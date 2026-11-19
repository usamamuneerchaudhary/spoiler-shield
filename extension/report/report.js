/**
 * Report form. Opened by the right-click menu ("Report as spoiler"), by the
 * overlay's "Not a spoiler?" button, and from the popup. Nothing leaves the
 * browser until the user presses Send.
 *
 * With config.reportApiUrl set, reports go to the Spoiler Shield API
 * (api/ in the repo). Without it, Send opens a pre-filled GitHub issue.
 */
(function () {
  'use strict';

  var Settings = SpoilerShieldSettings;
  var api = Settings.api;
  var config = SPOILER_SHIELD_CONFIG;
  var params = new URLSearchParams(location.search);

  var SITE_NAMES = { youtube: 'YouTube', reddit: 'Reddit', x: 'X', twitch: 'Twitch', tiktok: 'TikTok', google: 'Google' };
  var MAX_TEXT = 500;
  var MAX_NOTE = 300;

  var form = document.getElementById('report-form');
  var fields = {
    pack: document.getElementById('pack'),
    chapter: document.getElementById('chapter'),
    chapterLabel: document.getElementById('chapter-label'),
    text: document.getElementById('text'),
    textCount: document.getElementById('text-count'),
    includeUrl: document.getElementById('include-url'),
    urlPreview: document.getElementById('url-preview'),
    note: document.getElementById('note'),
    where: document.getElementById('where'),
    error: document.getElementById('error'),
    send: document.getElementById('send'),
    done: document.getElementById('done'),
    doneText: document.getElementById('done-text'),
  };

  var catalog = null;
  var pageUrl = safeUrl(params.get('url'));
  var site = SITE_NAMES[params.get('site')] ? params.get('site') : '';

  function safeUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href.slice(0, 2048) : '';
    } catch (error) {
      return '';
    }
  }

  function kind() {
    return form.querySelector('input[name="kind"]:checked').value;
  }

  function selectedPack() {
    return catalog.packs.find(function (pack) {
      return pack.game.id === fields.pack.value;
    });
  }

  function unitName(pack) {
    var unit = pack.game.unit || 'chapter';
    return unit.charAt(0).toUpperCase() + unit.slice(1);
  }

  function fillChapters() {
    var pack = selectedPack();
    var keep = fields.chapter.value || params.get('chapter') || '';
    fields.chapter.textContent = '';
    var notSure = new Option('Not sure', '');
    fields.chapter.add(notSure);
    // Only numbers: names of later chapters could be spoilers themselves.
    pack.chapters.forEach(function (chapter) {
      fields.chapter.add(new Option(unitName(pack) + ' ' + chapter.id, String(chapter.id)));
    });
    fields.chapter.value = keep && Number(keep) <= pack.chapters.length ? keep : '';
    var single = pack.chapters.length === 1;
    fields.chapter.closest('label').hidden = single;
    fields.chapterLabel.textContent =
      kind() === 'false_alarm' ? 'How far have you got?' : 'Which ' + (pack.game.unit || 'chapter') + ' does it spoil?';
  }

  function updateCount() {
    fields.textCount.textContent = String(fields.text.value.length);
  }

  function showError(message) {
    fields.error.textContent = message;
    fields.error.hidden = !message;
  }

  function payload() {
    var pack = selectedPack();
    var chapter = fields.chapter.value ? Number(fields.chapter.value) : null;
    return {
      kind: kind(),
      pack: pack.game.id,
      chapter: chapter,
      text: fields.text.value.trim().slice(0, MAX_TEXT),
      page_url: fields.includeUrl.checked && pageUrl ? pageUrl : null,
      site: site || null,
      note: fields.note.value.trim().slice(0, MAX_NOTE) || null,
      extension_version: api.runtime.getManifest().version,
      list_version: catalog.listVersion || null,
    };
  }

  function githubIssueUrl(report) {
    var pack = selectedPack();
    var siteName = SITE_NAMES[report.site] || 'Other';
    var chapterText = report.chapter ? unitName(pack) + ' ' + report.chapter : 'not sure';
    var details =
      '<details><summary>' + (report.kind === 'false_alarm' ? 'Blurred text' : 'Spoiler') + '</summary>\n\n' +
      report.text +
      (report.page_url ? '\n\nPage: ' + report.page_url : '') +
      (report.note ? '\n\nNote: ' + report.note : '') +
      '\n\n</details>';

    var query = new URLSearchParams();
    if (report.kind === 'false_alarm') {
      query.set('template', 'false-alarm.yml');
      query.set('title', 'Hidden by mistake: ' + pack.game.name + ' on ' + siteName);
      query.set('text', details);
    } else {
      query.set('template', 'missed-spoiler.yml');
      query.set('title', 'Missed spoiler: ' + pack.game.name + ', ' + chapterText + ' (' + siteName + ')');
      query.set('chapter', chapterText);
      query.set('spoiler', details);
    }
    query.set('pack', pack.game.name);
    query.set('site', siteName);
    return config.repoUrl + '/issues/new?' + query.toString();
  }

  function sendToApi(report) {
    var endpoint = config.reportApiUrl.replace(/\/+$/, '') + '/api/v1/reports';
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(report),
    }).then(function (response) {
      if (response.status === 201 || response.status === 200) return response.json();
      if (response.status === 429) throw new Error('Too many reports from your connection. Try again in a few minutes.');
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (body) {
          var first = body && body.errors && Object.values(body.errors)[0];
          throw new Error((first && first[0]) || body.message || 'The server answered ' + response.status + '.');
        });
    });
  }

  function finish(message) {
    form.hidden = true;
    fields.done.hidden = false;
    if (message) fields.doneText.textContent = message;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    showError('');
    var report = payload();
    if (!report.text) {
      showError('Add the text you want to report.');
      fields.text.focus();
      return;
    }

    if (!config.reportApiUrl) {
      location.href = githubIssueUrl(report);
      return;
    }

    fields.send.disabled = true;
    sendToApi(report)
      .then(function () {
        finish();
      })
      .catch(function (error) {
        showError(error.message || 'Could not send the report.');
      })
      .finally(function () {
        fields.send.disabled = false;
      });
  });

  form.addEventListener('change', function (event) {
    if (event.target.name === 'kind' || event.target === fields.pack) fillChapters();
  });
  fields.text.addEventListener('input', updateCount);

  function closeTab() {
    window.close();
  }
  document.getElementById('cancel').addEventListener('click', closeTab);
  document.getElementById('close').addEventListener('click', closeTab);

  Settings.load().then(function (loaded) {
    catalog = loaded.lists.catalog;
    var settings = loaded.settings;

    catalog.packs.forEach(function (pack) {
      fields.pack.add(new Option(pack.game.name, pack.game.id));
    });
    var requested = params.get('pack');
    var firstEnabled = catalog.packs.find(function (pack) {
      return settings.packs[pack.game.id] && settings.packs[pack.game.id].enabled;
    });
    fields.pack.value = catalog.packs.some(function (pack) {
      return pack.game.id === requested;
    })
      ? requested
      : (firstEnabled || catalog.packs[0]).game.id;

    if (params.get('kind') === 'false_alarm') form.querySelector('input[value="false_alarm"]').checked = true;
    fields.text.value = (params.get('text') || '').slice(0, MAX_TEXT);
    updateCount();
    fillChapters();

    fields.urlPreview.textContent = pageUrl || 'none';
    fields.includeUrl.disabled = !pageUrl;
    fields.includeUrl.checked = !!pageUrl;

    fields.where.textContent = config.reportApiUrl
      ? 'Sent to the Spoiler Shield moderators. See PRIVACY.md on GitHub for what is stored.'
      : 'Send opens a pre-filled GitHub issue for you to check and submit. The text goes in a collapsed block so nobody is spoiled.';
  });
})();
