/**
 * Settings and list storage shared by the popup, the background script and the content scripts.
 * Uses `browser.*` in Firefox and `chrome.*` in Chrome; both return promises in MV3.
 */
(function (root) {
  'use strict';

  var api = root.browser || root.chrome;

  /** Sites that work out of the box, and sites the user turns on (they need an extra permission). */
  var CORE_SITES = ['youtube', 'reddit', 'x'];
  var OPTIONAL_SITES = ['twitch', 'tiktok', 'google'];
  var DEFAULT_PACKS = ['gta6'];

  function defaults(catalog) {
    var sites = {};
    CORE_SITES.forEach(function (id) {
      sites[id] = true;
    });
    // Optional sites also need their permission; without it the shield never runs there.
    OPTIONAL_SITES.forEach(function (id) {
      sites[id] = true;
    });
    var packs = {};
    (catalog ? catalog.packs : []).forEach(function (pack) {
      packs[pack.game.id] = { enabled: DEFAULT_PACKS.indexOf(pack.game.id) !== -1, progress: 0 };
    });
    return { enabled: true, sites: sites, packs: packs };
  }

  /** Saved settings on top of the defaults, with anything unknown or malformed dropped. */
  function mergeSettings(saved, catalog) {
    var settings = defaults(catalog);
    if (!saved || typeof saved !== 'object') return settings;
    if (typeof saved.enabled === 'boolean') settings.enabled = saved.enabled;
    if (saved.sites && typeof saved.sites === 'object') {
      Object.keys(settings.sites).forEach(function (id) {
        if (typeof saved.sites[id] === 'boolean') settings.sites[id] = saved.sites[id];
      });
    }
    if (saved.packs && typeof saved.packs === 'object') {
      (catalog ? catalog.packs : []).forEach(function (pack) {
        var id = pack.game.id;
        var stored = saved.packs[id];
        if (!stored || typeof stored !== 'object') return;
        if (typeof stored.enabled === 'boolean') settings.packs[id].enabled = stored.enabled;
        if (Number.isInteger(stored.progress) && stored.progress >= 0) {
          settings.packs[id].progress = Math.min(stored.progress, pack.chapters.length);
        }
      });
    }
    return settings;
  }

  /** The newest valid catalog: one fetched from GitHub, or the one shipped in the extension. */
  function pickCatalog(remote) {
    var builtIn = root.SPOILER_SHIELD_CATALOG;
    var candidate = remote && remote.catalog;
    // Lists fetched under an older extension version are dropped once the
    // extension itself ships newer built-in lists.
    var fetchedForThisBuild = remote && remote.builtInVersion === builtIn.listVersion;
    if (candidate && fetchedForThisBuild && root.SpoilerMatcher.validateCatalog(candidate).ok) {
      return { catalog: candidate, source: 'github', fetchedAt: remote.fetchedAt };
    }
    return { catalog: builtIn, source: 'built-in', fetchedAt: null };
  }

  function load() {
    return api.storage.local.get(['settings', 'remote', 'lastCheck']).then(function (stored) {
      var lists = pickCatalog(stored.remote);
      return { settings: mergeSettings(stored.settings, lists.catalog), lists: lists, lastCheck: stored.lastCheck || 0 };
    });
  }

  function saveSettings(settings, catalog) {
    return api.storage.local.set({ settings: mergeSettings(settings, catalog) });
  }

  /**
   * Download the latest lists. Resolves to "updated" or "current", or rejects.
   * Only data is downloaded; it must pass validateCatalog() to be stored.
   */
  function checkForUpdates(currentVersion) {
    var config = root.SPOILER_SHIELD_CONFIG;
    return fetch(config.listsUrl, { cache: 'no-store', credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('GitHub answered ' + response.status);
        return response.json();
      })
      .then(function (catalog) {
        var check = root.SpoilerMatcher.validateCatalog(catalog);
        if (!check.ok) throw new Error('The downloaded lists are not valid: ' + check.errors[0]);
        var now = Date.now();
        var builtInVersion = root.SPOILER_SHIELD_CATALOG.listVersion;
        if (catalog.listVersion && catalog.listVersion === currentVersion) {
          return api.storage.local.set({ lastCheck: now }).then(function () {
            return 'current';
          });
        }
        return api.storage.local
          .set({ remote: { catalog: catalog, fetchedAt: now, builtInVersion: builtInVersion }, lastCheck: now })
          .then(function () {
            return 'updated';
          });
      });
  }

  function unitLabel(pack) {
    var unit = (pack.game && pack.game.unit) || 'chapter';
    return unit.charAt(0).toUpperCase() + unit.slice(1);
  }

  /**
   * Label for the earliest chapter a match spoils. Only the number is shown:
   * the name of a chapter the reader hasn't reached could be a spoiler itself.
   */
  function describe(pack, chapter) {
    var count = pack.chapters.length;
    var name = pack.game.name;
    if (count === 1) return name + ' · story spoiler';
    if (!chapter || chapter >= count) return name + ' · ending / late story';
    return name + ' · ' + unitLabel(pack) + ' ' + chapter + ' or later';
  }

  /** "Not started", "Finished Chapter 2: The Docks", "Finished the story". */
  function progressText(pack, progress) {
    var count = pack.chapters.length;
    var finishedAll = pack.game.kind === 'show' ? 'Finished the show' : 'Finished the story';
    if (progress <= 0) return count === 1 ? 'Not finished: hiding story spoilers' : 'Not started: hiding every story spoiler';
    if (progress >= count) return finishedAll + ': showing everything';
    var chapter = pack.chapters[progress - 1];
    var title = root.SpoilerMatcher.chapterTitle(chapter);
    var label = unitLabel(pack) + ' ' + progress;
    var name = chapter.placeholder || !title || title === label ? label : label + ': ' + title;
    return 'Finished ' + name + ': hiding what comes after';
  }

  root.SpoilerShieldSettings = {
    api: api,
    CORE_SITES: CORE_SITES,
    OPTIONAL_SITES: OPTIONAL_SITES,
    defaults: defaults,
    mergeSettings: mergeSettings,
    pickCatalog: pickCatalog,
    load: load,
    saveSettings: saveSettings,
    checkForUpdates: checkForUpdates,
    describe: describe,
    progressText: progressText,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
