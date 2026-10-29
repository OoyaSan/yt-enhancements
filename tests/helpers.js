const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const FIXTURE_FILE = path.join(__dirname, 'fixtures', 'player.html');
const FIXTURE = pathToFileURL(FIXTURE_FILE).href;
const HISTORY_FILE = path.join(__dirname, 'fixtures', 'history.html');
const START = new Date('2026-01-01T00:00:00Z');

/**
 * Opens the fake player with a paused fake clock, so timers only run via page.clock.runFor().
 * `setup` runs in the page (with access to window.fake) before the userscript is injected.
 * `url` serves the fake player at that address instead (e.g. a youtube.com watch page), along with
 * every other page on that site, without touching the network.
 */
async function openPlayer(page, { ui = 'desktop', setup, url } = {}) {
  await page.clock.install({ time: START });
  if (url) {
    const target = new URL(url);
    await page.route(`${target.origin}/**`, (route) => route.fulfill({ path: FIXTURE_FILE, contentType: 'text/html' }));
    target.searchParams.set('ui', ui);
    await page.goto(target.href);
  } else {
    await page.goto(`${FIXTURE}?ui=${ui}`);
  }
  await page.clock.pauseAt(new Date(START.getTime() + 60_000));
  if (setup) await page.evaluate(setup);
}

/**
 * Opens the fake watch history at www.youtube.com/feed/history (without touching the network), with a
 * paused fake clock, showing `entries`: [{ day, id, title, channels: [[channelId, name], ...] }].
 */
async function openHistory(page, entries, { pageSize } = {}) {
  await page.clock.install({ time: START });
  await page.route('https://www.youtube.com/**', (route) => route.fulfill({ path: HISTORY_FILE, contentType: 'text/html' }));
  await page.goto('https://www.youtube.com/feed/history');
  await page.clock.pauseAt(new Date(START.getTime() + 60_000));
  await page.evaluate(([e, o]) => fake.load(e, o), [entries, { pageSize }]);
}

/** Injects a userscript from the repo root, like a userscript manager at document-idle. */
async function runUserscript(page, file) {
  await page.addScriptTag({ path: path.join(ROOT, file) });
}

/** Runs `fn` in the page, where `fake` is the fake player's control object. */
const inPage = (page, fn) => page.evaluate(fn);

/** Snapshot of the fake player's state. */
const playerState = (page) =>
  page.evaluate(() => ({
    captionsOn: fake.captionsOn,
    quality: fake.quality,
    preferredQuality: fake.preferredQuality,
    autoplayOn: fake.autoplayOn,
    autoplayScriptClicks: fake.autoplayScriptClicks,
    chatOpen: (() => { const c = document.querySelector('ytd-live-chat-frame'); return !!c && !c.hasAttribute('collapsed'); })(),
    chatScriptClicks: fake.chatScriptClicks,
    calls: fake.calls,
  }));

/** Snapshot of the fake watch history's state. */
const historyState = (page) =>
  page.evaluate(() => ({
    removed: fake.removed.slice().sort(),
    shown: fake.shown(),
    searches: fake.navigations,
    watched: fake.watched,
    menuOpen: fake.menuOpen(),
  }));

module.exports = { openPlayer, openHistory, runUserscript, inPage, playerState, historyState };
