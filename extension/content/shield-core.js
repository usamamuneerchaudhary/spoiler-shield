/**
 * Spoiler Shield core: finds items on a page, asks the matcher about their
 * text, and blurs the ones that spoil. Knows nothing about browser-extension
 * APIs, so the same code runs in the extension and in demo/index.html.
 *
 * Usage:
 *   const shield = SpoilerShieldCore.create({ adapter, getMatcher, describe });
 *   shield.start();
 */
(function (root) {
  'use strict';

  var CLASS = {
    blurred: 'ss-blurred',
    blurredHost: 'ss-blurred-host',
    relative: 'ss-relative',
    overlay: 'ss-overlay',
    bar: 'ss-bar',
  };

  var TEXT_ATTRIBUTES = ['title', 'aria-label', 'alt'];
  var MAX_ATTRIBUTE_NODES = 60;
  var STOPPED_EVENTS = ['click', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'dblclick'];

  function isOurs(node) {
    return (
      node.nodeType === 1 &&
      (node.classList.contains(CLASS.overlay) || node.classList.contains(CLASS.bar))
    );
  }

  /** Text of an element, skipping our own overlays and invisible code. */
  function collectText(element) {
    var doc = element.ownerDocument;
    var walker = doc.createTreeWalker(element, 1 | 4, {
      acceptNode: function (node) {
        if (node.nodeType === 1) {
          if (isOurs(node)) return 2; // FILTER_REJECT: skip the whole subtree
          var tag = node.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE' || tag === 'NOSCRIPT') return 2;
          return 3; // FILTER_SKIP: look inside
        }
        return 1; // FILTER_ACCEPT text nodes
      },
    });
    var parts = [];
    var node;
    while ((node = walker.nextNode())) parts.push(node.nodeValue);
    return parts.join(' ');
  }

  /**
   * Label for the earliest chapter a match spoils. Only the number is shown:
   * the name of a chapter the reader hasn't reached could be a spoiler itself.
   */
  function describe(chapters, chapter) {
    if (!chapter) return 'Story spoiler';
    if (chapter >= chapters.length) return 'Ending / late story';
    return 'Chapter ' + chapter + ' or later';
  }

  function create(options) {
    var adapter = options.adapter;
    var doc = options.document || root.document;
    var selector = adapter.selector;
    var getMatcher = options.getMatcher;
    var describeResult = options.describe || function () { return 'Story spoiler'; };
    var onChange = options.onChange || function () {};

    var state = new WeakMap();
    var hidden = new Set();
    var version = 0;
    var observer = null;

    function textOf(candidate) {
      var source = adapter.textRoot ? adapter.textRoot(candidate) : candidate;
      if (!source) return '';
      var parts = [collectText(source)];

      var attributeNodes = [source].concat(
        Array.prototype.slice.call(source.querySelectorAll('[title],[aria-label],img[alt]'), 0, MAX_ATTRIBUTE_NODES)
      );
      attributeNodes.forEach(function (node) {
        if (isOurs(node) || (node.closest && node.closest('.' + CLASS.overlay + ',.' + CLASS.bar))) return;
        TEXT_ATTRIBUTES.forEach(function (name) {
          var value = node.getAttribute && node.getAttribute(name);
          if (value) parts.push(value);
        });
      });

      if (adapter.extraText) {
        var extra = adapter.extraText(candidate);
        if (extra) parts.push(extra);
      }
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }

    function stopEvent(event) {
      event.stopPropagation();
      if (event.type !== 'touchstart' && event.type !== 'touchend') event.preventDefault();
    }

    function makeNotice(className, label, candidate) {
      var notice = doc.createElement('div');
      notice.className = className;
      notice.setAttribute('role', 'group');
      notice.setAttribute('aria-label', 'Hidden by Spoiler Shield');
      notice.title = 'Spoiler Shield hid this because it may spoil: ' + label + '. Click Reveal to show it.';

      var text = doc.createElement('span');
      text.className = 'ss-text';
      var strong = doc.createElement('strong');
      strong.textContent = 'Spoiler hidden';
      var meta = doc.createElement('span');
      meta.className = 'ss-meta';
      meta.textContent = label;
      text.appendChild(strong);
      text.appendChild(meta);

      var button = doc.createElement('button');
      button.type = 'button';
      button.className = 'ss-reveal';
      button.textContent = 'Reveal';

      notice.appendChild(text);
      notice.appendChild(button);

      // Let the Reveal button handle its own click, then stop the event at the
      // notice so the site underneath never sees it (no navigation, no likes).
      button.addEventListener('click', function () {
        reveal(candidate);
      });
      STOPPED_EVENTS.forEach(function (type) {
        notice.addEventListener(type, stopEvent);
      });
      return notice;
    }

    function cover(target, mode, label, candidate) {
      var notice;
      if (mode === 'bar' && target.parentNode) {
        notice = makeNotice(CLASS.bar, label, candidate);
        target.classList.add(CLASS.blurredHost);
        target.parentNode.insertBefore(notice, target);
        return { target: target, notice: notice, classes: [CLASS.blurredHost] };
      }
      notice = makeNotice(CLASS.overlay, label, candidate);
      var classes = [CLASS.blurred];
      var view = doc.defaultView;
      if (view && view.getComputedStyle(target).position === 'static') classes.push(CLASS.relative);
      classes.forEach(function (name) {
        target.classList.add(name);
      });
      target.appendChild(notice);
      return { target: target, notice: notice, classes: classes };
    }

    function uncover(covering) {
      covering.classes.forEach(function (name) {
        covering.target.classList.remove(name);
      });
      if (covering.notice.parentNode) covering.notice.parentNode.removeChild(covering.notice);
    }

    function insideCovered(element) {
      var parent = element.parentElement;
      return !!(parent && parent.closest('.' + CLASS.blurred + ',.' + CLASS.blurredHost));
    }

    function hide(candidate, result) {
      var plan = adapter.target ? adapter.target(candidate) : null;
      var target = (plan && plan.el) || candidate;
      var mode = (plan && plan.mode) || (target.shadowRoot ? 'bar' : 'overlay');

      // An outer item is already blurred: it covers this one too.
      if (insideCovered(target)) return { covered: true, coverings: [], cleanups: [] };

      // This item covers inner items that were blurred on their own.
      Array.prototype.forEach.call(target.querySelectorAll(selector), function (inner) {
        var innerState = state.get(inner);
        if (innerState && innerState.hidden && !innerState.hidden.covered) {
          release(innerState.hidden);
          innerState.hidden = { covered: true, coverings: [], cleanups: [] };
          hidden.delete(inner);
        }
      });

      var label = describeResult(result);
      var coverings = [cover(target, mode, label, candidate)];
      var cleanups = [];

      if (adapter.alsoHide) {
        (adapter.alsoHide(candidate) || []).forEach(function (extra) {
          if (extra && extra !== target && !extra.classList.contains(CLASS.blurred)) {
            coverings.push(cover(extra, 'overlay', label, candidate));
          }
        });
      }
      if (adapter.onHide) {
        var cleanup = adapter.onHide(candidate);
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      }

      hidden.add(candidate);
      return { covered: false, coverings: coverings, cleanups: cleanups };
    }

    function release(hiddenState) {
      hiddenState.coverings.forEach(uncover);
      hiddenState.cleanups.forEach(function (cleanup) {
        try {
          cleanup();
        } catch (error) {
          /* ignore */
        }
      });
    }

    function evaluate(candidate) {
      if (!candidate.isConnected) return;
      var text = textOf(candidate);
      var previous = state.get(candidate);
      if (previous && previous.text === text && previous.version === version) return;

      var sameText = !!(previous && previous.text === text);
      var revealed = sameText && previous.revealed;
      if (previous && previous.hidden) {
        release(previous.hidden);
        hidden.delete(candidate);
      }

      var matcher = getMatcher();
      var result = !revealed && matcher && text ? matcher.match(text) : null;
      var nowHidden = result && result.isSpoiler ? hide(candidate, result) : null;
      state.set(candidate, { text: text, version: version, revealed: revealed, hidden: nowHidden });

      // This item stopped covering inner items, so check them on their own again.
      var wasCovering = previous && previous.hidden && !previous.hidden.covered;
      if (wasCovering && !(nowHidden && !nowHidden.covered)) {
        Array.prototype.forEach.call(targetOf(candidate).querySelectorAll(selector), function (inner) {
          var innerState = state.get(inner);
          if (innerState && innerState.hidden && innerState.hidden.covered) {
            state.delete(inner);
            evaluate(inner);
          }
        });
      }
    }

    function targetOf(candidate) {
      var plan = adapter.target ? adapter.target(candidate) : null;
      return (plan && plan.el) || candidate;
    }

    function reveal(candidate) {
      var current = state.get(candidate);
      if (current && current.hidden) release(current.hidden);
      if (current) {
        current.hidden = null;
        current.revealed = true;
      }
      hidden.delete(candidate);

      // Inner items were covered by this one; show them too.
      Array.prototype.forEach.call(targetOf(candidate).querySelectorAll(selector), function (inner) {
        var innerState = state.get(inner);
        if (innerState) {
          if (innerState.hidden) release(innerState.hidden);
          innerState.hidden = null;
          innerState.revealed = true;
        }
        hidden.delete(inner);
      });
      onChange();
    }

    function collect(node, into, deep) {
      if (!node) return;
      if (node.nodeType === 3) node = node.parentElement;
      if (!node || node.nodeType !== 1 || isOurs(node)) return;
      var closest = node.closest(selector);
      if (closest) into.add(closest);
      if (deep) {
        Array.prototype.forEach.call(node.querySelectorAll(selector), function (element) {
          into.add(element);
        });
      }
    }

    function handleMutations(records) {
      var candidates = new Set();
      records.forEach(function (record) {
        if (record.type === 'childList') {
          collect(record.target, candidates, false);
          Array.prototype.forEach.call(record.addedNodes, function (node) {
            collect(node, candidates, true);
          });
        } else {
          collect(record.target, candidates, false);
        }
      });
      candidates.forEach(evaluate);
      if (candidates.size) onChange();
    }

    function scanAll() {
      Array.prototype.forEach.call(doc.querySelectorAll(selector), evaluate);
      onChange();
    }

    return {
      start: function () {
        if (observer) return;
        observer = new root.MutationObserver(handleMutations);
        observer.observe(doc.documentElement, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: TEXT_ATTRIBUTES.concat(adapter.attributes || []),
        });
        scanAll();
      },
      stop: function () {
        if (observer) observer.disconnect();
        observer = null;
        hidden.forEach(function (candidate) {
          var current = state.get(candidate);
          if (current && current.hidden) release(current.hidden);
          state.delete(candidate);
        });
        hidden.clear();
      },
      /** Re-check every item, e.g. after the reader's progress changed. */
      refresh: function () {
        version += 1;
        scanAll();
      },
      count: function () {
        hidden.forEach(function (candidate) {
          if (!candidate.isConnected) hidden.delete(candidate);
        });
        return hidden.size;
      },
      revealAll: function () {
        Array.from(hidden).forEach(reveal);
      },
    };
  }

  root.SpoilerShieldCore = { create: create, describe: describe, CLASS: CLASS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
