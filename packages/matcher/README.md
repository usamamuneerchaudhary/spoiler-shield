# spoiler-shield-matcher

A tiny, dependency-free engine that decides whether a piece of text spoils a story beyond the reader's progress. It powers the [Spoiler Shield](https://github.com/usamamuneerchaudhary/spoiler-shield) browser extension, and works for any game, show or book.

- Whole-word, case-, accent- and punctuation-insensitive phrase matching
- Chapter-aware: spoilers from chapters the reader has finished are allowed
- Topic gating: common words only count when the text is about your story
- Safe phrases ("no spoilers") are ignored
- Hashed phrases, so a published list doesn't spoil anyone who opens it
- Validates untrusted lists: plain strings and hashes only, no regular expressions or code
- Never returns the matched words, so your UI can't leak them
- Runs in Node (CommonJS), browser extensions and plain `<script>` tags, with TypeScript types

## Install

```bash
npm install spoiler-shield-matcher
```

## Usage

```js
const { compile } = require('spoiler-shield-matcher');

const bundle = {
  schemaVersion: 1,
  game: { name: 'Neon Harbor' },
  topics: ['neon harbor', 'neonharbor'],
  safePhrases: ['no spoilers'],
  chapters: [
    { id: 1, title: 'The Docks' },
    { id: 2, title: 'Night Market' },
    { id: 3, title: 'Last Tide' },
  ],
  rules: [
    { id: 'ch2-llama', chapter: 2, terms: ['purple llama'] },
    { id: 'ending', chapter: 'last', terms: ['ending', 'who dies'] },
  ],
};

const matcher = compile(bundle, { progress: 1 }); // finished chapter 1

matcher.match('Neon Harbor: the purple llama fight');
// { isSpoiler: true, chapter: 2, ruleIds: ['ch2-llama'] }

matcher.match('Neon Harbor review (no spoilers)');
// { isSpoiler: false, chapter: null, ruleIds: [] }

matcher.match('That film had a great ending');
// { isSpoiler: false, ... }  (not about Neon Harbor)
```

In a browser, load `src/matcher.js` with a `<script>` tag and use `window.SpoilerMatcher`.

## API

### `compile(bundle, { progress })`

Returns a matcher for one reader. `progress` is how many chapters they have finished (`0` to `chapters.length`). Throws if the bundle is invalid.

- `matcher.match(text)` returns `{ isSpoiler, chapter, ruleIds }`, where `chapter` is the earliest chapter the text spoils.
- `matcher.activeTermCount` is the number of phrases still hidden at this progress.

### `validateBundle(bundle)`

Returns `{ ok, errors }`. Use it before trusting a bundle you downloaded.

### `validateCatalog(catalog)`

Checks a catalog: `{ catalogVersion: 1, packs: [bundle, ...] }`, several bundles published together, each with a unique `game.id`.

### `hashPhrase(phrase, seed)`

Returns the stored form of a hashed phrase, e.g. `"3:0f1e2d3c4b5a69"`: the word count, then a 53-bit [cyrb53](https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js) hash of the normalised phrase. Put these in a rule's `hashes` and set the bundle's `hashSeed`. Hashing keeps lists unreadable at a glance; it is not encryption.

### `encodeTitle(title)` and `chapterTitle(chapter)`

Store a chapter name base64-encoded (`titleEncoded`) and read it back.

### `normalize(text)` and `tokenize(text)`

The text clean-up used for matching: `normalize("GTA-6's ÉNDING!")` gives `"gta 6 s ending"`.

## Bundle format

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | `1` | Format version |
| `game.name` | string | Display name |
| `game.id` | string | Optional; required inside a catalog |
| `game.kind` / `game.unit` | string | Optional: `game`, `show`, ... / `chapter`, `episode`, `season`, ... |
| `hashSeed` | integer | Required when any rule uses `hashes` |
| `topics` | string[] | Phrases that show a text is about this story |
| `safePhrases` | string[] | Phrases removed before matching |
| `chapters` | `{ id, title or titleEncoded, placeholder? }[]` | In story order, ids 1, 2, 3 ... |
| `rules[].id` | string | Lower-case letters, numbers and dashes |
| `rules[].chapter` | number or `"last"` | Where the spoiler happens |
| `rules[].terms` | string[] | Plain phrases, up to 6 words each |
| `rules[].hashes` | string[] | Hashed phrases from `hashPhrase()` (a rule needs `terms`, `hashes` or both) |
| `rules[].requiresTopic` | boolean | Default `true`: only match when a topic phrase is present |

## Licence

MIT
