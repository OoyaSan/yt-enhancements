const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const FIXTURE = pathToFileURL(path.join(__dirname, 'fixtures', 'player.html')).href;
const START = new Date('2026-01-01T00:00:00Z');

/**
 * Opens the fake player with a paused fake clock, so timers only run via page.clock.runFor().
 * `setup` runs in the page (with access to window.fake) before the userscript is injected.
 */
async function openPlayer(page, { ui = 'desktop', setup } = {}) {
  await page.clock.install({ time: START });
  await page.goto(`${FIXTURE}?ui=${ui}`);
  await page.clock.pauseAt(new Date(START.getTime() + 60_000));
  if (setup) await page.evaluate(setup);
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
    autoplayOn: fake.autoplayOn,
    autoplayScriptClicks: fake.autoplayScriptClicks,
    calls: fake.calls,
  }));

module.exports = { openPlayer, runUserscript, inPage, playerState };
