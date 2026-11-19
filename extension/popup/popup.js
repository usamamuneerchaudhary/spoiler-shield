(function () {
  'use strict';

  var Settings = SpoilerShieldSettings;
  var Registry = SpoilerShieldSiteRegistry;
  var api = Settings.api;
  var config = SPOILER_SHIELD_CONFIG;

  var elements = {
    subtitle: document.getElementById('subtitle'),
    enabled: document.getElementById('enabled'),
    packs: document.getElementById('packs'),
    packTemplate: document.getElementById('pack-template'),
    pageStatus: document.getElementById('page-status'),
    revealAll: document.getElementById('reveal-all'),
    sites: document.querySelectorAll('[data-site]'),
    optionalSites: document.querySelectorAll('[data-optional-site]'),
    update: document.getElementById('update'),
    listsStatus: document.getElementById('lists-status'),
    repo: document.getElementById('repo'),
  };

  var current = null;
  var packRows = {};

  function timeAgo(timestamp) {
    var minutes = Math.round((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.round(minutes / 60);
    if (hours < 48) return hours + ' h ago';
    return Math.round(hours / 24) + ' days ago';
  }

  function packs() {
    return current.lists.catalog.packs;
  }

  function buildPackRows() {
    elements.packs.textContent = '';
    packRows = {};
    packs().forEach(function (pack) {
      var id = pack.game.id;
      var row = elements.packTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.pack = id;
      row.querySelector('.name').textContent = pack.game.name;
      var checkbox = row.querySelector('.pack-enabled');
      var slider = row.querySelector('.pack-slider');
      slider.max = String(pack.chapters.length);
      slider.setAttribute('aria-label', 'How far you have got in ' + pack.game.name);

      checkbox.addEventListener('change', function () {
        current.settings.packs[id].enabled = checkbox.checked;
        render();
        save();
      });
      slider.addEventListener('input', function () {
        current.settings.packs[id].progress = Number(slider.value);
        render();
      });
      slider.addEventListener('change', save);

      elements.packs.appendChild(row);
      packRows[id] = row;
    });
  }

  function render() {
    var settings = current.settings;
    var lists = current.lists;

    elements.enabled.checked = settings.enabled;
    document.body.classList.toggle('off', !settings.enabled);

    var on = 0;
    packs().forEach(function (pack) {
      var id = pack.game.id;
      var row = packRows[id];
      var choice = settings.packs[id];
      if (!row || !choice) return;
      if (choice.enabled) on += 1;
      row.classList.toggle('on', choice.enabled);
      row.querySelector('.pack-enabled').checked = choice.enabled;
      var slider = row.querySelector('.pack-slider');
      slider.value = String(choice.progress);
      var text = Settings.progressText(pack, choice.progress);
      slider.setAttribute('aria-valuetext', text);
      row.querySelector('.progress-label').textContent = text;
      row.querySelector('.placeholder-hint').hidden = !pack.chapters.some(function (chapter) {
        return chapter.placeholder;
      }) || pack.chapters.length === 1;
    });
    elements.subtitle.textContent =
      on === 0 ? 'Pick a story below' : 'Hiding spoilers for ' + on + (on === 1 ? ' story' : ' stories');

    elements.sites.forEach(function (input) {
      input.checked = settings.sites[input.dataset.site] !== false;
    });

    var version = lists.catalog.listVersion ? ' (' + lists.catalog.listVersion.slice(0, 7) + ')' : '';
    elements.listsStatus.textContent =
      lists.source === 'github' ? 'Updated from GitHub ' + timeAgo(lists.fetchedAt) + version : 'Built-in lists' + version;
  }

  function renderOptionalSites() {
    elements.optionalSites.forEach(function (input) {
      var info = Registry.OPTIONAL[input.dataset.optionalSite];
      api.permissions.contains({ origins: info.origins }).then(function (granted) {
        input.checked = granted;
      });
    });
  }

  function save() {
    return Settings.saveSettings(current.settings, current.lists.catalog).then(function () {
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
    return Settings.checkForUpdates(current.lists.catalog.listVersion)
      .then(function (outcome) {
        return Settings.load().then(function (loaded) {
          var packsChanged = loaded.lists.catalog.packs.length !== packs().length;
          current = loaded;
          if (packsChanged) buildPackRows();
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

  elements.sites.forEach(function (input) {
    input.addEventListener('change', function () {
      current.settings.sites[input.dataset.site] = input.checked;
      save();
    });
  });

  // Optional sites are switched on by granting their permission; the background
  // script then starts the shield there. Switching off gives the permission back.
  elements.optionalSites.forEach(function (input) {
    input.addEventListener('change', function () {
      var info = Registry.OPTIONAL[input.dataset.optionalSite];
      var request = input.checked
        ? api.permissions.request({ origins: info.origins })
        : api.permissions.remove({ origins: info.origins });
      Promise.resolve(request)
        .catch(function () {
          return false;
        })
        .then(renderOptionalSites);
    });
  });

  elements.revealAll.addEventListener('click', function () {
    sendToTab({ type: 'spoiler-shield:reveal-all' }).then(showPageStatus);
  });

  elements.update.addEventListener('click', function () {
    checkForUpdates(false);
  });

  elements.repo.href = config.repoUrl;

  Settings.load().then(function (loaded) {
    current = loaded;
    buildPackRows();
    render();
    renderOptionalSites();
    refreshPageStatus();
    if (Date.now() - loaded.lastCheck > config.checkEveryMs) checkForUpdates(true);
  });
})();
