/**
 * Content-script entry point: connects the shield to the extension's settings.
 * Starts straight away with the safest defaults (hide everything) so nothing
 * slips through while settings load.
 */
(function () {
  'use strict';

  // Registered scripts can be injected twice when permissions change; run once per page.
  if (window.__spoilerShieldStarted) return;
  window.__spoilerShieldStarted = true;

  var adapter = SpoilerShieldSites.forHost(location.hostname);
  if (!adapter) return;

  var Settings = SpoilerShieldSettings;
  var lists = Settings.pickCatalog(null);
  var settings = Settings.mergeSettings(null, lists.catalog);
  var matchers = [];

  function rebuild() {
    matchers = lists.catalog.packs
      .filter(function (pack) {
        var choice = settings.packs[pack.game.id];
        return choice && choice.enabled;
      })
      .map(function (pack) {
        return { pack: pack, matcher: SpoilerMatcher.compile(pack, { progress: settings.packs[pack.game.id].progress }) };
      });
  }

  function active() {
    return settings.enabled && settings.sites[adapter.id] === true;
  }

  // Checks every enabled pack and reports the first one the text spoils.
  var combined = {
    match: function (text) {
      for (var i = 0; i < matchers.length; i++) {
        var result = matchers[i].matcher.match(text);
        if (result.isSpoiler) {
          result.pack = matchers[i].pack;
          return result;
        }
      }
      return { isSpoiler: false, chapter: null, ruleIds: [] };
    },
  };

  rebuild();

  var shield = SpoilerShieldCore.create({
    adapter: adapter,
    getMatcher: function () {
      return active() && matchers.length ? combined : null;
    },
    describe: function (result) {
      return Settings.describe(result.pack, result.chapter);
    },
    onReport: function (report) {
      Settings.api.runtime
        .sendMessage({
          type: 'spoiler-shield:open-report',
          report: {
            kind: 'false_alarm',
            pack: report.result.pack.game.id,
            chapter: report.result.chapter,
            text: report.text,
            url: location.href,
            site: adapter.id,
          },
        })
        .catch(function () {});
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
