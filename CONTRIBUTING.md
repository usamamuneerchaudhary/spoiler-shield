# Contributing to Spoiler Shield

Thanks for helping keep the story a surprise. Spoiler lists are unusual to work on because **the data itself is a spoiler**, so please read this page before opening a pull request.

## Golden rules

1. **Never put a spoiler in a title.** That covers pull request titles, issue titles, commit messages and branch names, because they show up in notifications and feeds. Write `Add chapter 3 spoilers`, not what happens in chapter 3.
2. **Put spoiler details inside a collapsed block** in issues and pull requests:

   ```markdown
   <details><summary>Spoiler: chapter 3</summary>

   The phrase that slipped through...

   </details>
   ```

3. **Only add spoilers from chapters you have played.** Guessing from leaks or rumours makes the lists wrong.

## Adding spoilers

Spoilers live in `data/spoilers/`, one file per chapter: `chapter-01.json`, `chapter-02.json` and so on. `generic.json` holds words that spoil any story (endings, deaths, twists).

```json
{
  "rules": [
    {
      "id": "ch03-boat-chase",
      "chapter": 3,
      "note": "Short, spoiler-free hint for reviewers.",
      "terms": ["first phrase", "another phrase"]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | Lower-case letters, numbers and dashes. Start with the chapter, e.g. `ch03-...`. Must be unique. |
| `chapter` | The chapter where the spoiler happens. It must match the file name. Use `"last"` in `generic.json` for "hide until the end". |
| `terms` | Phrases to look for. Up to 6 words each, at least 3 characters. Matching ignores case, accents and punctuation. |
| `requiresTopic` | Optional, default `true`: the text must also mention the game (`gta 6`, `#GTA6` ...). Set `false` only for phrases nobody would use outside GTA 6, such as a unique character name. |
| `note` | Optional, for reviewers. Keep it spoiler-free. |

### Choosing good terms

- **Be specific.** A character's name plus what happens to them is better than one common word.
- **Add variations people actually type:** short forms, misspellings, hashtags (`#` is ignored, so `#SomeName` matches `somename`).
- **Think about false alarms.** If a term would hide everyday posts, leave `requiresTopic` on, or make the phrase longer.

### Chapter names

`data/chapters.json` lists chapters in order. Replace a placeholder with the real title once you have played it and remove `"placeholder": true`. The overlay never shows the names of chapters the reader hasn't reached.

## Check your change

```bash
npm install
npm run build   # validates every file and regenerates the extension's data
npm test        # matcher tests and list checks
```

`npm run build` tells you exactly what is wrong if a file is invalid (bad id, wrong chapter, duplicate term ...).

If you fixed a miss or a false alarm, add the title to `data/fixtures/titles.json` (`hidden` or `visible`) so it stays fixed. Only spoiler-free titles go in that file, since it sits outside the spoiler folder.

Commit the regenerated files in `extension/data/` and `extension/vendor/` with your change. CI checks they are up to date.

## Code changes

- `extension/content/sites.js`: selectors for each site. Most "it didn't blur" bugs are fixed here.
- `extension/content/shield-core.js`: blurring and reveal logic, shared with the demo page.
- `packages/matcher/`: the matching engine. Add a unit test for any behaviour change.

Run the browser tests before opening a pull request that touches the extension:

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

## Code of conduct

Be kind. Spoiling people on purpose, in issues or anywhere else in this repo, gets you blocked.
