// End-to-end tests: load the real extension in Chromium and run it against
// fixture pages served at the real YouTube, Reddit and X addresses.
// First run: npx playwright install chromium
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  workers: 1,
});
