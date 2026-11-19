'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalize,
  tokenize,
  hashPhrase,
  encodeTitle,
  chapterTitle,
  validateBundle,
  validateCatalog,
  compile,
} = require('../src/matcher.js');

function bundle(overrides = {}) {
  return {
    schemaVersion: 1,
    game: { id: 'test', name: 'Test Game' },
    topics: ['test game', 'tg2'],
    safePhrases: ['no spoilers', 'spoiler free'],
    chapters: [
      { id: 1, title: 'One' },
      { id: 2, title: 'Two' },
      { id: 3, title: 'Three' },
    ],
    rules: [
      { id: 'llama', chapter: 2, terms: ['purple llama'], requiresTopic: false },
      { id: 'betrayal', chapter: 3, terms: ['betrays', 'betrayal'] },
      { id: 'ending', chapter: 'last', terms: ['ending', 'spoilers'] },
    ],
    ...overrides,
  };
}

test('normalize lower-cases, strips accents and punctuation', () => {
  assert.equal(normalize("GTA-6's ÉNDING!!"), 'gta 6 s ending');
  assert.equal(normalize('  #TG2   final\nmission '), 'tg2 final mission');
  assert.equal(normalize(null), '');
  assert.deepEqual(tokenize('Hello, World'), ['hello', 'world']);
});

test('hides a spoiler from a chapter the reader has not finished', () => {
  const matcher = compile(bundle(), { progress: 1 });
  const result = matcher.match('The PURPLE llama was there all along');
  assert.equal(result.isSpoiler, true);
  assert.equal(result.chapter, 2);
  assert.deepEqual(result.ruleIds, ['llama']);
});

test('shows a spoiler once the reader is past that chapter', () => {
  const matcher = compile(bundle(), { progress: 2 });
  assert.equal(matcher.match('the purple llama').isSpoiler, false);
});

test('"last" means hidden until the whole story is finished', () => {
  assert.equal(compile(bundle(), { progress: 2 }).match('Test Game ending explained').chapter, 3);
  assert.equal(compile(bundle(), { progress: 3 }).match('Test Game ending explained').isSpoiler, false);
});

test('rules that require a topic ignore text about other things', () => {
  const matcher = compile(bundle());
  assert.equal(matcher.match('The ending of this film was great').isSpoiler, false);
  assert.equal(matcher.match('Test Game: the ending was great').isSpoiler, true);
  assert.equal(matcher.match('#TG2 ending reaction').isSpoiler, true);
});

test('matches whole words only', () => {
  const matcher = compile(bundle());
  assert.equal(matcher.match('Test Game pending update, spending money').isSpoiler, false);
  assert.equal(matcher.match('Test Game: who betrays who?').isSpoiler, true);
});

test('safe phrases do not count as spoilers', () => {
  const matcher = compile(bundle());
  assert.equal(matcher.match('Test Game review (NO SPOILERS)').isSpoiler, false);
  assert.equal(matcher.match('Test Game review, spoiler-free').isSpoiler, false);
  assert.equal(matcher.match('Test Game review: no spoilers, but the ending...').isSpoiler, true);
});

test('reports the earliest chapter when several rules match', () => {
  const result = compile(bundle()).match('Test Game: the purple llama betrays you at the ending');
  assert.equal(result.chapter, 2);
  assert.deepEqual(result.ruleIds.sort(), ['betrayal', 'ending', 'llama']);
});

test('progress is clamped to the number of chapters', () => {
  assert.equal(compile(bundle(), { progress: -4 }).progress, 0);
  assert.equal(compile(bundle(), { progress: 99 }).progress, 3);
  assert.equal(compile(bundle(), { progress: 99 }).activeTermCount, 0);
});

test('empty and missing text is never a spoiler', () => {
  const matcher = compile(bundle());
  assert.equal(matcher.match('').isSpoiler, false);
  assert.equal(matcher.match(undefined).isSpoiler, false);
});

test('validateBundle accepts a good bundle', () => {
  assert.deepEqual(validateBundle(bundle()), { ok: true, errors: [] });
});

test('validateBundle explains what is wrong', () => {
  const bad = bundle({
    chapters: [{ id: 2, title: '' }],
    rules: [
      { id: 'Bad Id', chapter: 7, terms: ['ok term'] },
      { id: 'dup', chapter: 1, terms: ['ab'] },
      { id: 'dup', chapter: 1, terms: [42] },
    ],
  });
  const { ok, errors } = validateBundle(bad);
  assert.equal(ok, false);
  const text = errors.join('\n');
  assert.match(text, /chapters\[0\]\.id must be 1/);
  assert.match(text, /needs a non-empty title or titleEncoded/);
  assert.match(text, /\.id must be lower-case/);
  assert.match(text, /chapter must be "last" or a chapter id between 1 and 1/);
  assert.match(text, /too short/);
  assert.match(text, /used more than once/);
  assert.match(text, /must be a string/);
});

