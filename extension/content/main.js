/**
 * Content-script entry point: connects the shield to the extension's settings.
 * Starts straight away with the safest defaults (hide everything) so nothing
 * slips through while settings load.
 */
(function () {
  'use strict';

  var adapter = SpoilerShieldSites.forHost(location.hostname);
  if (!adapter) return;

  var Settings = SpoilerShieldSettings;
  var settings = Settings.mergeSettings(null);
  var lists = Settings.pickBundle(null);
  var matcher = null;

  function rebuild() {
    matcher = SpoilerMatcher.compile(lists.bundle, { progress: settings.progress });
  }

  function active() {
    return settings.enabled && settings.sites[adapter.id] !== false;
  }

  rebuild();

  var shield = SpoilerShieldCore.create({
    adapter: adapter,
    getMatcher: function () {
      return active() ? matcher : null;
    },
    describe: function (result) {
      return SpoilerShieldCore.describe(lists.bundle.chapters, result.chapter);
    },
  });

  function reload() {
    return Settings.load().then(function (loaded) {
      settings = loaded.settings;
      lists = loaded.lists;
      rebuild();
      shield.refresh();
    });
  }

  shield.start();
  reload().catch(function (error) {
    console.warn('[Spoiler Shield] Could not load settings, using defaults.', error);
  });

  Settings.api.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && (changes.settings || changes.remote)) reload();
  });

  Settings.api.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'spoiler-shield:status') {
      sendResponse({ site: adapter.name, active: active(), hidden: shield.count() });
    } else if (message.type === 'spoiler-shield:reveal-all') {
      shield.revealAll();
      sendResponse({ site: adapter.name, active: active(), hidden: shield.count() });
    }
  });
})();
