(function () {
  'use strict';

  var Settings = SpoilerShieldSettings;
  var api = Settings.api;
  var config = SPOILER_SHIELD_CONFIG;

  var elements = {
    game: document.getElementById('game'),
    enabled: document.getElementById('enabled'),
    progress: document.getElementById('progress'),
    progressLabel: document.getElementById('progress-label'),
    placeholderHint: document.getElementById('placeholder-hint'),
    pageStatus: document.getElementById('page-status'),
    revealAll: document.getElementById('reveal-all'),
    sites: document.querySelectorAll('[data-site]'),
    update: document.getElementById('update'),
    listsStatus: document.getElementById('lists-status'),
    report: document.getElementById('report'),
    repo: document.getElementById('repo'),
  };

  var current = null;

  function progressText(progress, chapters) {
    if (progress <= 0) return 'Not started: hiding every story spoiler';
    if (progress >= chapters.length) return 'Finished the story: showing everything';
    var chapter = chapters[progress - 1];
    var name = chapter.placeholder ? chapter.title : 'Chapter ' + progress + ': ' + chapter.title;
    return 'Finished ' + name + ': hiding what comes after';
  }

  function timeAgo(timestamp) {
    var minutes = Math.round((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.round(minutes / 60);
    if (hours < 48) return hours + ' h ago';
    return Math.round(hours / 24) + ' days ago';
  }

  function render() {
    var settings = current.settings;
    var lists = current.lists;
    var chapters = lists.bundle.chapters;

    elements.game.textContent = lists.bundle.game.name;
    elements.enabled.checked = settings.enabled;
    document.body.classList.toggle('off', !settings.enabled);

    elements.progress.max = String(chapters.length);
    elements.progress.value = String(settings.progress);
    elements.progress.setAttribute('aria-valuetext', progressText(settings.progress, chapters));
    elements.progressLabel.textContent = progressText(settings.progress, chapters);
    elements.placeholderHint.hidden = !chapters.some(function (chapter) {
      return chapter.placeholder;
    });

    elements.sites.forEach(function (input) {
      input.checked = settings.sites[input.dataset.site] !== false;
    });

    var version = lists.bundle.listVersion ? ' (' + lists.bundle.listVersion.slice(0, 7) + ')' : '';
    elements.listsStatus.textContent =
      lists.source === 'github'
        ? 'Updated from GitHub ' + timeAgo(lists.fetchedAt) + version
        : 'Built-in lists' + version;
  }

  function save() {
    return Settings.saveSettings(current.settings).then(function () {
      // Content scripts update themselves through storage.onChanged; refresh the count shortly after.
      setTimeout(refreshPageStatus, 250);
    });
  }

  function activeTab() {
    return api.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
      return tabs[0];
    });
  }

  function showPageStatus(response) {
    if (!response) {
      elements.pageStatus.textContent = "This page isn't covered. Open YouTube, Reddit or X.";
      elements.revealAll.hidden = true;
      return;
    }
    if (!response.active) {
      elements.pageStatus.textContent = 'The shield is off on ' + response.site + '.';
      elements.revealAll.hidden = true;
      return;
    }
    var count = response.hidden;
    elements.pageStatus.textContent =
      count === 0
        ? 'Nothing hidden on this ' + response.site + ' page yet.'
        : count + (count === 1 ? ' spoiler' : ' spoilers') + ' hidden on this ' + response.site + ' page.';
    elements.revealAll.hidden = count === 0;
  }

  function sendToTab(message) {
    return activeTab()
      .then(function (tab) {
        if (!tab || tab.id === undefined) return null;
        return api.tabs.sendMessage(tab.id, message);
      })
      .catch(function () {
        return null; // no content script on this page
      });
  }

  function refreshPageStatus() {
    return sendToTab({ type: 'spoiler-shield:status' }).then(showPageStatus);
  }

  function checkForUpdates(quiet) {
    elements.update.disabled = true;
    if (!quiet) elements.listsStatus.textContent = 'Checking GitHub...';
    return Settings.checkForUpdates(current.lists.bundle.listVersion)
      .then(function (outcome) {
        return Settings.load().then(function (loaded) {
          current = loaded;
          render();
          if (!quiet && outcome === 'current') elements.listsStatus.textContent += ': up to date';
        });
      })
      .catch(function (error) {
        if (!quiet) elements.listsStatus.textContent = "Couldn't update: " + error.message;
      })
      .finally(function () {
        elements.update.disabled = false;
      });
  }

  elements.enabled.addEventListener('change', function () {
    current.settings.enabled = elements.enabled.checked;
    render();
    save();
  });

  elements.progress.addEventListener('input', function () {
    current.settings.progress = Number(elements.progress.value);
    render();
  });
  elements.progress.addEventListener('change', save);

  elements.sites.forEach(function (input) {
    input.addEventListener('change', function () {
      current.settings.sites[input.dataset.site] = input.checked;
      save();
    });
  });

  elements.revealAll.addEventListener('click', function () {
    sendToTab({ type: 'spoiler-shield:reveal-all' }).then(showPageStatus);
  });

  elements.update.addEventListener('click', function () {
    checkForUpdates(false);
  });

  elements.report.href = config.reportUrl;
  elements.repo.href = config.repoUrl;

  Settings.load().then(function (loaded) {
    current = loaded;
    render();
    refreshPageStatus();
    if (Date.now() - loaded.lastCheck > config.checkEveryMs) checkForUpdates(true);
  });
})();
