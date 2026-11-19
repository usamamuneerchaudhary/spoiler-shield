/**
 * Settings and list storage shared by the popup and the content scripts.
 * Uses `browser.*` in Firefox and `chrome.*` in Chrome; both return promises in MV3.
 */
(function (root) {
  'use strict';

  var api = root.browser || root.chrome;

  var DEFAULTS = {
    enabled: true,
    progress: 0,
    sites: { youtube: true, reddit: true, x: true },
  };

  function mergeSettings(saved) {
    var settings = {
      enabled: DEFAULTS.enabled,
      progress: DEFAULTS.progress,
      sites: Object.assign({}, DEFAULTS.sites),
    };
    if (saved && typeof saved === 'object') {
      if (typeof saved.enabled === 'boolean') settings.enabled = saved.enabled;
      if (Number.isInteger(saved.progress) && saved.progress >= 0) settings.progress = saved.progress;
      if (saved.sites && typeof saved.sites === 'object') {
        Object.keys(settings.sites).forEach(function (id) {
          if (typeof saved.sites[id] === 'boolean') settings.sites[id] = saved.sites[id];
        });
      }
    }
    return settings;
  }

  /** The newest valid bundle: one fetched from GitHub, or the one shipped in the extension. */
  function pickBundle(remote) {
    var builtIn = root.SPOILER_SHIELD_BUNDLE;
    var candidate = remote && remote.bundle;
    // Lists fetched under an older extension version are dropped once the
    // extension itself ships newer built-in lists.
    var fetchedForThisBuild = remote && remote.builtInVersion === builtIn.listVersion;
    if (candidate && fetchedForThisBuild && root.SpoilerMatcher.validateBundle(candidate).ok) {
      return { bundle: candidate, source: 'github', fetchedAt: remote.fetchedAt };
    }
    return { bundle: builtIn, source: 'built-in', fetchedAt: null };
  }

  function load() {
    return api.storage.local.get(['settings', 'remote', 'lastCheck']).then(function (stored) {
      var settings = mergeSettings(stored.settings);
      var lists = pickBundle(stored.remote);
      settings.progress = Math.min(settings.progress, lists.bundle.chapters.length);
      return { settings: settings, lists: lists, lastCheck: stored.lastCheck || 0 };
    });
  }

  function saveSettings(settings) {
    return api.storage.local.set({ settings: mergeSettings(settings) });
  }

  /**
   * Download the latest lists. Resolves to "updated", "current" or throws.
   * Only data is downloaded; it must pass validateBundle() to be stored.
   */
  function checkForUpdates(currentVersion) {
    var config = root.SPOILER_SHIELD_CONFIG;
    return fetch(config.listsUrl, { cache: 'no-store', credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('GitHub answered ' + response.status);
        return response.json();
      })
      .then(function (bundle) {
        var check = root.SpoilerMatcher.validateBundle(bundle);
        if (!check.ok) throw new Error('The downloaded lists are not valid: ' + check.errors[0]);
        var now = Date.now();
        var builtInVersion = root.SPOILER_SHIELD_BUNDLE.listVersion;
        if (bundle.listVersion && bundle.listVersion === currentVersion) {
          return api.storage.local.set({ lastCheck: now }).then(function () {
            return 'current';
          });
        }
        return api.storage.local
          .set({ remote: { bundle: bundle, fetchedAt: now, builtInVersion: builtInVersion }, lastCheck: now })
          .then(function () {
            return 'updated';
          });
      });
  }

  root.SpoilerShieldSettings = {
    api: api,
    DEFAULTS: DEFAULTS,
    mergeSettings: mergeSettings,
    pickBundle: pickBundle,
    load: load,
    saveSettings: saveSettings,
    checkForUpdates: checkForUpdates,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
