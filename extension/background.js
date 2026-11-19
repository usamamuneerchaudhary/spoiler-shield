/**
 * Background script (a service worker in Chrome, an event page in Firefox).
 *
 * - Registers the content scripts for optional sites (Twitch, TikTok, Google)
 *   once the user grants that site's permission, and removes them when it's revoked.
 * - Adds "Report as spoiler" to the right-click menu.
 * - Opens the report page when the overlay's "Not a spoiler?" button is used.
 */
/* global importScripts */
if (typeof importScripts === 'function') {
  importScripts('shared/sites-registry.js');
}

(function () {
  'use strict';

  var api = globalThis.browser || globalThis.chrome;
  var Registry = globalThis.SpoilerShieldSiteRegistry;
  var MENU_ID = 'spoiler-shield-report';

  function scriptId(site) {
    return 'spoiler-shield-' + site;
  }

  /** Make registered content scripts match the permissions the user has granted. */
  function syncSites() {
    var ids = Object.keys(Registry.OPTIONAL);
    return api.scripting.getRegisteredContentScripts().then(function (registered) {
      var registeredIds = registered.map(function (script) {
        return script.id;
      });
      return Promise.all(
        ids.map(function (site) {
          var info = Registry.OPTIONAL[site];
          return api.permissions.contains({ origins: info.origins }).then(function (granted) {
            var isRegistered = registeredIds.indexOf(scriptId(site)) !== -1;
            if (granted && !isRegistered) {
              return api.scripting.registerContentScripts([
                {
                  id: scriptId(site),
                  matches: info.matches,
                  js: Registry.CONTENT_JS,
                  css: Registry.CONTENT_CSS,
                  runAt: 'document_start',
                  persistAcrossSessions: true,
                },
              ]);
            }
            if (!granted && isRegistered) {
              return api.scripting.unregisterContentScripts({ ids: [scriptId(site)] });
            }
            return null;
          });
        })
      );
    });
  }

  function createMenu() {
    // removeAll first, so a restarted worker never creates a duplicate item.
    return Promise.resolve(api.contextMenus.removeAll()).then(function () {
      api.contextMenus.create({
        id: MENU_ID,
        title: 'Report as spoiler',
        contexts: ['selection', 'link'],
        documentUrlPatterns: Registry.REPORT_PATTERNS,
      });
    });
  }

  function siteOf(url) {
    try {
      var host = new URL(url).hostname;
      if (/youtube\.com$/.test(host)) return 'youtube';
      if (/reddit\.com$/.test(host)) return 'reddit';
      if (/(^|\.)x\.com$|twitter\.com$/.test(host)) return 'x';
      if (/twitch\.tv$/.test(host)) return 'twitch';
      if (/tiktok\.com$/.test(host)) return 'tiktok';
      if (/^www\.google\./.test(host)) return 'google';
    } catch (error) {
      /* ignore */
    }
    return '';
  }

  /** Open the report form, pre-filled. Nothing is sent until the user submits it. */
  function openReport(report) {
    var params = new URLSearchParams();
    Object.keys(report).forEach(function (key) {
      if (report[key] !== undefined && report[key] !== null && report[key] !== '') params.set(key, String(report[key]));
    });
    return api.tabs.create({ url: api.runtime.getURL('report/report.html') + '?' + params.toString() });
  }

  function setUp() {
    return Promise.all([syncSites(), createMenu()]).catch(function (error) {
      console.warn('[Spoiler Shield] setup failed', error);
    });
  }

  api.runtime.onInstalled.addListener(setUp);
  api.runtime.onStartup.addListener(setUp);
  api.permissions.onAdded.addListener(function () {
    syncSites();
  });
  api.permissions.onRemoved.addListener(function () {
    syncSites();
  });

  api.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId !== MENU_ID) return;
    var pageUrl = info.pageUrl || (tab && tab.url) || '';
    var text = info.selectionText || info.linkText || info.linkUrl || '';
    openReport({
      kind: 'missed_spoiler',
      text: String(text).slice(0, 500),
      url: info.linkUrl || pageUrl,
      site: siteOf(pageUrl),
    });
  });

  api.runtime.onMessage.addListener(function (message, sender) {
    if (!message || message.type !== 'spoiler-shield:open-report' || !message.report) return;
    // Only accept reports from our own content scripts.
    if (sender.id !== api.runtime.id) return;
    var report = message.report;
    openReport({
      kind: report.kind === 'false_alarm' ? 'false_alarm' : 'missed_spoiler',
      pack: report.pack,
      chapter: report.chapter,
      text: String(report.text || '').slice(0, 500),
      url: report.url,
      site: report.site,
    });
  });
})();
