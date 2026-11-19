# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-11-19

### Added

- Packs: Grand Theft Auto VI, Marvel's Wolverine, 007 First Light and Stranger Things, each with its own progress slider. Spoilers that apply to any story now live in one shared list.
- Hashed spoiler lists and encoded chapter names, so the repo itself spoils nothing, plus the `npm run spoiler` tool to add, check and organise them.
- Twitch, TikTok and Google Search as opt-in sites, each behind its own permission.
- Reporting: "Report as spoiler" in the right-click menu, "Not a spoiler?" on blurred items, and a report form that sends to the API or opens a pre-filled GitHub issue.
- `api/`: a Laravel 13 app with a report API (validation, rate limits, duplicate folding, data retention) and a Filament 5 moderation panel that turns reports into rules and exports them as hashed list files.
- Tests: Pest for the API and panel, PHP/JavaScript hashing parity checks, list-tool tests, and browser tests for the new sites, packs and reporting.

### Changed

- The extension now reads `extension/data/catalog.json` (all packs) instead of `bundle.json`.
- Overlay labels name the game or show, and only ever a chapter number.

## [0.1.0] - 2026-11-19

### Added

- Browser extension (Manifest V3) for Chrome and Firefox that blurs GTA 6 spoilers on YouTube, Reddit and X, with a Reveal button on each item.
- Progress slider: spoilers from chapters you have finished are shown again.
- YouTube watch page: the player is covered and paused when the video is a spoiler.
- Generic spoiler list (endings, deaths, twists, story dumps) and placeholder chapters.
- Spoiler lists update from GitHub without a new release, validated before use.
- `spoiler-shield-matcher` package with TypeScript types and unit tests.
- Spoiler-free demo page, Playwright tests that load the real extension, and CI.
