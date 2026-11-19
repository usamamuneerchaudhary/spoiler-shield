/*!
 * spoiler-shield-matcher
 * Decide whether a piece of text spoils a story beyond the reader's progress.
 * MIT License. https://github.com/usamamuneerchaudhary/spoiler-shield
 *
 * This file has no dependencies and runs unchanged in Node (CommonJS),
 * in browser extensions (content scripts) and in plain <script> tags,
 * where it exposes `globalThis.SpoilerMatcher`.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SpoilerMatcher = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;

  var LIMITS = {
    maxTermWords: 6,
    minTermLength: 3,
    maxTermLength: 60,
    maxTotalTerms: 5000,
    maxChapters: 100,
  };

  var RULE_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;

  /**
   * Lower-case, strip accents, and turn every run of punctuation or
   * whitespace into a single space. "GTA-6's ÉNDING!" -> "gta 6 s ending"
   */
  function normalize(input) {
    if (input == null) return '';
    return String(input)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function tokenize(input) {
    var text = normalize(input);
    return text ? text.split(' ') : [];
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Check that a bundle has the expected shape. Bundles can be fetched from
   * the network, so they are treated as untrusted data: only plain strings
   * are accepted as terms (no regular expressions, no code).
   *
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateBundle(bundle) {
    var errors = [];
    function fail(message) {
      errors.push(message);
    }

    if (!isPlainObject(bundle)) {
      return { ok: false, errors: ['bundle must be an object'] };
    }
    if (bundle.schemaVersion !== SCHEMA_VERSION) {
      fail('schemaVersion must be ' + SCHEMA_VERSION);
    }

    if (!isPlainObject(bundle.game) || typeof bundle.game.name !== 'string') {
      fail('game.name must be a string');
    }

    var chapters = bundle.chapters;
    if (!Array.isArray(chapters) || chapters.length === 0) {
      fail('chapters must be a non-empty array');
      chapters = [];
    } else if (chapters.length > LIMITS.maxChapters) {
      fail('too many chapters (max ' + LIMITS.maxChapters + ')');
    }
    chapters.forEach(function (chapter, index) {
      if (!isPlainObject(chapter)) {
        fail('chapters[' + index + '] must be an object');
        return;
      }
      if (chapter.id !== index + 1) {
        fail('chapters[' + index + '].id must be ' + (index + 1) + ' (ids are 1, 2, 3, ... in order)');
      }
      if (typeof chapter.title !== 'string' || !chapter.title.trim()) {
        fail('chapters[' + index + '].title must be a non-empty string');
      }
    });

    ['topics', 'safePhrases'].forEach(function (key) {
      var list = bundle[key];
      if (list === undefined) return;
      if (!Array.isArray(list)) {
        fail(key + ' must be an array of strings');
        return;
      }
      list.forEach(function (phrase, index) {
        if (typeof phrase !== 'string' || !normalize(phrase)) {
          fail(key + '[' + index + '] must be a non-empty string');
        }
      });
    });

    if (!Array.isArray(bundle.rules)) {
      fail('rules must be an array');
      return { ok: errors.length === 0, errors: errors };
    }

    var seenIds = Object.create(null);
    var totalTerms = 0;
    var needsTopics = false;

    bundle.rules.forEach(function (rule, index) {
      var where = 'rules[' + index + ']';
      if (!isPlainObject(rule)) {
        fail(where + ' must be an object');
        return;
      }
      if (typeof rule.id !== 'string' || !RULE_ID.test(rule.id)) {
        fail(where + '.id must be lower-case letters, numbers and dashes');
      } else if (seenIds[rule.id]) {
        fail(where + '.id "' + rule.id + '" is used more than once');
      } else {
        seenIds[rule.id] = true;
        where = 'rule "' + rule.id + '"';
      }

      var chapterOk =
        rule.chapter === 'last' ||
        (Number.isInteger(rule.chapter) && rule.chapter >= 1 && rule.chapter <= chapters.length);
      if (!chapterOk) {
        fail(where + '.chapter must be "last" or a chapter id between 1 and ' + chapters.length);
      }

      if (rule.requiresTopic !== undefined && typeof rule.requiresTopic !== 'boolean') {
        fail(where + '.requiresTopic must be true or false');
      }
      if (rule.requiresTopic !== false) needsTopics = true;

      if (!Array.isArray(rule.terms) || rule.terms.length === 0) {
        fail(where + '.terms must be a non-empty array');
        return;
      }
      rule.terms.forEach(function (term, termIndex) {
        var label = where + '.terms[' + termIndex + ']';
        if (typeof term !== 'string') {
          fail(label + ' must be a string');
          return;
        }
        var normalized = normalize(term);
        if (normalized.length < LIMITS.minTermLength) {
          fail(label + ' is too short (min ' + LIMITS.minTermLength + ' characters)');
        }
        if (normalized.length > LIMITS.maxTermLength) {
          fail(label + ' is too long (max ' + LIMITS.maxTermLength + ' characters)');
        }
        if (normalized.split(' ').length > LIMITS.maxTermWords) {
          fail(label + ' has too many words (max ' + LIMITS.maxTermWords + ')');
        }
        totalTerms += 1;
      });
    });

    if (totalTerms > LIMITS.maxTotalTerms) {
      fail('too many terms in total (max ' + LIMITS.maxTotalTerms + ')');
    }
    if (needsTopics && (!Array.isArray(bundle.topics) || bundle.topics.length === 0)) {
      fail('topics must list at least one phrase when any rule requires a topic');
    }

    return { ok: errors.length === 0, errors: errors };
  }

  function toPhraseSet(list) {
    var set = new Set();
    var maxWords = 0;
    (list || []).forEach(function (phrase) {
      var normalized = normalize(phrase);
      if (!normalized) return;
      set.add(normalized);
      maxWords = Math.max(maxWords, normalized.split(' ').length);
    });
    return { set: set, maxWords: maxWords };
  }

  /**
   * Yield every run of 1..maxWords consecutive tokens, skipping tokens that
   * belong to a safe phrase ("no spoilers").
   */
  function forEachGram(tokens, blocked, maxWords, callback) {
    for (var start = 0; start < tokens.length; start++) {
      if (blocked[start]) continue;
      var gram = '';
      for (var size = 1; size <= maxWords && start + size <= tokens.length; size++) {
        var index = start + size - 1;
        if (blocked[index]) break;
        gram = size === 1 ? tokens[index] : gram + ' ' + tokens[index];
        if (callback(gram) === false) return;
      }
    }
  }

  /**
   * Compile a bundle into a fast matcher for one reader.
   *
   * @param {object} bundle   A bundle that passes validateBundle().
   * @param {object} [options]
   * @param {number} [options.progress=0] Chapters the reader has finished (0..chapters.length).
   */
  function compile(bundle, options) {
    var check = validateBundle(bundle);
    if (!check.ok) {
      throw new Error('Invalid spoiler bundle:\n- ' + check.errors.join('\n- '));
    }

    var chapterCount = bundle.chapters.length;
    var progress = Number(options && options.progress) || 0;
    progress = Math.max(0, Math.min(chapterCount, Math.floor(progress)));

    var topics = toPhraseSet(bundle.topics);
    var safe = toPhraseSet(bundle.safePhrases);

    // term -> list of rules that use it, keeping only rules still ahead of the reader
    var terms = new Map();
    var maxWords = 0;

    bundle.rules.forEach(function (rule) {
      var chapter = rule.chapter === 'last' ? chapterCount : rule.chapter;
      if (chapter <= progress) return;
      var entry = {
        id: rule.id,
        chapter: chapter,
        requiresTopic: rule.requiresTopic !== false,
      };
      rule.terms.forEach(function (term) {
        var normalized = normalize(term);
        maxWords = Math.max(maxWords, normalized.split(' ').length);
        if (!terms.has(normalized)) terms.set(normalized, []);
        terms.get(normalized).push(entry);
      });
    });

    function blockSafePhrases(tokens) {
      var blocked = new Array(tokens.length);
      if (!safe.set.size) return blocked;
      for (var start = 0; start < tokens.length; start++) {
        var gram = '';
        for (var size = 1; size <= safe.maxWords && start + size <= tokens.length; size++) {
          gram = size === 1 ? tokens[start] : gram + ' ' + tokens[start + size - 1];
          if (safe.set.has(gram)) {
            for (var i = start; i < start + size; i++) blocked[i] = true;
          }
        }
      }
      return blocked;
    }

    function mentionsTopic(tokens) {
      var found = false;
      forEachGram(tokens, [], topics.maxWords, function (gram) {
        if (topics.set.has(gram)) {
          found = true;
          return false;
        }
      });
      return found;
    }

    /**
     * @returns {{ isSpoiler: boolean, chapter: number|null, ruleIds: string[] }}
     *   `chapter` is the earliest chapter the text spoils. The matched words
     *   are deliberately not returned, so a UI cannot leak them.
     */
    function match(text) {
      var result = { isSpoiler: false, chapter: null, ruleIds: [] };
      if (!terms.size) return result;

      var tokens = tokenize(text);
      if (!tokens.length) return result;

      var blocked = blockSafePhrases(tokens);
      var topicKnown = null;
      var ruleIds = new Set();

      forEachGram(tokens, blocked, maxWords, function (gram) {
        var entries = terms.get(gram);
        if (!entries) return;
        entries.forEach(function (entry) {
          if (entry.requiresTopic) {
            if (topicKnown === null) topicKnown = mentionsTopic(tokens);
            if (!topicKnown) return;
          }
          ruleIds.add(entry.id);
          if (result.chapter === null || entry.chapter < result.chapter) {
            result.chapter = entry.chapter;
          }
        });
      });

      result.ruleIds = Array.from(ruleIds);
      result.isSpoiler = result.ruleIds.length > 0;
      return result;
    }

    return {
      match: match,
      progress: progress,
      chapterCount: chapterCount,
      activeTermCount: terms.size,
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    LIMITS: LIMITS,
    normalize: normalize,
    tokenize: tokenize,
    validateBundle: validateBundle,
    compile: compile,
  };
});
