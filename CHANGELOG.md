# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-19

### Added

- Browser extension (Manifest V3) for Chrome and Firefox that blurs GTA 6 spoilers on YouTube, Reddit and X, with a Reveal button on each item.
- Progress slider: spoilers from chapters you have finished are shown again.
- YouTube watch page: the player is covered and paused when the video is a spoiler.
- Generic spoiler list (endings, deaths, twists, story dumps) and placeholder chapters.
- Spoiler lists update from GitHub without a new release, validated before use.
- `spoiler-shield-matcher` package with TypeScript types and unit tests.
- Spoiler-free demo page, Playwright tests that load the real extension, and CI.
