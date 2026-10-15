/* global fake */
const { test, expect } = require('@playwright/test');
const { openPlayer, runUserscript, inPage, playerState } = require('./helpers');

const SCRIPT = 'no-livestream-chat.user.js';

test('closes the chat on a livestream', async ({ page }) => {
  await openPlayer(page, { setup: () => fake.showLiveChat() });
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(300);
  expect(await playerState(page)).toMatchObject({ chatOpen: false, chatScriptClicks: 1 });
});

test('waits for the chat to finish loading', async ({ page }) => {
  await openPlayer(page, { setup: () => fake.showLiveChat({ loaded: false }) });
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(3000);
  expect(await playerState(page)).toMatchObject({ chatOpen: true, chatScriptClicks: 0 });

  await inPage(page, () => fake.loadLiveChat());
  await page.clock.runFor(300);
  expect(await playerState(page)).toMatchObject({ chatOpen: false, chatScriptClicks: 1 });
});

test('tries again, at most once a second, if YouTube ignores the click', async ({ page }) => {
  await openPlayer(page, { setup: () => { fake.chatCloseReady = false; fake.showLiveChat(); } });
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(300);
  await inPage(page, () => { fake.chatCloseReady = true; });
  await page.clock.runFor(600);
  expect(await playerState(page)).toMatchObject({ chatOpen: true, chatScriptClicks: 1 });

  await page.clock.runFor(600); // the first check at least a second after the first click
  expect(await playerState(page)).toMatchObject({ chatOpen: false, chatScriptClicks: 2 });
});

test('leaves the chat open after the user reopens it', async ({ page }) => {
  await openPlayer(page, { setup: () => fake.showLiveChat() });
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(1000);
  await page.click('#open-chat');
  await page.clock.runFor(10_000);
  expect(await playerState(page)).toMatchObject({ chatOpen: true, chatScriptClicks: 1 });
});

test('leaves the chat alone after the user closes it first', async ({ page }) => {
  await openPlayer(page, { setup: () => { fake.chatCloseReady = false; fake.showLiveChat(); } });
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(300); // the script's click is ignored
  await inPage(page, () => { fake.chatCloseReady = true; });
  await page.frameLocator('#chatframe').locator('#close-button button').click();
  await page.clock.runFor(1000);
  await page.click('#open-chat');
  await page.clock.runFor(10_000);
  expect(await playerState(page)).toMatchObject({ chatOpen: true, chatScriptClicks: 1 });
});

test('closes the chat again on the next livestream', async ({ page }) => {
  await openPlayer(page, { setup: () => fake.showLiveChat() });
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(5000);
  await inPage(page, () => { fake.loadVideo('video-2'); fake.setChatOpen(true); });
  await page.clock.runFor(1000);
  expect(await playerState(page)).toMatchObject({ chatOpen: false, chatScriptClicks: 2 });
});

test("isn't fooled by the previous video's closed chat when switching videos", async ({ page }) => {
  await openPlayer(page, { setup: () => fake.showLiveChat() });
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(5000);
  // The next video starts before YouTube reopens its chat.
  await inPage(page, () => fake.loadVideo('video-2'));
  await page.clock.runFor(900);
  await inPage(page, () => fake.setChatOpen(true));
  await page.clock.runFor(1000);
  expect(await playerState(page)).toMatchObject({ chatOpen: false, chatScriptClicks: 2 });
});

test('does nothing when the chat is already closed', async ({ page }) => {
  await openPlayer(page, { setup: () => fake.showLiveChat({ open: false }) });
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(10_000);
  expect(await playerState(page)).toMatchObject({ chatOpen: false, chatScriptClicks: 0 });
});

test('does nothing, without errors, on a video without chat', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openPlayer(page);
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(5000);
  expect(errors).toEqual([]);
  expect((await playerState(page)).chatScriptClicks).toBe(0);
});
