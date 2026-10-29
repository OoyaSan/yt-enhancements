/* global fake */
const { test, expect } = require('@playwright/test');
const { openHistory, runUserscript, inPage, historyState } = require('./helpers');

const SCRIPT = 'quick-history-delete.user.js';

const RICK = ['UCuAXFkgsw1L7xaCfnd5JJOw', 'Rick Astley'];
const LOFI = ['UCSJ4gkVC6NrvII8umztf0Ow', 'Lofi Girl'];
const INSIDER = ['UCGg-UqjRgzhYDPJMr-9HXCg', 'Creator Insider'];
const HISTORY = [
  { day: 'Oct 18', id: 'rick-1', title: 'Never Gonna Give You Up', channels: [RICK] },
  { day: 'Oct 18', id: 'lofi-1', title: 'lofi hip hop radio', channels: [LOFI] },
  { day: 'Oct 14', id: 'rick-2', title: 'Together Forever', channels: [RICK] },
  { day: 'Oct 14', id: 'rick-1', title: 'Never Gonna Give You Up', channels: [RICK] }, // watched again
  { day: 'Oct 9', id: 'about-rick', title: 'Why Rick Astley still matters', channels: [LOFI] },
  { day: 'Oct 9', id: 'collab', title: 'Made on YouTube', channels: [INSIDER, RICK] }, // a collaboration
];

const removeButtons = (page) => page.getByRole('button', { name: 'Remove from watch history' });
const channelButton = (page, name) => page.getByRole('button', { name: `Remove all videos from ${name} from watch history` });
const status = (page) => page.locator('.qhd-status');
const dialog = (page) => page.getByRole('dialog');

async function start(page, entries = HISTORY, options) {
  // Like a browser set to block page dialogs: confirm() and the like answer no.
  page.on('dialog', (d) => d.dismiss());
  await openHistory(page, entries, options);
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(500);
}

/** Clicks the first button for removing the channel's videos, and answers "Remove all". */
async function removeChannel(page, name) {
  await channelButton(page, name).first().click();
  await dialog(page).getByRole('button', { name: 'Remove all' }).click();
}

test('adds a remove button to each video', async ({ page }) => {
  await start(page);
  await expect(removeButtons(page)).toHaveCount(HISTORY.length);
  await expect(channelButton(page, 'Rick Astley')).toHaveCount(3);
  await expect(channelButton(page, 'Lofi Girl')).toHaveCount(2);
  // A collaboration's button is for its first channel.
  await expect(channelButton(page, 'Creator Insider')).toHaveCount(1);
  // Lined up below each ⋮ button, however long the title.
  const columns = await page.locator('yt-lockup-view-model').evaluateAll((items) => items.map((i) => [
    i.querySelector('.ytLockupMetadataViewModelMenuButton button').getBoundingClientRect().right,
    i.querySelector('.qhd-actions button').getBoundingClientRect().right,
  ]));
  for (const [menu, remove] of columns) expect(remove).toBe(menu);
});

test('the remove button removes that video, through its ⋮ menu', async ({ page }) => {
  await start(page);
  await removeButtons(page).nth(1).click();
  await page.clock.runFor(1000);
  expect(await historyState(page)).toMatchObject({
    removed: ['lofi-1'],
    shown: ['rick-1', 'rick-2', 'rick-1', 'about-rick', 'collab'],
    watched: [], // the click didn't open the video
    menuOpen: false,
  });
  // YouTube's notice in the item's place is the only message.
  await expect(page.locator('yt-lockup-view-model').nth(1)).toContainText('All views of this video removed from history');
  await page.clock.runFor(30_000);
  await expect(status(page)).toBeHidden();
  expect(await inPage(page, () => [fake.menuOpens, fake.removeRequests])).toEqual([1, 1]);
});

test('removing a video watched on several days removes all its views', async ({ page }) => {
  await start(page);
  await removeButtons(page).nth(0).click();
  await page.clock.runFor(1000);
  expect(await historyState(page)).toMatchObject({ removed: ['rick-1'], shown: ['lofi-1', 'rick-2', 'about-rick', 'collab'] });
});

test('keeps the ⋮ menu out of sight while using it', async ({ page }) => {
  await start(page);
  await removeButtons(page).nth(0).click();
  await page.clock.runFor(10);
  expect(await historyState(page)).toMatchObject({ menuOpen: true });
  await expect(page.locator('tp-yt-iron-dropdown')).toHaveCSS('opacity', '0');

  await page.clock.runFor(1000);
  await page.click('.ytLockupMetadataViewModelMenuButton button'); // the user's own click on a ⋮
  await page.clock.runFor(10);
  await expect(page.locator('tp-yt-iron-dropdown')).toHaveCSS('opacity', '1');
});

test('removes one video at a time when clicked quickly', async ({ page }) => {
  await start(page);
  await removeButtons(page).nth(1).click();
  await removeButtons(page).nth(2).click();
  await page.clock.runFor(2000);
  expect(await historyState(page)).toMatchObject({ removed: ['lofi-1', 'rick-2'] });
  expect(await inPage(page, () => fake.menuOpens)).toBe(2);
});

