// @ts-check
const { test: base, expect } = require('@playwright/test');
const { launch } = require('./helpers');

const test = base.extend({
  reportApiUrl: ['', { option: true }],
  shield: async ({ reportApiUrl }, use) => {
    const shield = await launch({ reportApiUrl });
    await use(shield);
    await shield.context.close();
  },
  context: async ({ shield }, use) => {
    await use(shield.context);
  },
  page: async ({ context }, use) => {
    await use(await context.newPage());
  },
});

const blurred = (page, selector) => page.locator(`${selector}.ss-blurred, ${selector}.ss-blurred-host`);
const visible = (page, selector) => expect(page.locator(selector)).not.toHaveClass(/ss-blurred/);

test.describe('YouTube', () => {
  test('blurs spoiler cards and leaves the rest alone', async ({ page }) => {
    await page.goto('https://www.youtube.com/');
    await expect(blurred(page, '#spoiler-card')).toHaveCount(1);
    await expect(blurred(page, '#aria-card')).toHaveCount(1);
    await expect(blurred(page, '#comment')).toHaveCount(1);
    await visible(page, '#safe-card');
    await expect(page.locator('#spoiler-card .ss-overlay')).toContainText('Spoiler hidden');
    await expect(page.locator('#spoiler-card .ss-meta')).toHaveText('Grand Theft Auto VI · ending / late story');
  });

  test('covers and pauses the player when the video itself is a spoiler', async ({ page }) => {
    await page.goto('https://www.youtube.com/');
    await expect(blurred(page, '#watch')).toHaveCount(1);
    await expect(blurred(page, '#movie_player')).toHaveCount(1);
  });

  test('Reveal shows the item and keeps it shown', async ({ page }) => {
    await page.goto('https://www.youtube.com/');
    await page.locator('#spoiler-card .ss-reveal').click();
    await visible(page, '#spoiler-card');
    await expect(page.locator('#spoiler-card .ss-overlay')).toHaveCount(0);
  });
});

test.describe('Reddit', () => {
  test('blurs posts, comment bodies and old Reddit links', async ({ page }) => {
    await page.goto('https://www.reddit.com/r/GTA6/');
    await expect(blurred(page, '#feed-spoiler')).toHaveCount(1);
    await visible(page, '#feed-safe');
    await expect(blurred(page, '#reply-body')).toHaveCount(1);
    await visible(page, '#parent-body');
    await expect(blurred(page, '#old-reddit')).toHaveCount(1);
  });
});

test.describe('X', () => {
  test('blurs spoiler tweets, including ones added later and ones whose text changes', async ({ page }) => {
    await page.goto('https://x.com/home');
    await expect(blurred(page, '#spoiler-tweet')).toHaveCount(1);
    await visible(page, '#safe-tweet');
    await visible(page, '#other-topic');

    await page.evaluate(() => window.addTweet('late', 'The GTA VI plot twist nobody saw coming'));
    await expect(blurred(page, '#late')).toHaveCount(1);

    // Sites reuse elements while scrolling: new text must be checked again.
    await page.evaluate(() => {
      document.querySelector('#late div').textContent = 'Best cars in GTA 6 so far';
    });
    await visible(page, '#late');
  });

  test('clicking Reveal does not open the tweet', async ({ page }) => {
    await page.goto('https://x.com/home');
    await page.locator('#spoiler-tweet .ss-reveal').click();
    await visible(page, '#spoiler-tweet');
    expect(await page.evaluate(() => window.clicks)).toBe(0);
  });
});

