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

  test('waits for the video to start playing', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.playerState = -1; } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(5000);
    expect((await playerState(page)).calls).toEqual([]);

    await inPage(page, () => { fake.playerState = 1; });
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ quality: 'hd1080', calls: setTo('hd1080') });
  });

  test('sets quality straight away on players that do not report their state', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.playerState = -1; fake.removeApi('getPlayerState'); } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect((await playerState(page)).calls).toEqual(setTo('hd1080'));
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

  test('sets quality once while YouTube keeps the setting', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    await inPage(page, () => { fake.quality = 'medium'; }); // playing lower for now, still set to 1080p
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ quality: 'medium', calls: setTo('hd1080') });
  });

  test('sets quality again when YouTube reloads the video', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    await inPage(page, () => fake.reloadVideo());
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({
      preferredQuality: 'hd1080',
      calls: [...setTo('hd1080'), ...setTo('hd1080')],
    });
  });

  test('checks again only once the reloaded video is playing', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    await inPage(page, () => { fake.playerState = -1; fake.reloadVideo(); });
    await page.clock.runFor(5000);
    expect((await playerState(page)).calls).toEqual(setTo('hd1080'));

    await inPage(page, () => { fake.playerState = 1; });
    await page.clock.runFor(300);
    expect((await playerState(page)).calls).toEqual([...setTo('hd1080'), ...setTo('hd1080')]);
  });

  test('gives up if YouTube keeps dropping the setting', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.qualityLockSticks = false; } });
    await runUserscript(page, SCRIPT);
    for (let i = 0; i < 5; i++) {
      await page.clock.runFor(1000);
      await inPage(page, () => fake.reloadVideo());
    }
    await page.clock.runFor(1000);
    expect((await playerState(page)).calls).toHaveLength(3 * setTo('hd1080').length);
  });

  test('leaves quality alone after the user picks one in the settings menu', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    await page.click('.ytp-settings-button');
    await page.click('[data-quality="medium"]');
    await page.clock.runFor(1000);
    await inPage(page, () => fake.reloadVideo());
    await page.clock.runFor(10_000);
    expect((await playerState(page)).calls).toEqual(setTo('hd1080'));
  });

  test('does not override a quality the user picked during an ad', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.setAd(true) });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(1000);
    await page.click('.ytp-settings-button');
    await page.click('[data-quality="medium"]');
    await inPage(page, () => fake.setAd(false));
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ preferredQuality: 'medium', calls: [] });
  });

  test('sets quality again for the next video after the user picked one', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    await page.click('.ytp-settings-button');
    await page.click('[data-quality="medium"]');
    await inPage(page, () => fake.loadVideo('video-2'));
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({
      preferredQuality: 'hd1080',
      calls: [...setTo('hd1080'), ...setTo('hd1080')],
    });
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

  test('still sets quality once without getPreferredQuality', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.removeApi('getPreferredQuality') });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    await inPage(page, () => fake.reloadVideo());
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ calls: setTo('hd1080') });
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

  test('leaves quality alone after the user opens playback settings', async ({ page }) => {
    await openPlayer(page, { ui: 'mobile' });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    await page.tap('.player-settings-icon');
    await inPage(page, () => fake.reloadVideo());
    await page.clock.runFor(10_000);
    expect((await playerState(page)).calls).toEqual(setTo('hd1080'));
  });
});
