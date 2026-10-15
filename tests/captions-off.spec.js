/* global fake */
const { test, expect, devices } = require('@playwright/test');
const { openPlayer, runUserscript, inPage, playerState } = require('./helpers');

const SCRIPT = 'captions-off.user.js';
const TURN_OFF = { fn: 'setOption', args: ['captions', 'track', {}] };

test.describe('desktop', () => {
  test('turns off captions that are on when the video starts', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.setCaptions(true) });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ captionsOn: false, calls: [TURN_OFF] });
  });

  test('turns off captions that YouTube enables a few seconds in', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(2000);
    await inPage(page, () => fake.setCaptions(true));
    await page.clock.runFor(300);
    expect((await playerState(page)).captionsOn).toBe(false);
  });

  test('does nothing when captions are already off', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(10_000);
    expect((await playerState(page)).calls).toEqual([]);
  });

  test('stops acting 8 seconds into the video', async ({ page }) => {
    await openPlayer(page);
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(9000);
    await inPage(page, () => fake.setCaptions(true));
    await page.clock.runFor(1000);
    expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [] });
  });

  test('turns captions off at most once per video', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.setCaptions(true) });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(2000);
    await inPage(page, () => fake.setCaptions(true));
    await page.clock.runFor(6000);
    expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [TURN_OFF] });
  });

  test('starts over for the next video', async ({ page }) => {
    await openPlayer(page, { setup: () => fake.setCaptions(true) });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(20_000);
    await inPage(page, () => fake.loadVideo('video-2', { captionsOn: true }));
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ captionsOn: false, calls: [TURN_OFF, TURN_OFF] });
  });

  test('does not start the 8s window during an ad', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.setAd(true); fake.setCaptions(true); } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(20_000);
    expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [] });

    await inPage(page, () => fake.setAd(false));
    await page.clock.runFor(300);
    expect((await playerState(page)).captionsOn).toBe(false);
  });

  test('does not start the 8s window in a background tab', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.hidden = true; fake.setCaptions(true); } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(20_000);
    expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [] });

    await inPage(page, () => { fake.hidden = false; });
    await page.clock.runFor(300);
    expect((await playerState(page)).captionsOn).toBe(false);
  });

  test.describe('leaves captions alone after the user', () => {
    test('clicks the CC button', async ({ page }) => {
      await openPlayer(page);
      await runUserscript(page, SCRIPT);
      await page.clock.runFor(1000);
      await page.click('.ytp-subtitles-button');
      await page.clock.runFor(10_000);
      expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [] });
    });

    test('clicks the CC button before the script first checks the player', async ({ page }) => {
      await openPlayer(page);
      await runUserscript(page, SCRIPT);
      await page.click('.ytp-subtitles-button');
      await page.clock.runFor(10_000);
      expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [] });
    });

    test('presses the "c" shortcut', async ({ page }) => {
      await openPlayer(page);
      await runUserscript(page, SCRIPT);
      await page.clock.runFor(1000);
      await page.keyboard.press('c');
      await page.clock.runFor(10_000);
      expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [] });
    });

    test('picks captions in the settings menu', async ({ page }) => {
      await openPlayer(page);
      await runUserscript(page, SCRIPT);
      await page.clock.runFor(1000);
      await page.click('.ytp-settings-button');
      await page.click('text=Captions: English');
      await page.clock.runFor(10_000);
      expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [] });
    });
  });

  test.describe('still acts after the user', () => {
    test('types "c" in a text field', async ({ page }) => {
      await openPlayer(page);
      await runUserscript(page, SCRIPT);
      await page.locator('#search').press('c');
      await inPage(page, () => fake.setCaptions(true));
      await page.clock.runFor(300);
      expect((await playerState(page)).captionsOn).toBe(false);
    });

    test('presses Ctrl+C', async ({ page }) => {
      await openPlayer(page);
      await runUserscript(page, SCRIPT);
      await page.keyboard.press('Control+c');
      await inPage(page, () => fake.setCaptions(true));
      await page.clock.runFor(300);
      expect((await playerState(page)).captionsOn).toBe(false);
    });

    test('clicks the video itself', async ({ page }) => {
      await openPlayer(page);
      await runUserscript(page, SCRIPT);
      await page.click('#movie_player .video');
      await inPage(page, () => fake.setCaptions(true));
      await page.clock.runFor(300);
      expect((await playerState(page)).captionsOn).toBe(false);
    });
  });

  test('falls back to the CC button when the player API is missing', async ({ page }) => {
    await openPlayer(page, { setup: () => { fake.removeApi('isSubtitlesOn'); fake.setCaptions(true); } });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ captionsOn: false, calls: [] });
  });
});

test.describe('m.youtube.com', () => {
  const { defaultBrowserType, ...pixel } = devices['Pixel 7'];
  test.use(pixel);

  test('turns off captions that are on when the video starts', async ({ page }) => {
    await openPlayer(page, { ui: 'mobile', setup: () => fake.setCaptions(true) });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(300);
    expect(await playerState(page)).toMatchObject({ captionsOn: false, calls: [TURN_OFF] });
  });

  test('leaves captions alone after the user taps the CC button', async ({ page }) => {
    await openPlayer(page, { ui: 'mobile' });
    await runUserscript(page, SCRIPT);
    await page.clock.runFor(1000);
    await page.tap('.ytmClosedCaptioningButtonButton');
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [] });
  });

  test('leaves captions alone after the user opens playback settings', async ({ page }) => {
    await openPlayer(page, { ui: 'mobile' });
    await runUserscript(page, SCRIPT);
    await page.tap('.player-settings-icon');
    await inPage(page, () => fake.setCaptions(true)); // as if picked from the settings sheet
    await page.clock.runFor(10_000);
    expect(await playerState(page)).toMatchObject({ captionsOn: true, calls: [] });
  });
});
