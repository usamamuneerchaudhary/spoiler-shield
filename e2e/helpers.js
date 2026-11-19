// Shared set-up for the browser tests.
const { chromium } = require('@playwright/test');
const { createHash } = require('node:crypto');
const { cpSync, mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const source = path.resolve(__dirname, '..', 'extension');
const fixture = (name) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

const SITES = {
  'https://www.youtube.com/': fixture('youtube.html'),
  'https://www.reddit.com/': fixture('reddit.html'),
  'https://x.com/': fixture('x.html'),
  'https://www.google.com/': fixture('google.html'),
  'https://www.twitch.tv/': fixture('twitch.html'),
  'https://www.tiktok.com/': fixture('tiktok.html'),
};

/** Chrome derives an unpacked extension's id from its folder path. */
function extensionIdFor(folder) {
  const hex = createHash('sha256').update(folder).digest('hex').slice(0, 32);
  return [...hex].map((char) => String.fromCharCode(97 + parseInt(char, 16))).join('');
}

/**
 * Copy the extension to a temporary folder for one test run.
 * Optional site permissions are pre-granted (tests can't click Chrome's
 * permission prompt), so the background script registers those sites exactly
 * as it does after a real grant.
 */
function prepareExtension({ reportApiUrl = '' } = {}) {
  const folder = path.join(mkdtempSync(path.join(tmpdir(), 'ss-ext-')), 'extension');
  cpSync(source, folder, { recursive: true });

  const manifestPath = path.join(folder, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = manifest.optional_host_permissions;
  delete manifest.optional_host_permissions;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const configPath = path.join(folder, 'config.js');
  writeFileSync(configPath, readFileSync(configPath, 'utf8').replace("reportApiUrl: ''", `reportApiUrl: '${reportApiUrl}'`));

  return { folder, id: extensionIdFor(folder) };
}

async function launch({ reportApiUrl } = {}) {
  const extension = prepareExtension({ reportApiUrl });
  const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'ss-profile-')), {
    channel: 'chromium',
    headless: true,
    // Set CHROME_PATH to use a local Chromium or Chrome for Testing build.
    executablePath: process.env.CHROME_PATH || undefined,
    args: [`--disable-extensions-except=${extension.folder}`, `--load-extension=${extension.folder}`],
  });
  for (const [origin, body] of Object.entries(SITES)) {
    await context.route(`${origin}**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body }));
  }
  await context.route('https://github.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>GitHub issue</title><h1>New issue</h1>' })
  );

  // Wait until the background script has registered the optional sites.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extension.id}/popup/popup.html`);
  await page.waitForFunction(
    async () => (await chrome.scripting.getRegisteredContentScripts()).length === 3,
    null,
    { timeout: 10_000 }
  );
  await page.close();

  return { context, extension, popupUrl: `chrome-extension://${extension.id}/popup/popup.html` };
}

module.exports = { launch, extensionIdFor };
