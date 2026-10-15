# yt-enhancements

Small userscripts that improve YouTube. Each script is a single self-contained
`.user.js` file with no dependencies.

All scripts run on `www.youtube.com`, `m.youtube.com` and embedded players
(including `youtube-nocookie.com` embeds).

## Scripts

| Script | What it does | Install |
| --- | --- | --- |
| [best-quality.user.js](best-quality.user.js) | Sets every video to the highest available quality. | [Install](https://github.com/OoyaSan/yt-enhancements/raw/main/best-quality.user.js) |
| [captions-off.user.js](captions-off.user.js) | Starts every video with captions off, without overriding you if you turn them on. | [Install](https://github.com/OoyaSan/yt-enhancements/raw/main/captions-off.user.js) |

### best-quality

Once per video, after any pre-roll ad, locks playback to the top entry of the
player's available quality levels (e.g. 2160p if offered, otherwise 1080p, and so on).
After that it leaves quality alone, so you can still change it manually.

### captions-off

YouTube sometimes turns captions on by itself, for example when it remembers that you
turned them on for an earlier video. This script turns them back off during the first
8 seconds of each video (not counting ads or time spent in a background tab). It acts
at most once per video, and stops for that video as soon as you use the CC button, the
player settings menu or the `c` shortcut, so it never undoes your own choice.

## Installing

1. Install a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/)
   or [Tampermonkey](https://www.tampermonkey.net/).
   - On Chrome, you may also need to turn on **Allow User Scripts** (or Developer mode)
     in the extension's settings before scripts will run.
2. Click an **Install** link above. The manager opens an install prompt.
3. To use the scripts in incognito/private windows, allow the userscript manager to run
   there (in Chrome: the extension's details page → **Allow in Incognito**).

## Development

The managers check for updates based on each script's `@version`, so bump it whenever
you change a script.

### Tests

The tests use [Playwright](https://playwright.dev/) and need Node.js:

```bash
npm install
npx playwright install chromium
npm test
```

`npm test` runs the scripts against a fake YouTube player
([tests/fixtures/player.html](tests/fixtures/player.html)) in headless Chromium. A fake
clock makes the polling and the 8-second captions window run instantly, and clicks, taps
and key presses are real browser input, so the "user changed captions" cases are tested
for real. It covers desktop and m.youtube.com (emulated phone) and needs no network.
GitHub Actions runs it on every push to `main` and on every pull request
([.github/workflows/test.yml](.github/workflows/test.yml)); you can also start a run by hand
from the Actions tab.

`npm run test:live` runs a few checks against the real YouTube (www, m. and a
youtube-nocookie embed). They confirm the player still has the methods and controls the
scripts use, and that the scripts still work there. The fake player only reflects YouTube
as of when it was written, so run this now and then, and whenever a script seems broken.
It needs network access, can be flaky (ads, bot checks), and skips itself if YouTube shows
a cookie consent page.

If YouTube changes its player, update the fake player to match so the fixture tests keep
describing reality.
