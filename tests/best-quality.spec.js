/* global fake */
const { test, expect, devices } = require('@playwright/test');
const { openPlayer, runUserscript, inPage, playerState } = require('./helpers');

const SCRIPT = 'best-quality.user.js';
const setTo = (q) => [
  { fn: 'setPlaybackQualityRange', args: [q, q] },
  { fn: 'setPlaybackQuality', args: [q] },
];

test.describe('desktop', () => {
  test('sets the highest available quality', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ quality: 'hd1080', calls: setTo('hd1080') });
  });

  test('never picks "auto"', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.qualityLevels = ['auto', 'hd720', 'large']; } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect((await playerState(page)).quality).toBe('hd720');
  });

  test('waits until the player lists quality levels', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.qualityLevels = []; } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(2000);
    expect((await playerState(page)).calls).toEqual([]);

    await inPage(page, () => { fake.qualityLevels = ['hd1440', 'hd1080', 'auto']; });
    await page.clock.runFor(300);
    expect((await playerState(page)).quality).toBe('hd1440');
  });

  test('waits for an ad to finish', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.setAd(true) });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(5000);
    expect((await playerState(page)).calls).toEqual([]);

    await inPage(page, () => fake.setAd(false));
    await page.clock.runFor(300);
    expect((await playerState(page)).quality).toBe('hd1080');
  });

  test('sets quality once per video, so manual changes stick', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    await inPage(page, () => { fake.quality = 'medium'; }); // user picks 360p
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ quality: 'medium', calls: setTo('hd1080') });
  });

  test('sets quality again for the next video', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    await inPage(page, () => fake.loadVideo('video-2', { qualityLevels: ['hd2160', 'hd1080', 'auto'] }));
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({
      quality: 'hd2160',
      calls: [...setTo('hd1080'), ...setTo('hd2160')],
    });
  });

  test('still works without setPlaybackQualityRange', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.removeApi('setPlaybackQualityRange') });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({
      quality: 'hd1080',
      calls: [{ fn: 'setPlaybackQuality', args: ['hd1080'] }],
    });
  });
});

test.describe('m.youtube.com', () => {
  const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
  test.use(pixel);

  test('sets the highest available quality', async ({ page }) => {
    await openPlayer(page, { ui: 'mobile' });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ quality: 'hd1080', calls: setTo('hd1080') });
  });
});
