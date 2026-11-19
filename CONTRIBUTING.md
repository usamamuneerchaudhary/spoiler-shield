# Contributing to Spoiler Shield

Thanks for helping keep stories a surprise. Spoiler lists are unusual to work on because **the data itself is a spoiler**. The repo stores chapter spoilers as hashes so it spoils nothing, and this page explains how to keep it that way.

## Golden rules

1. **Never put a spoiler in anything readable.** That covers pull request titles, issue titles, commit messages, branch names, rule ids and notes. Write `Add GTA 6 chapter 3 spoilers`, not what happens in chapter 3. Rule ids work best as chapter plus a number: `ch03-001`.
2. **Put spoiler details in a collapsed block** in issues and pull requests, so reviewers can open them on purpose:

   ```markdown
   <details><summary>Spoiler: chapter 3</summary>

   The phrases I added...

   </details>
   ```

3. **Only add spoilers from chapters you have played.** Guessing from leaks or rumours makes the lists wrong.

## How the lists are organised

```
data/
  shared/generic.json        words that spoil any story (endings, deaths, twists) + safe phrases. Safe to read.
  packs/<pack>/
    pack.json                name, kind (game/show/...), unit (chapter/season/...), topics, hash seed
    chapters.json            the chapters in order; names can be encoded
    spoilers/chapter-NN.json hashed spoilers from that chapter
    spoilers/ending.json     hashed spoilers to keep hidden until the very end
  fixtures/titles.json       spoiler-free titles that must always be hidden or always stay visible
```

`npm run build` combines all of this into `extension/data/catalog.json`, the file the extension reads and downloads.

## Adding spoilers

Use the list tool. It normalises each phrase and stores only its hash:

```bash
npm install
npm run spoiler -- add gta6 3 ch03-001 "first phrase" "another phrase" --note "spoiler-free hint"
```

| Argument | Meaning |
|---|---|
| `gta6` | The pack (see `npm run spoiler -- list`) |
| `3` | The chapter where the spoiler happens, or `last` to hide it until the end |
| `ch03-001` | The rule id. Readable in the repo, so keep it vague. Running the command again with the same id adds phrases to that rule. |
| phrases | Up to 6 words each, at least 3 characters. Case, accents and punctuation don't matter. |
| `--note` | Optional, for reviewers. Keep it spoiler-free. |

### Choosing good phrases

- **Be specific.** A character's name plus what happens to them beats a single common word.
- **Add the variations people actually type:** short forms, misspellings, hashtags (`#` is ignored, so `#SomeName` matches `somename`).
- **Phrases only count when the text also mentions the game or show** (its `topics` in `pack.json`). So "the boat explodes" only hides posts that also say "GTA 6" or similar.

### Checking a phrase

Reviewers can't read hashes, so check behaviour instead:

```bash
npm run spoiler -- check gta6 "GTA 6: some title to test"              # hidden or visible for someone who hasn't started?
npm run spoiler -- check gta6 "GTA 6: some title to test" --progress 3 # ...for someone who finished chapter 3?
```

Paste the phrases you added inside a `<details>` block in your pull request. A reviewer can then run `check` with them.

### Chapter names

```bash
npm run spoiler -- title gta6 2 "The real chapter name"
```

This stores the name base64-encoded, so it isn't readable at a glance. The extension only shows a chapter's name once the reader has finished it.

## Adding a game or show

```bash
npm run spoiler -- new-pack elden-ring --name "Elden Ring" --kind game --unit chapter --count 1
```

- `--kind`: `game`, `show`, `film`, `book` or `other`.
- `--unit`: what the slider counts: `chapter`, `episode`, `season`, `part`, `book` or `act`.
- `--count`: how many there are. Use `1` ("the whole story") if you don't know the structure yet.

Then:

1. Edit `topics` in its `pack.json`: the phrases people use to mention it (`elden ring`, `eldenring`, `#eldenring`). Avoid words that are common on their own.
2. Add spoiler-free titles for it to `data/fixtures/titles.json`: a few that must be hidden (e.g. "Elden Ring ending explained") and a few that must stay visible (e.g. a review marked "no spoilers").
3. Run `npm run build && npm test`.

## Moderated reports

People can report missed spoilers and false alarms from the extension. With the API in [`api/`](api) deployed, moderators review reports in the Filament panel and export accepted rules with:

```bash
cd api && php artisan spoilers:export gta6 --path=../data/packs/gta6/spoilers
```

That merges hashed rules into the files above. Then build, test and open a pull request as usual.

## Check your change

```bash
npm run build   # validates every file and regenerates the extension's data
npm test        # matcher, lists, list tool
```

`npm run build` explains exactly what is wrong if a file is invalid: a bad id, a rule in the wrong chapter file, a duplicate phrase, and so on.

Fixed a miss or a false alarm? Add the title to `data/fixtures/titles.json` so it stays fixed. Only spoiler-free titles go in that file.

Commit the regenerated files in `extension/data/` and `extension/vendor/` with your change. CI checks they are up to date.

## Code changes

- `extension/content/sites.js`: selectors for each site. Most "it didn't blur" bugs are fixed here.
- `extension/content/shield-core.js`: blurring, Reveal and "Not a spoiler?", shared with the demo page.
- `extension/background.js`: optional sites, the right-click menu and opening reports.
- `packages/matcher/`: the matching engine. Add a unit test for any behaviour change. If hashing or normalising changes, regenerate the PHP test vectors with `node scripts/hash-vectors.mjs`, because the API must stay in step.
- `api/`: the Laravel app. Run `php artisan test` and `vendor/bin/pint`.

Run the browser tests before opening a pull request that touches the extension:

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

## Code of conduct

Be kind. Spoiling people on purpose, in issues or anywhere else in this repo, gets you blocked.