test('acts on the video an item shows now, if YouTube reuses the item', async ({ page }) => {
  await start(page);
  await inPage(page, () => fake.reuse(1, { day: 'Oct 18', id: 'other', title: 'Another video', channels: [['UCother', 'Other']] }));
  await page.clock.runFor(500);
  await expect(channelButton(page, 'Other')).toHaveCount(1);
  await removeButtons(page).nth(1).click();
  await page.clock.runFor(1000);
  expect((await historyState(page)).removed).toEqual(['other']);
});

test("says so, and lets you try again, if a video can't be removed", async ({ page }) => {
  await start(page);
  await inPage(page, () => { fake.removeWorks = false; });
  await removeButtons(page).nth(1).click();
  await page.clock.runFor(25_000);
  expect(await historyState(page)).toMatchObject({ removed: [], menuOpen: false });
  expect(await inPage(page, () => fake.removeRequests)).toBe(2); // tried twice
  await expect(status(page)).toContainText("Couldn't remove this video");
  await expect(removeButtons(page).nth(1)).toBeEnabled();

  await inPage(page, () => { fake.removeWorks = true; });
  await removeButtons(page).nth(1).click();
  await page.clock.runFor(1000);
  expect((await historyState(page)).removed).toEqual(['lofi-1']);
});

test('the channel button removes every video from that channel', async ({ page }) => {
  await start(page);
  await channelButton(page, 'Rick Astley').first().click();
  await expect(dialog(page)).toContainText('Remove all videos from Rick Astley from your watch history?');
  await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog(page).getByRole('button', { name: 'Remove all' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.clock.runFor(10_000);
  expect(await historyState(page)).toMatchObject({
    searches: ['Rick Astley'],
    // Including the collaboration; not the video that only mentions the channel.
    removed: ['collab', 'rick-1', 'rick-2'],
    shown: ['about-rick'],
  });
  await expect(status(page)).toContainText('Removed 3 videos from Rick Astley from your watch history.');
  expect(await inPage(page, () => fake.history.filter((e) => !e.removed).map((e) => e.video.id))).toEqual(['lofi-1', 'about-rick']);
});

test('loads more of the history as it goes', async ({ page }) => {
  // The history loads 6 entries at a time; after the first video, the next ones from the channel are
  // past a screenful of other search results.
  const entries = [{ day: 'Oct 20', id: 'rick-0', title: 'Rick video 0', channels: [RICK] }];
  for (let i = 0; i < 10; i++) entries.push({ day: 'Oct 19', id: `about-${i}`, title: `About Rick Astley ${i}`, channels: [LOFI] });
  for (let i = 1; i < 4; i++) entries.push({ day: 'Oct 18', id: `rick-${i}`, title: `Rick video ${i}`, channels: [RICK] });
  await start(page, entries, { pageSize: 6 });
  await removeChannel(page, 'Rick Astley');
  await page.clock.runFor(30_000);
  expect((await historyState(page)).removed).toEqual(['rick-0', 'rick-1', 'rick-2', 'rick-3']);
  await expect(status(page)).toContainText('Removed 4 videos from Rick Astley');
});

test('does nothing if you cancel', async ({ page }) => {
  await start(page);
  await channelButton(page, 'Rick Astley').first().click();
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await channelButton(page, 'Lofi Girl').first().click();
  await page.keyboard.press('Escape');
  await page.clock.runFor(10_000);
  await expect(dialog(page)).toHaveCount(0);
  expect(await historyState(page)).toMatchObject({ searches: [], removed: [], watched: [] });

  await removeChannel(page, 'Lofi Girl'); // and asks again next time
  await page.clock.runFor(10_000);
  expect((await historyState(page)).removed).toEqual(['about-rick', 'lofi-1']);
});

test('Stop ends removing a channel', async ({ page }) => {
  await start(page);
  await inPage(page, () => { fake.removeDelay = 1000; });
  await removeChannel(page, 'Rick Astley');
  await page.clock.runFor(1000); // searched, and removing the first video
  await status(page).getByRole('button', { name: 'Stop' }).click();
  await page.clock.runFor(10_000);
  expect((await historyState(page)).removed).toEqual(['rick-1']);
  await expect(status(page)).toContainText('Stopped. Removed 1 video from Rick Astley');
});

test('stops removing a channel if a video can\'t be removed', async ({ page }) => {
  await start(page);
  await removeChannel(page, 'Rick Astley');
  await page.clock.runFor(1000);
  await inPage(page, () => { fake.removeWorks = false; });
  await page.clock.runFor(30_000);
  expect((await historyState(page)).removed).toEqual(['rick-1']);
  await expect(status(page)).toContainText("Removed 1 video from Rick Astley from your watch history. Then one couldn't be removed");
});

test('does nothing, without errors, on other pages', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openHistory(page, HISTORY);
  await inPage(page, () => document.querySelector('ytd-browse').setAttribute('page-subtype', 'subscriptions'));
  await runUserscript(page, SCRIPT);
  await page.clock.runFor(5000);
  expect(errors).toEqual([]);
  await expect(removeButtons(page)).toHaveCount(0);
});
