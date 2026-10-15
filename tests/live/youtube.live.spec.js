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
const AUTOPLAY_TOGGLE = 'button.ytp-autonav-toggle';
const AUTOPLAY_STATE = `${AUTOPLAY_TOGGLE} .ytp-autonav-toggle-button`;
const MOBILE_AUTOPLAY_TOGGLE = 'button.ytwAutonavToggleButtonHost';

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

const autoplayChecked = (page) => page.locator(AUTOPLAY_STATE).getAttribute('aria-checked');

/** Resolves when YouTube has saved a settings change, as it does when the Autoplay toggle is clicked. */
const settingSaved = (page) =>
  page.waitForResponse((r) => r.url().includes('/account/set_setting') && r.ok(), { timeout: 30_000 });

/** Taps the mobile player to show its controls. A YouTube overlay sometimes blocks taps for a while. */
const tapPlayer = (page) =>
  page.locator('#movie_player').tap({ timeout: 10_000 }).catch(() => page.locator('#movie_player').tap({ force: true }));

test.describe('www.youtube.com', () => {
  test('player has the API and controls the scripts use', async ({ page }) => {
    await openPlayer(page, `https://www.youtube.com/watch?v=${VIDEO}`);
    await expect.poll(() => apiTypes(page)).toEqual(ALL_FUNCTIONS);
    expect(await onPlayer(page, (p) => p.getVideoData().video_id)).toBe(VIDEO);
    await expect(page.locator('.ytp-subtitles-button')).toBeAttached();
    await expect(page.locator('.ytp-settings-button')).toBeAttached();
    await expect(page.locator(AUTOPLAY_STATE)).toHaveAttribute('aria-checked', /^(true|false)$/);
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

  test('never-autoplay turns Autoplay off, and YouTube remembers it', async ({ page }) => {
    test.setTimeout(240_000); // two page loads, each possibly with ads
    const url = `https://www.youtube.com/watch?v=${VIDEO}`;
    await openPlayer(page, url);
    expect(await autoplayChecked(page), 'a fresh browser starts with Autoplay on').toBe('true');
    // Some sessions get a player whose toggle stays hidden and ignores clicks; those sessions don't
    // autoplay the next video either, so there's nothing to check.
    const shown = await page
      .waitForFunction((sel) => getComputedStyle(document.querySelector(sel)).display !== 'none', AUTOPLAY_TOGGLE, { timeout: 20_000 })
      .then(() => true, () => false);
    test.skip(!shown, "This session's player has no working Autoplay toggle (and doesn't autoplay)");

    const saved = settingSaved(page);
    await runUserscript(page, 'never-autoplay.user.js');
    await expect.poll(() => autoplayChecked(page), { timeout: 20_000 }).toBe('false');
    await saved;

    await openPlayer(page, url); // reloaded, without the script
    await expect.poll(() => autoplayChecked(page), { timeout: 20_000 }).toBe('false');
  });
});

test.describe('m.youtube.com', () => {
  const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
  test.use(pixel);

  test('player has the API and controls the scripts use', async ({ page }) => {
    await openPlayer(page, `https://m.youtube.com/watch?v=${VIDEO}`);
    await expect.poll(() => apiTypes(page)).toEqual(ALL_FUNCTIONS);
    // The mobile controls are only rendered once shown, so tap the player first.
    await tapPlayer(page);
    await expect(page.locator('.ytmClosedCaptioningButtonButton')).toBeAttached();
    await expect(page.locator('.player-settings-icon')).toBeAttached();
  });

  test('captions-off turns captions off', async ({ page }) => {
    await openPlayer(page, `https://m.youtube.com/watch?v=${VIDEO}`);
    await tapPlayer(page);
    await turnCaptionsOn(page, () => page.tap('.ytmClosedCaptioningButtonButton'));

    await runUserscript(page, 'captions-off.user.js');
    await expect.poll(() => onPlayer(page, (p) => p.isSubtitlesOn())).toBe(false);
  });

  test('never-autoplay turns Autoplay off, and YouTube remembers it', async ({ page }) => {
    test.setTimeout(240_000);
    const url = `https://m.youtube.com/watch?v=${VIDEO}`;
    const pressed = () => page.locator(MOBILE_AUTOPLAY_TOGGLE).getAttribute('aria-pressed');
    const showToggle = async () => {
      await tapPlayer(page); // the toggle is added once the controls are shown
      try {
        await page.locator(MOBILE_AUTOPLAY_TOGGLE).waitFor({ state: 'attached', timeout: 10_000 });
      } catch {
        // Not every m.youtube.com session has the toggle; those also don't autoplay the next video.
        test.skip(true, 'This m.youtube.com session has no Autoplay toggle');
      }
    };

    await openPlayer(page, url);
    await showToggle();
    expect(await pressed(), 'a fresh browser starts with Autoplay on').toBe('true');

    const saved = settingSaved(page);
    await runUserscript(page, 'never-autoplay.user.js');
    await expect.poll(pressed, { timeout: 20_000 }).toBe('false');
    await saved;

    await openPlayer(page, url); // reloaded, without the script
    await showToggle();
    await expect.poll(pressed, { timeout: 20_000 }).toBe('false');
  });
});

test.describe('www.youtube.com livestreams', () => {
  // YouTube's live chat tells headless Chromium to "update your browser", so look like regular
  // desktop Chrome here.
  const { defaultBrowserType, ...desktopChrome } = devices['Desktop Chrome'];
  test.use(desktopChrome);

  const chatCloseButton = (page) =>
    page.frameLocator('ytd-live-chat-frame iframe').locator('yt-live-chat-header-renderer #close-button button');
  const chatCollapsed = (page) => page.locator('ytd-live-chat-frame').evaluate((c) => c.hasAttribute('collapsed'));

  const cases = [
    ['a livestream', 'https://www.youtube.com/@LofiGirl/live'], // a 24/7 stream
    ['chat replay of a past stream', 'https://www.youtube.com/watch?v=5qap5aO4i9A'],
  ];
  for (const [what, url] of cases) {
    test(`no-livestream-chat closes the chat on ${what}`, async ({ page }) => {
      await openPlayer(page, url);
      if (url.endsWith('/live')) {
        test.skip(!(await onPlayer(page, (p) => p.getVideoData().isLive)), "The stream isn't live right now");
      }
      await expect(chatCloseButton(page)).toBeAttached({ timeout: 30_000 });
      expect(await chatCollapsed(page), 'the chat starts open').toBe(false);

      await runUserscript(page, 'no-livestream-chat.user.js');
      await expect.poll(() => chatCollapsed(page), { timeout: 10_000 }).toBe(true);
    });
  }
});

test.describe('youtube-nocookie.com embed', () => {
  test('player has the API the scripts use', async ({ page }) => {
    await page.goto(`https://www.youtube-nocookie.com/embed/${VIDEO}`);
    await expect(page.locator('#movie_player')).toBeAttached({ timeout: 30_000 });
    await expect.poll(() => apiTypes(page)).toEqual(ALL_FUNCTIONS);
  });
});
