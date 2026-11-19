/**
 * Which sites the shield runs on. YouTube, Reddit and X are declared in the
 * manifest. Twitch, TikTok and Google are optional: the user turns them on in
 * the popup, which asks for that site's permission, and the background script
 * then registers the content scripts for it.
 */
(function (root) {
  'use strict';

  var GOOGLE_DOMAINS = [
    'com', 'co.uk', 'ca', 'com.au', 'co.nz', 'ie', 'co.in', 'com.pk', 'com.sg', 'co.za', 'de', 'fr', 'es', 'it',
    'nl', 'be', 'ch', 'at', 'se', 'no', 'dk', 'fi', 'pl', 'pt', 'com.br', 'com.mx', 'com.ar', 'co.jp', 'co.kr',
    'com.tr', 'ae',
  ];

  var OPTIONAL = {
    twitch: {
      name: 'Twitch',
      origins: ['https://www.twitch.tv/*', 'https://m.twitch.tv/*'],
      matches: ['https://www.twitch.tv/*', 'https://m.twitch.tv/*'],
    },
    tiktok: {
      name: 'TikTok',
      origins: ['https://www.tiktok.com/*'],
      matches: ['https://www.tiktok.com/*'],
    },
    google: {
      name: 'Google Search',
      origins: GOOGLE_DOMAINS.map(function (domain) {
        return 'https://www.google.' + domain + '/*';
      }),
      matches: GOOGLE_DOMAINS.map(function (domain) {
        return 'https://www.google.' + domain + '/search*';
      }),
    },
  };

  /** The same scripts the manifest injects on YouTube, Reddit and X. */
  var CONTENT_JS = [
    'vendor/matcher.js',
    'data/catalog.js',
    'config.js',
    'shared/settings.js',
    'content/sites.js',
    'content/shield-core.js',
    'content/main.js',
  ];
  var CONTENT_CSS = ['content/shield.css'];

  /** Pages where "Report as spoiler" appears in the right-click menu. */
  var REPORT_PATTERNS = [
    'https://www.youtube.com/*',
    'https://m.youtube.com/*',
    'https://*.reddit.com/*',
    'https://x.com/*',
    'https://twitter.com/*',
  ].concat(OPTIONAL.twitch.matches, OPTIONAL.tiktok.matches, OPTIONAL.google.matches);

  root.SpoilerShieldSiteRegistry = {
    OPTIONAL: OPTIONAL,
    CONTENT_JS: CONTENT_JS,
    CONTENT_CSS: CONTENT_CSS,
    REPORT_PATTERNS: REPORT_PATTERNS,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