test.describe('Optional sites (after the user grants permission)', () => {
  test('Google: results, questions, videos and forum threads', async ({ page }) => {
    await page.goto('https://www.google.com/search?q=gta+6');
    await expect(blurred(page, '#g-spoiler')).toHaveCount(1);
    await visible(page, '#g-safe');
    await expect(blurred(page, '#g-paa-spoiler')).toHaveCount(1);
    await visible(page, '#g-paa-safe');
    await expect(blurred(page, '#g-video')).toHaveCount(1);
    await expect(blurred(page, '#g-forum')).toHaveCount(1);
  });

  test('Twitch: stream cards, titles and chat', async ({ page }) => {
    await page.goto('https://www.twitch.tv/directory/category/grand-theft-auto-vi');
    await expect(blurred(page, '#t-spoiler')).toHaveCount(1);
    await visible(page, '#t-safe');
    await expect(blurred(page, '#t-title')).toHaveCount(1);
    await expect(blurred(page, '#t-chat')).toHaveCount(1);
  });

  test('TikTok: video cards and comments', async ({ page }) => {
    await page.goto('https://www.tiktok.com/explore');
    await expect(blurred(page, '#k-spoiler')).toHaveCount(1);
    await visible(page, '#k-safe');
    await expect(blurred(page, '#k-comment')).toHaveCount(1);
  });
});

test.describe('Popup', () => {
  test('shows every pack, with GTA 6 on by default', async ({ shield, context }) => {
    const popup = await context.newPage();
    await popup.goto(shield.popupUrl);
    await expect(popup.locator('.pack')).toHaveCount(4);
    await expect(popup.locator('[data-pack="gta6"] .pack-enabled')).toBeChecked();
    await expect(popup.locator('[data-pack="stranger-things"] .pack-enabled')).not.toBeChecked();
    await expect(popup.locator('#subtitle')).toHaveText('Hiding spoilers for 1 story');
    await expect(popup.locator('[data-optional-site="google"]')).toBeChecked();
  });

  test('moving the GTA 6 slider to "finished" shows its spoilers', async ({ shield, context, page }) => {
    await page.goto('https://x.com/home');
    await expect(blurred(page, '#spoiler-tweet')).toHaveCount(1);

    const popup = await context.newPage();
    await popup.goto(shield.popupUrl);
    const slider = popup.locator('[data-pack="gta6"] .pack-slider');
    await slider.fill('6');
    await slider.dispatchEvent('change');
    await expect(popup.locator('[data-pack="gta6"] .progress-label')).toContainText('Finished the story');

    await visible(page, '#spoiler-tweet');
  });

  test('turning on another pack hides its spoilers too', async ({ shield, context, page }) => {
    await page.goto('https://x.com/home');
    await visible(page, '#st-tweet');

    const popup = await context.newPage();
    await popup.goto(shield.popupUrl);
    await popup.locator('[data-pack="stranger-things"] .pack-enabled').check();
    await expect(popup.locator('#subtitle')).toHaveText('Hiding spoilers for 2 stories');

    await expect(blurred(page, '#st-tweet')).toHaveCount(1);
    await expect(page.locator('#st-tweet .ss-meta')).toHaveText('Stranger Things · ending / late story');
  });

  test('turning the shield off shows everything', async ({ shield, context, page }) => {
    await page.goto('https://www.youtube.com/');
    await expect(blurred(page, '#spoiler-card')).toHaveCount(1);

    const popup = await context.newPage();
    await popup.goto(shield.popupUrl);
    await popup.locator('.switch').click();
    await visible(page, '#spoiler-card');
  });
});

