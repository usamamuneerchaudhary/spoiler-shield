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
  var CATALOG_VERSION = 1;

  var LIMITS = {
    maxTermWords: 6,
    minTermLength: 3,
    maxTermLength: 60,
    maxTotalTerms: 5000,
    maxChapters: 100,
    maxPacks: 200,
  };

  var ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
  var HASH = /^([1-6]):([0-9a-f]{14})$/;
  var KINDS = ['game', 'show', 'film', 'book', 'other'];
  var UNITS = ['chapter', 'episode', 'season', 'part', 'book', 'act'];

  /**
   * Lower-case, strip accents, and turn every run of punctuation or
   * whitespace into a single space. "GTA-6's ÉNDING!" -> "gta 6 s ending"
   */
  function normalize(input) {
    if (input == null) return '';
    return String(input)
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
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
   * cyrb53: a fast, well-distributed 53-bit string hash (public domain,
   * by bryc). Used so spoiler lists can be published without being readable.
   * It is not encryption: anyone can hash a guess and compare.
   */
  function cyrb53(text, seed) {
    var h1 = 0xdeadbeef ^ seed;
    var h2 = 0x41c6ce57 ^ seed;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  function hashNormalized(normalized, seed) {
    var words = normalized.split(' ').length;
    return words + ':' + cyrb53(normalized, seed).toString(16).padStart(14, '0');
  }

  /** Hash a phrase the way hashed rules store it: "<word count>:<14 hex digits>". */
  function hashPhrase(phrase, seed) {
    return hashNormalized(normalize(phrase), seed);
  }

  function decodeBase64(text) {
    var binary = atob(text);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  /**
   * A chapter's title. Titles can be stored base64-encoded (`titleEncoded`)
   * so the name of a late chapter isn't readable at a glance in the repo.
   */
  function chapterTitle(chapter) {
    if (!chapter) return '';
    if (typeof chapter.title === 'string') return chapter.title;
    if (typeof chapter.titleEncoded === 'string') {
      try {
        return decodeBase64(chapter.titleEncoded);
      } catch (error) {
        return '';
      }
    }
    return '';
  }

  /**
   * Check that a bundle (one game, show or book) has the expected shape.
   * Bundles can be fetched from the network, so they are treated as untrusted
   * data: only plain strings and hashes are accepted (no regular expressions, no code).
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

    var game = bundle.game;
    if (!isPlainObject(game) || typeof game.name !== 'string' || !game.name.trim()) {
      fail('game.name must be a non-empty string');
    } else {
      if (game.id !== undefined && (typeof game.id !== 'string' || !ID.test(game.id))) {
        fail('game.id must be lower-case letters, numbers and dashes');
      }
      if (game.kind !== undefined && KINDS.indexOf(game.kind) === -1) {
        fail('game.kind must be one of: ' + KINDS.join(', '));
      }
      if (game.unit !== undefined && UNITS.indexOf(game.unit) === -1) {
        fail('game.unit must be one of: ' + UNITS.join(', '));
      }
    }

    var chapters = bundle.chapters;
    if (!Array.isArray(chapters) || chapters.length === 0) {
      fail('chapters must be a non-empty array');
      chapters = [];
    } else if (chapters.length > LIMITS.maxChapters) {
      fail('too many chapters (max ' + LIMITS.maxChapters + ')');
    }
    chapters.forEach(function (chapter, index) {
      var where = 'chapters[' + index + ']';
      if (!isPlainObject(chapter)) {
        fail(where + ' must be an object');
        return;
      }
      if (chapter.id !== index + 1) {
        fail(where + '.id must be ' + (index + 1) + ' (ids are 1, 2, 3, ... in order)');
      }
      var hasTitle = typeof chapter.title === 'string' && chapter.title.trim();
      var hasEncoded = typeof chapter.titleEncoded === 'string' && chapterTitle(chapter).trim();
      if (!hasTitle && !hasEncoded) {
        fail(where + ' needs a non-empty title or titleEncoded');
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
    var usesHashes = false;

    bundle.rules.forEach(function (rule, index) {
      var where = 'rules[' + index + ']';
      if (!isPlainObject(rule)) {
        fail(where + ' must be an object');
        return;
      }
      if (typeof rule.id !== 'string' || !ID.test(rule.id)) {
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

      var hasTerms = rule.terms !== undefined;
      var hasHashes = rule.hashes !== undefined;
      if (!hasTerms && !hasHashes) {
        fail(where + ' needs "terms" or "hashes"');
        return;
      }

      if (hasTerms) {
        if (!Array.isArray(rule.terms) || rule.terms.length === 0) {
          fail(where + '.terms must be a non-empty array');
        } else {
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
        }
      }

      if (hasHashes) {
        usesHashes = true;
        if (!Array.isArray(rule.hashes) || rule.hashes.length === 0) {
          fail(where + '.hashes must be a non-empty array');
        } else {
          rule.hashes.forEach(function (hash, hashIndex) {
            if (typeof hash !== 'string' || !HASH.test(hash)) {
              fail(where + '.hashes[' + hashIndex + '] must look like "2:0123456789abcd" (made by npm run spoiler)');
            }
            totalTerms += 1;
          });
        }
      }
    });

    if (usesHashes && !(Number.isInteger(bundle.hashSeed) && bundle.hashSeed >= 0 && bundle.hashSeed <= 2147483647)) {
      fail('hashSeed must be a whole number from 0 to 2147483647 when rules use hashes');
    }
    if (totalTerms > LIMITS.maxTotalTerms) {
      fail('too many terms in total (max ' + LIMITS.maxTotalTerms + ')');
    }
    if (needsTopics && (!Array.isArray(bundle.topics) || bundle.topics.length === 0)) {
      fail('topics must list at least one phrase when any rule requires a topic');
    }

    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * Check a catalog: several bundles ("packs") published together.
   * Every pack needs a unique game.id.
   */
  function validateCatalog(catalog) {
    if (!isPlainObject(catalog)) return { ok: false, errors: ['catalog must be an object'] };
    var errors = [];
    if (catalog.catalogVersion !== CATALOG_VERSION) errors.push('catalogVersion must be ' + CATALOG_VERSION);
    if (!Array.isArray(catalog.packs) || catalog.packs.length === 0) {
      errors.push('packs must be a non-empty array');
      return { ok: false, errors: errors };
    }
    if (catalog.packs.length > LIMITS.maxPacks) errors.push('too many packs (max ' + LIMITS.maxPacks + ')');
    var seen = Object.create(null);
    catalog.packs.forEach(function (pack, index) {
      var id = pack && pack.game && pack.game.id;
      var label = typeof id === 'string' ? 'pack "' + id + '"' : 'packs[' + index + ']';
      if (typeof id !== 'string') {
        errors.push(label + ' needs game.id');
      } else if (seen[id]) {
        errors.push(label + ' appears more than once');
      }
      seen[id] = true;
      validateBundle(pack).errors.forEach(function (error) {
        errors.push(label + ': ' + error);
      });
    });
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
   * Call back with every run of 1..maxWords consecutive tokens, skipping tokens
   * that belong to a safe phrase ("no spoilers"). Return false to stop.
   */
  function forEachGram(tokens, blocked, maxWords, callback) {
    for (var start = 0; start < tokens.length; start++) {
      if (blocked[start]) continue;
      var gram = '';
      for (var size = 1; size <= maxWords && start + size <= tokens.length; size++) {
        var index = start + size - 1;
        if (blocked[index]) break;
        gram = size === 1 ? tokens[index] : gram + ' ' + tokens[index];
        if (callback(gram, size) === false) return;
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
    var seed = bundle.hashSeed || 0;

    // phrase or hash -> rules that use it, keeping only rules still ahead of the reader
    var terms = new Map();
    var hashes = new Map();
    var hashedWordCounts = [];
    var maxWords = 0;

    function add(map, key, entry) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }

    bundle.rules.forEach(function (rule) {
      var chapter = rule.chapter === 'last' ? chapterCount : rule.chapter;
      if (chapter <= progress) return;
      var entry = { id: rule.id, chapter: chapter, requiresTopic: rule.requiresTopic !== false };
      (rule.terms || []).forEach(function (term) {
        var normalized = normalize(term);
        maxWords = Math.max(maxWords, normalized.split(' ').length);
        add(terms, normalized, entry);
      });
      (rule.hashes || []).forEach(function (hash) {
        var words = Number(HASH.exec(hash)[1]);
        maxWords = Math.max(maxWords, words);
        hashedWordCounts[words] = true;
        add(hashes, hash, entry);
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
      if (!terms.size && !hashes.size) return result;

      var tokens = tokenize(text);
      if (!tokens.length) return result;

      var blocked = blockSafePhrases(tokens);
      var topicKnown = null;
      var ruleIds = new Set();

      function consider(entries) {
        if (!entries) return;
        entries.forEach(function (entry) {
          if (entry.requiresTopic) {
            if (topicKnown === null) topicKnown = mentionsTopic(tokens);
            if (!topicKnown) return;
          }
          ruleIds.add(entry.id);
          if (result.chapter === null || entry.chapter < result.chapter) result.chapter = entry.chapter;
        });
      }

      forEachGram(tokens, blocked, maxWords, function (gram, size) {
        consider(terms.get(gram));
        if (hashes.size && hashedWordCounts[size]) consider(hashes.get(hashNormalized(gram, seed)));
      });

      result.ruleIds = Array.from(ruleIds);
      result.isSpoiler = result.ruleIds.length > 0;
      return result;
    }

    return {
      match: match,
      progress: progress,
      chapterCount: chapterCount,
      activeTermCount: terms.size + hashes.size,
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    CATALOG_VERSION: CATALOG_VERSION,
    LIMITS: LIMITS,
    KINDS: KINDS,
    UNITS: UNITS,
    normalize: normalize,
    tokenize: tokenize,
    hashPhrase: hashPhrase,
    encodeTitle: encodeBase64,
    chapterTitle: chapterTitle,
    validateBundle: validateBundle,
    validateCatalog: validateCatalog,
    compile: compile,
  };
});
