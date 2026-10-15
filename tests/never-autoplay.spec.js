/* global fake */
const { test, expect, devices } = require('@playwright/test');
const { openPlayer, runUserscript, inPage, playerState } = require('./helpers');

const SCRIPT = 'never-autoplay.user.js';

test.describe('www.youtube.com', () => {
  test('turns Autoplay off', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ autoplayOn: false, autoplayScriptClicks: 1 });
  });

  test('works while YouTube hides the toggle', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.hideAutoplayToggle() });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect((await playerState(page)).autoplayOn).toBe(false);
  });

  test('does nothing when Autoplay is already off', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.setAutoplay(false) });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ autoplayOn: false, autoplayScriptClicks: 0 });
  });

  test('tries again if YouTube ignores the first click', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.autoplayReady = false; } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ autoplayOn: true, autoplayScriptClicks: 1 });

    await inPage(page, () => { fake.autoplayReady = true; });
    await page.clock.runFor(1500); // waits 2s between clicks
    expect((await playerState(page)).autoplayScriptClicks).toBe(1);

    await page.clock.runFor(600);
    expect(await playerState(page)).toMatchObject({ autoplayOn: false, autoplayScriptClicks: 2 });
  });

  test('does not undo a click YouTube is still applying', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.autoplayApplyDelay = 1500; } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ autoplayOn: false, autoplayScriptClicks: 1 });
  });

  test('turns Autoplay off again if YouTube turns it back on', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(5000);
    await inPage(page, () => fake.setAutoplay(true));
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ autoplayOn: false, autoplayScriptClicks: 2 });
  });

  test('leaves Autoplay on after the user turns it on', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.setAutoplay(false) });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(1000);
    await page.click('.ytp-autonav-toggle');
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ autoplayOn: true, autoplayScriptClicks: 0 });
  });

  test('still acts after the user clicks elsewhere in the player', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.setAutoplay(false) });
    await runUserscript(page, SCRIPT);
    await page.click('#movie_player .video');
    await page.click('.ytp-settings-button');
    await inPage(page, () => fake.setAutoplay(true));
    await page.clock.runFor(300);
    expect((await playerState(page)).autoplayOn).toBe(false);
  });
});

test.describe('m.youtube.com', () => {
  const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
  test.use(pixel);

  test('waits for the toggle to appear with the controls, then turns Autoplay off', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openPlayer(page, { ui: 'mobile' });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(5000);
    expect(await playerState(page)).toMatchObject({ autoplayOn: true, autoplayScriptClicks: 0 });

    await inPage(page, () => fake.showControls());
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ autoplayOn: false, autoplayScriptClicks: 1 });
    expect(errors).toEqual([]);
  });

  test('leaves Autoplay on after the user taps it on', async ({ page }) => {
    await openPlayer(page, { ui: 'mobile', setup: () => { fake.showControls(); fake.setAutoplay(false); } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(1000);
    await page.tap('.ytwAutonavToggleButtonHost');
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ autoplayOn: true, autoplayScriptClicks: 0 });
  });
});
