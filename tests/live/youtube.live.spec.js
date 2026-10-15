// Opt-in checks against the real YouTube (npm run test:live).
//
// The fixture tests run the scripts against a fake player modelled on what YouTube exposes today.
// These checks confirm the real player still has the methods and controls the scripts rely on, and
// that the scripts still work on it. They need network access and can be flaky (ads, consent pages,
// bot checks), so they're not part of `npm test`.
const path = require('path');
const { test, expect, devices } = require('@playwright/test');

const VIDEO = 'dQw4w9WgXcQ'; // long-lived video with English captions
const PLAYER_API = [
  'getVideoData', 'isSubtitlesOn', 'setOption',
  'getAvailableQualityLevels', 'setPlaybackQualityRange', 'setPlaybackQuality',
];
const ALL_FUNCTIONS = Object.fromEntries(PLAYER_API.map((name) => [name, 'function']));

// YouTube's CSP blocks injected inline scripts; userscript managers get around it, so do we.
test.use({ bypassCSP: true });

async function openPlayer(page, url) {
  await page.goto(url);
  test.skip(new URL(page.url()).hostname.startsWith('consent.'), 'YouTube showed a cookie consent page');
  await expect(page.locator('#movie_player')).toBeAttached({ timeout: 30_000 });
  await expect
    .poll(() => onPlayer(page, (p) => !p.classList.contains('ad-showing')), {
      message: 'waiting for ads to finish',
      timeout: 60_000,
    })
    .toBe(true);
}

/** Runs `fn(player, arg)` in the page. */
const onPlayer = (page, fn, arg) => page.locator('#movie_player').evaluate(fn, arg);

const apiTypes = (page) =>
  onPlayer(page, (p, names) => Object.fromEntries(names.map((n) => [n, typeof p[n]])), PLAYER_API);

const runUserscript = (page, file) =>
  page.addScriptTag({ path: path.join(__dirname, '..', '..', file) });

/** Turns captions on with the player's own CC button; retries, since it ignores clicks until captions load. */
async function turnCaptionsOn(page, press) {
  await expect(async () => {
    if (!(await onPlayer(page, (p) => p.isSubtitlesOn()))) await press();
    await expect.poll(() => onPlayer(page, (p) => p.isSubtitlesOn()), { timeout: 1000 }).toBe(true);
  }).toPass({ timeout: 20_000 });
}

test.describe('www.youtube.com', () => {
  test('player has the API and controls the scripts use', async ({ page }) => {
    await openPlayer(page, `https://www.youtube.com/watch?v=${VIDEO}`);
    await expect.poll(() => apiTypes(page)).toEqual(ALL_FUNCTIONS);
    expect(await onPlayer(page, (p) => p.getVideoData().video_id)).toBe(VIDEO);
    await expect(page.locator('.ytp-subtitles-button')).toBeAttached();
    await expect(page.locator('.ytp-settings-button')).toBeAttached();
  });

  test('captions-off turns captions off', async ({ page }) => {
    await openPlayer(page, `https://www.youtube.com/watch?v=${VIDEO}`);
    await turnCaptionsOn(page, () => page.click('.ytp-subtitles-button'));

    await runUserscript(page, 'captions-off.user.js');
    await expect.poll(() => onPlayer(page, (p) => p.isSubtitlesOn())).toBe(false);
    await expect(page.locator('.ytp-subtitles-button')).toHaveAttribute('aria-pressed', 'false');
  });

  test('best-quality selects the top quality level', async ({ page }) => {
    await openPlayer(page, `https://www.youtube.com/watch?v=${VIDEO}`);
    await expect
      .poll(() => onPlayer(page, (p) => p.getAvailableQualityLevels().length), { timeout: 30_000 })
      .toBeGreaterThan(0);
    const best = await onPlayer(page, (p) => p.getAvailableQualityLevels().find((q) => q !== 'auto'));

    await runUserscript(page, 'best-quality.user.js');
    await expect.poll(() => onPlayer(page, (p) => p.getPlaybackQuality()), { timeout: 30_000 }).toBe(best);
  });
});

test.describe('m.youtube.com', () => {
  const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
  test.use(pixel);

  test('player has the API and controls the scripts use', async ({ page }) => {
    await openPlayer(page, `https://m.youtube.com/watch?v=${VIDEO}`);
    await expect.poll(() => apiTypes(page)).toEqual(ALL_FUNCTIONS);
    // The mobile controls are only rendered once shown, so tap the player first.
    await page.locator('#movie_player').tap();
    await expect(page.locator('.ytmClosedCaptioningButtonButton')).toBeAttached();
    await expect(page.locator('.player-settings-icon')).toBeAttached();
  });

  test('captions-off turns captions off', async ({ page }) => {
    await openPlayer(page, `https://m.youtube.com/watch?v=${VIDEO}`);
    await page.locator('#movie_player').tap();
    await turnCaptionsOn(page, () => page.tap('.ytmClosedCaptioningButtonButton'));

    await runUserscript(page, 'captions-off.user.js');
    await expect.poll(() => onPlayer(page, (p) => p.isSubtitlesOn())).toBe(false);
  });
});

test.describe('youtube-nocookie.com embed', () => {
  test('player has the API the scripts use', async ({ page }) => {
    await page.goto(`https://www.youtube-nocookie.com/embed/${VIDEO}`);
    await expect(page.locator('#movie_player')).toBeAttached({ timeout: 30_000 });
    await expect.poll(() => apiTypes(page)).toEqual(ALL_FUNCTIONS);
  });
});
