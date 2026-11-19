/**
 * Site adapters: which elements count as one "item" on each site, where to
 * read its text, and what to blur.
 *
 * Sites change their markup often. When an item slips through, the fix is
 * usually a new selector here. Each adapter can define:
 *   selector       CSS selector for items
 *   textRoot(el)   element whose text is checked (default: the item)
 *   extraText(el)  extra text, e.g. from attributes
 *   target(el)     { el, mode } to blur; mode "overlay" (default) or "bar"
 *   alsoHide(el)   more elements to blur with the item
 *   onHide(el)     side effect when hidden; may return a cleanup function
 *   attributes     extra attribute names to watch for changes
 */
(function (root) {
  'use strict';

  function own(el, childSelector) {
    return el.querySelector(':scope > ' + childSelector);
  }

  var youtube = {
    id: 'youtube',
    name: 'YouTube',
    hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com'],
    selector: [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-playlist-video-renderer',
      'ytd-playlist-panel-video-renderer',
      'ytd-reel-item-renderer',
      'ytd-post-renderer',
      'ytd-comment-view-model',
      'ytd-comment-renderer',
      'ytd-watch-metadata',
      'yt-lockup-view-model',
      'ytm-shorts-lockup-view-model',
      'ytm-video-with-context-renderer',
      'ytm-compact-video-renderer',
      'ytm-comment-renderer',
    ].join(','),
    alsoHide: function (el) {
      if (el.tagName !== 'YTD-WATCH-METADATA') return [];
      return [document.querySelector('#movie_player')];
    },
    onHide: function (el) {
      if (el.tagName !== 'YTD-WATCH-METADATA') return null;
      var video = document.querySelector('#movie_player video');
      if (!video) return null;
      function keepPaused() {
        video.pause();
      }
      keepPaused();
      video.addEventListener('play', keepPaused, true);
      return function () {
        video.removeEventListener('play', keepPaused, true);
      };
    },
  };

  var reddit = {
    id: 'reddit',
    name: 'Reddit',
    hosts: ['reddit.com', 'www.reddit.com', 'new.reddit.com', 'old.reddit.com', 'sh.reddit.com'],
    selector: 'shreddit-post, shreddit-comment, .thing.link, .thing.comment',
    attributes: ['post-title'],
    textRoot: function (el) {
      if (el.tagName === 'SHREDDIT-COMMENT') return own(el, '[slot="comment"]') || el;
      if (el.classList.contains('comment')) return own(el, '.entry') || el;
      return el;
    },
    extraText: function (el) {
      return el.getAttribute('post-title') || '';
    },
    target: function (el) {
      if (el.tagName === 'SHREDDIT-POST') {
        var article = el.parentElement && el.parentElement.tagName === 'ARTICLE' ? el.parentElement : null;
        return article ? { el: article, mode: 'overlay' } : { el: el, mode: 'bar' };
      }
      if (el.tagName === 'SHREDDIT-COMMENT') {
        var body = own(el, '[slot="comment"]');
        return body ? { el: body, mode: 'overlay' } : { el: el, mode: 'bar' };
      }
      if (el.classList.contains('comment')) return { el: own(el, '.entry') || el, mode: 'overlay' };
      return { el: el, mode: 'overlay' };
    },
  };

  var x = {
    id: 'x',
    name: 'X',
    hosts: ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
    selector: 'article[data-testid="tweet"], [data-testid="trend"]',
  };

  var sites = [youtube, reddit, x];

  function forHost(hostname) {
    var host = String(hostname || '').toLowerCase();
    for (var i = 0; i < sites.length; i++) {
      if (sites[i].hosts.indexOf(host) !== -1) return sites[i];
    }
    return null;
  }

  root.SpoilerShieldSites = { all: sites, forHost: forHost };
})(typeof globalThis !== 'undefined' ? globalThis : this);