test('validateBundle rejects things that are not bundles', () => {
  assert.equal(validateBundle(null).ok, false);
  assert.equal(validateBundle([]).ok, false);
  assert.equal(validateBundle({ schemaVersion: 2 }).ok, false);
});

test('compile refuses an invalid bundle', () => {
  assert.throws(() => compile(bundle({ rules: 'nope' })), /Invalid spoiler bundle/);
});

test('hashPhrase normalises first and records the word count', () => {
  const hash = hashPhrase('The PURPLE llama!', 42);
  assert.match(hash, /^3:[0-9a-f]{14}$/);
  assert.equal(hashPhrase('the purple llama', 42), hash);
  assert.notEqual(hashPhrase('the purple llama', 43), hash, 'seed changes the hash');
});

test('hashed rules match like plain ones', () => {
  const seed = 1234;
  const hashed = bundle({
    hashSeed: seed,
    rules: [
      { id: 'llama', chapter: 2, hashes: [hashPhrase('purple llama', seed)], requiresTopic: false },
      { id: 'mixed', chapter: 3, terms: ['betrays'], hashes: [hashPhrase('lighthouse keeper', seed)] },
    ],
  });
  assert.deepEqual(validateBundle(hashed).errors, []);
  const matcher = compile(hashed, { progress: 1 });
  assert.equal(matcher.match('The Purple Llama is back').chapter, 2);
  assert.equal(matcher.match('Test Game: the lighthouse keeper').chapter, 3);
  assert.equal(matcher.match('the lighthouse keeper').isSpoiler, false, 'topic still required');
  assert.equal(matcher.match('a purple elephant').isSpoiler, false);
  assert.equal(compile(hashed, { progress: 2 }).match('purple llama').isSpoiler, false);
});

test('hashed rules need a seed and well-formed hashes', () => {
  const missingSeed = bundle({ rules: [{ id: 'x', chapter: 1, hashes: [hashPhrase('abc def', 1)] }] });
  assert.match(validateBundle(missingSeed).errors.join('\n'), /hashSeed/);
  const badHash = bundle({ hashSeed: 1, rules: [{ id: 'x', chapter: 1, hashes: ['not-a-hash'] }] });
  assert.match(validateBundle(badHash).errors.join('\n'), /must look like/);
  const empty = bundle({ rules: [{ id: 'x', chapter: 1 }] });
  assert.match(validateBundle(empty).errors.join('\n'), /needs "terms" or "hashes"/);
});

test('encoded chapter titles decode, including non-English text', () => {
  const chapter = { id: 1, titleEncoded: encodeTitle('Último capítulo: Café') };
  assert.equal(chapterTitle(chapter), 'Último capítulo: Café');
  assert.equal(chapterTitle({ id: 1, title: 'Plain' }), 'Plain');
  assert.equal(chapterTitle({ id: 1, titleEncoded: '%%%' }), '');
  const ok = bundle({ chapters: [{ id: 1, titleEncoded: encodeTitle('One') }], rules: [] });
  assert.equal(validateBundle(ok).ok, true);
  const bad = bundle({ chapters: [{ id: 1, titleEncoded: '' }], rules: [] });
  assert.match(validateBundle(bad).errors.join('\n'), /needs a non-empty title/);
});

test('game kind and unit are checked', () => {
  const good = bundle({ game: { id: 'show-x', name: 'Show X', kind: 'show', unit: 'episode' } });
  assert.equal(validateBundle(good).ok, true);
  const bad = bundle({ game: { id: 'Bad Id', name: 'X', kind: 'podcast', unit: 'scene' } });
  const text = validateBundle(bad).errors.join('\n');
  assert.match(text, /game\.id/);
  assert.match(text, /game\.kind/);
  assert.match(text, /game\.unit/);
});

test('validateCatalog checks every pack and unique ids', () => {
  const one = bundle({ game: { id: 'one', name: 'One' } });
  const two = bundle({ game: { id: 'two', name: 'Two' } });
  assert.deepEqual(validateCatalog({ catalogVersion: 1, packs: [one, two] }), { ok: true, errors: [] });

  const result = validateCatalog({ catalogVersion: 1, packs: [one, one, bundle({ game: { name: 'No id' }, rules: 'x' })] });
  assert.equal(result.ok, false);
  const text = result.errors.join('\n');
  assert.match(text, /pack "one" appears more than once/);
  assert.match(text, /packs\[2\] needs game\.id/);
  assert.match(text, /rules must be an array/);
  assert.equal(validateCatalog({ catalogVersion: 2, packs: [] }).ok, false);
  assert.equal(validateCatalog(null).ok, false);
});