test.describe('Reporting without an API (GitHub issues)', () => {
  test('"Not a spoiler?" reveals the item and opens a pre-filled report', async ({ context, page }) => {
    await page.goto('https://x.com/home');
    const reportPage = context.waitForEvent('page');
    await page.locator('#spoiler-tweet .ss-report').click();
    await visible(page, '#spoiler-tweet');
    expect(await page.evaluate(() => window.clicks)).toBe(0);

    const report = await reportPage;
    await report.waitForLoadState();
    await expect(report.locator('#done')).toBeHidden();
    await expect(report.locator('input[value="false_alarm"]')).toBeChecked();
    await expect(report.locator('#pack')).toHaveValue('gta6');
    await expect(report.locator('#text')).toHaveValue(/GTA 6 story recap/);
    await expect(report.locator('#url-preview')).toHaveText('https://x.com/home');

    await report.locator('#send').click();
    await report.waitForURL(/github\.com/);
    const url = new URL(report.url());
    expect(url.pathname).toBe('/usamamuneerchaudhary/spoiler-shield/issues/new');
    expect(url.searchParams.get('template')).toBe('false-alarm.yml');
    expect(url.searchParams.get('title')).toBe('Hidden by mistake: Grand Theft Auto VI on X');
    expect(url.searchParams.get('text')).toContain('<details>');
    expect(url.searchParams.get('text')).toContain('GTA 6 story recap');
  });

  test('missed-spoiler titles never contain the spoiler', async ({ shield, context }) => {
    const report = await context.newPage();
    const id = new URL(shield.popupUrl).host;
    await report.goto(`chrome-extension://${id}/report/report.html?kind=missed_spoiler&site=reddit&text=Secret+twist+text`);
    await report.locator('#chapter').selectOption('3');
    await report.locator('#send').click();
    await report.waitForURL(/github\.com/);
    const url = new URL(report.url());
    expect(url.searchParams.get('template')).toBe('missed-spoiler.yml');
    expect(url.searchParams.get('title')).toBe('Missed spoiler: Grand Theft Auto VI, Chapter 3 (Reddit)');
    expect(url.searchParams.get('title')).not.toContain('Secret');
    expect(url.searchParams.get('spoiler')).toContain('Secret twist text');
  });
});

test('one-part packs hide the chapter picker', async ({ shield, context }) => {
  const report = await context.newPage();
  const id = new URL(shield.popupUrl).host;
  await report.goto(`chrome-extension://${id}/report/report.html?pack=marvels-wolverine&text=abc`);
  await expect(report.locator('#chapter')).toBeHidden();
  await report.locator('#pack').selectOption('stranger-things');
  await expect(report.locator('#chapter')).toBeVisible();
  await expect(report.locator('#chapter-label')).toHaveText('Which season does it spoil?');
});

test.describe('Reporting to the Spoiler Shield API', () => {
  test.use({ reportApiUrl: 'https://api.spoiler-shield.test' });

  test('sends the report as JSON and shows a thank-you', async ({ shield, context }) => {
    let received = null;
    await context.route('https://api.spoiler-shield.test/api/v1/reports', async (route) => {
      received = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 1, status: 'pending' }) });
    });

    const report = await context.newPage();
    const id = new URL(shield.popupUrl).host;
    await report.goto(
      `chrome-extension://${id}/report/report.html?kind=missed_spoiler&site=youtube&pack=gta6&chapter=2&text=Some+spoiler&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D1`
    );
    await report.locator('#note').fill('Title only');
    await report.locator('#send').click();
    await expect(report.locator('#done')).toBeVisible();
    await expect(report.locator('#report-form')).toBeHidden();

    expect(received).toMatchObject({
      kind: 'missed_spoiler',
      pack: 'gta6',
      chapter: 2,
      text: 'Some spoiler',
      page_url: 'https://www.youtube.com/watch?v=1',
      site: 'youtube',
      note: 'Title only',
      extension_version: '0.2.0',
    });
    expect(typeof received.list_version).toBe('string');
  });

  test('shows the server\'s validation message', async ({ shield, context }) => {
    await context.route('https://api.spoiler-shield.test/api/v1/reports', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid', errors: { text: ['The text field is required.'] } }),
      })
    );
    const report = await context.newPage();
    const id = new URL(shield.popupUrl).host;
    await report.goto(`chrome-extension://${id}/report/report.html?text=x`);
    await report.locator('#send').click();
    await expect(report.locator('#error')).toHaveText('The text field is required.');
  });

  test('leaving out the page link sends no URL', async ({ shield, context }) => {
    let received = null;
    await context.route('https://api.spoiler-shield.test/api/v1/reports', async (route) => {
      received = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{"id":2,"status":"pending"}' });
    });
    const report = await context.newPage();
    const id = new URL(shield.popupUrl).host;
    await report.goto(`chrome-extension://${id}/report/report.html?text=abc&url=https%3A%2F%2Fx.com%2Fsecret`);
    await report.locator('#include-url').uncheck();
    await report.locator('#send').click();
    await expect(report.locator('#done')).toBeVisible();
    expect(received.page_url).toBeNull();
  });
});
