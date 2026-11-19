// Where the extension looks for updated spoiler lists and where it links to.
// The lists are plain JSON data (never code), checked with SpoilerMatcher.validateBundle()
// before they are used.
globalThis.SPOILER_SHIELD_CONFIG = {
  listsUrl: 'https://raw.githubusercontent.com/usamamuneerchaudhary/spoiler-shield/main/extension/data/bundle.json',
  repoUrl: 'https://github.com/usamamuneerchaudhary/spoiler-shield',
  reportUrl: 'https://github.com/usamamuneerchaudhary/spoiler-shield/issues/new?template=missed-spoiler.yml',
  checkEveryMs: 6 * 60 * 60 * 1000,
};
