// Where the extension looks for updated spoiler lists, where reports go, and where it links to.
// The lists are plain JSON data (never code), checked with SpoilerMatcher.validateCatalog()
// before they are used.
globalThis.SPOILER_SHIELD_CONFIG = {
  listsUrl: 'https://raw.githubusercontent.com/usamamuneerchaudhary/spoiler-shield/main/extension/data/catalog.json',
  repoUrl: 'https://github.com/usamamuneerchaudhary/spoiler-shield',
  // Base URL of the Spoiler Shield API (the Laravel app in api/), e.g. 'https://api.example.com'.
  // Leave empty to send reports as pre-filled GitHub issues instead.
  reportApiUrl: '',
  checkEveryMs: 6 * 60 * 60 * 1000,
};
