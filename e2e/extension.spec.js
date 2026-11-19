// @ts-check
const { test: base, expect, chromium } = require('@playwright/test');
const { createHash } = require('node:crypto');
const { mkdtempSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const extensionPath = path.resolve(__dirname, '..', 'extension');
const fixture = (name) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

const sites = {
  'https://www.youtube.com/': fixture('youtube.html'),
  'https://www.reddit.com/': fixture('reddit.html'),
  'https://x.com/': fixture('x.html'),
};

/** Chrome derives an unpacked extension's id from its folder path. */
function extensionIdFor(folder) {
  const hex = createHash('sha256').update(folder).digest('hex').slice(0, 32);
  return [...hex].map((char) => String.fromCharCode(97 + parseInt(char, 16))).join('');
}

const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'ss-e2e-')), {
      channel: 'chromium',
      headless: true,
      // Set CHROME_PATH to use a local Chromium or Chrome for Testing build.
      executablePath: process.env.CHROME_PATH || undefined,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    for (const [origin, body] of Object.entries(sites)) {
      await context.route(`${origin}**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body }));
    }
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    await use(await context.newPage());
  },
});

const blurred = (page, selector) => page.locator(`${selector}.ss-blurred, ${selector}.ss-blurred-host`);

test.describe('YouTube', () => {
  test('blurs spoiler cards and leaves the rest alone', async ({ page }) => {
    await page.goto('https://www.youtube.com/');
    await expect(blurred(page, '#spoiler-card')).toHaveCount(1);
    await expect(blurred(page, '#aria-card')).toHaveCount(1);
    await expect(blurred(page, '#comment')).toHaveCount(1);
    await expect(page.locator('#safe-card')).not.toHaveClass(/ss-blurred/);
    await expect(page.locator('#spoiler-card .ss-overlay')).toContainText('Spoiler hidden');
  });

  test('covers and pauses the player when the video itself is a spoiler', async ({ page }) => {
    await page.goto('https://www.youtube.com/');
    await expect(blurred(page, '#watch')).toHaveCount(1);
    await expect(blurred(page, '#movie_player')).toHaveCount(1);
  });

  test('Reveal shows the item and keeps it shown', async ({ page }) => {
    await page.goto('https://www.youtube.com/');
    await page.locator('#spoiler-card .ss-reveal').click();
    await expect(page.locator('#spoiler-card')).not.toHaveClass(/ss-blurred/);
    await expect(page.locator('#spoiler-card .ss-overlay')).toHaveCount(0);
  });
});

test.describe('Reddit', () => {
  test('blurs posts, comment bodies and old Reddit links', async ({ page }) => {
    await page.goto('https://www.reddit.com/r/GTA6/');
    await expect(blurred(page, '#feed-spoiler')).toHaveCount(1);
    await expect(page.locator('#feed-safe')).not.toHaveClass(/ss-blurred/);
    await expect(blurred(page, '#reply-body')).toHaveCount(1);
    await expect(page.locator('#parent-body')).not.toHaveClass(/ss-blurred/);
    await expect(blurred(page, '#old-reddit')).toHaveCount(1);
  });
});

test.describe('X', () => {
  test('blurs spoiler tweets, including ones added later and ones whose text changes', async ({ page }) => {
    await page.goto('https://x.com/home');
    await expect(blurred(page, '#spoiler-tweet')).toHaveCount(1);
    await expect(page.locator('#safe-tweet')).not.toHaveClass(/ss-blurred/);
    await expect(page.locator('#other-topic')).not.toHaveClass(/ss-blurred/);

    await page.evaluate(() => window.addTweet('late', 'The GTA VI plot twist nobody saw coming'));
    await expect(blurred(page, '#late')).toHaveCount(1);

    // Sites reuse elements while scrolling: new text must be checked again.
    await page.evaluate(() => {
      document.querySelector('#late div').textContent = 'Best cars in GTA 6 so far';
    });
    await expect(page.locator('#late')).not.toHaveClass(/ss-blurred/);
  });

  test('clicking Reveal does not open the tweet', async ({ page }) => {
    await page.goto('https://x.com/home');
    await page.locator('#spoiler-tweet .ss-reveal').click();
    await expect(page.locator('#spoiler-tweet')).not.toHaveClass(/ss-blurred/);
    expect(await page.evaluate(() => window.clicks)).toBe(0);
  });
});

test.describe('Popup', () => {
  test('moving the slider to "finished" shows everything on open pages', async ({ context, page }) => {
    await page.goto('https://x.com/home');
    await expect(blurred(page, '#spoiler-tweet')).toHaveCount(1);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionIdFor(extensionPath)}/popup/popup.html`);
    await expect(popup.locator('#progress-label')).toContainText('Not started');
    await popup.locator('#progress').fill('6');
    await popup.locator('#progress').dispatchEvent('change');
    await expect(popup.locator('#progress-label')).toContainText('Finished the story');

    await expect(page.locator('#spoiler-tweet')).not.toHaveClass(/ss-blurred/);
  });

  test('turning the shield off shows everything', async ({ context, page }) => {
    await page.goto('https://www.youtube.com/');
    await expect(blurred(page, '#spoiler-card')).toHaveCount(1);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionIdFor(extensionPath)}/popup/popup.html`);
    await popup.locator('.switch').click();
    await expect(page.locator('#spoiler-card')).not.toHaveClass(/ss-blurred/);
  });
});
