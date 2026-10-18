/* global fake */
const { test, expect, devices } = require('@playwright/test');
const { openPlayer, runUserscript, inPage } = require('./helpers');

const SCRIPT = 'unstick-start.user.js';
const WATCH = 'https://www.youtube.com/watch?v=video-1';

// The player as YouTube leaves it after a skip to 1:09.5 before the video started playing: still
// "unstarted", with only the video's metadata loaded. (Runs in the page, so setups that do more
// repeat it rather than calling it.)
const stuck = () => { fake.playerState = -1; fake.readyState = 1; fake.currentTime = 69.5; };

/** Marks the current page, so stillHere() can tell whether the script reloaded it. */
const markPage = (page) => inPage(page, () => { window.notReloaded = true; });
const stillHere = (page) => inPage(page, () => window.notReloaded === true);

test.describe('www.youtube.com', () => {
  test('reloads a stuck video at the time it was skipping to', async ({ page }) => {
    await openPlayer(page, { url: WATCH, setup: stuck });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(4500);
    await page.waitForURL(`${WATCH}&ui=desktop&t=70s`);
  });

  test('also reloads it when YouTube has reset the video element while stuck', async ({ page }) => {
    // As after a quality change during the stall: buffering, nothing loaded.
    await openPlayer(page, { url: WATCH, setup: () => { fake.playerState = 3; fake.readyState = 0; fake.currentTime = 69.5; } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(4500);
    await page.waitForURL(/[?&]t=70s/);
  });

  test('gives the seek 4 seconds to finish', async ({ page }) => {
    await openPlayer(page, { url: WATCH, setup: stuck });
    await markPage(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(3500);
    await inPage(page, () => { fake.readyState = 4; fake.playerState = 1; });
    await page.clock.runFor(10_000);
    expect(await stillHere(page)).toBe(true);
  });

  test('leaves the video alone once it has played', async ({ page }) => {
    await openPlayer(page, { url: WATCH });
    await markPage(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(1000);
    await inPage(page, stuck);
    await page.clock.runFor(10_000);
    expect(await stillHere(page)).toBe(true);
  });

  test('leaves a slow start from the beginning alone', async ({ page }) => {
    await openPlayer(page, { url: WATCH, setup: () => { fake.playerState = 3; fake.readyState = 0; fake.currentTime = 0.5; } });
    await markPage(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(10_000);
    expect(await stillHere(page)).toBe(true);
  });

  test('waits for an ad to finish', async ({ page }) => {
    await openPlayer(page, { url: WATCH, setup: () => { fake.playerState = -1; fake.readyState = 1; fake.currentTime = 69.5; fake.setAd(true); } });
    await markPage(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(10_000);
    expect(await stillHere(page)).toBe(true);

    await inPage(page, () => fake.setAd(false));
    await page.clock.runFor(4500);
    await page.waitForURL(/[?&]t=70s/);
  });

  test('does not count time in a background tab', async ({ page }) => {
    await openPlayer(page, { url: WATCH, setup: () => { fake.playerState = -1; fake.readyState = 1; fake.currentTime = 69.5; fake.hidden = true; } });
    await markPage(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(10_000);
    expect(await stillHere(page)).toBe(true);

    await inPage(page, () => { fake.hidden = false; });
    await page.clock.runFor(4500);
    await page.waitForURL(/[?&]t=70s/);
  });

  test('reloads the same video at most once a minute', async ({ page }) => {
    await openPlayer(page, { url: WATCH, setup: stuck });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(4500);
    await page.waitForURL(/[?&]t=70s/);

    // Stuck again after the reload: leave it, rather than risk reloading over and over.
    await inPage(page, stuck);
    await markPage(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(10_000);
    expect(await stillHere(page)).toBe(true);
  });

  test("does nothing on a page that isn't the video's own", async ({ page }) => {
    await openPlayer(page, { url: 'https://www.youtube.com/', setup: stuck });
    await markPage(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(10_000);
    expect(await stillHere(page)).toBe(true);
  });
});

test.describe('m.youtube.com', () => {
  const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
  test.use(pixel);

  test('reloads a stuck video at the time it was skipping to', async ({ page }) => {
    const url = 'https://m.youtube.com/watch?v=video-1';
    await openPlayer(page, { ui: 'mobile', url, setup: stuck });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(4500);
    await page.waitForURL(`${url}&ui=mobile&t=70s`);
  });
});

test('embedded player: reloads a stuck video with start=', async ({ page }) => {
  const url = 'https://www.youtube-nocookie.com/embed/video-1?rel=0';
  await openPlayer(page, { url, setup: stuck });
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(4500);
  await page.waitForURL(`${url}&ui=desktop&start=70`);
});
