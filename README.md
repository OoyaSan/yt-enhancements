# yt-enhancements

Small userscripts that improve YouTube. Each script is a single self-contained
`.user.js` file with no dependencies.

The scripts run on `www.youtube.com` and `m.youtube.com`, except no-livestream-chat, which
only runs on `www.youtube.com` because the mobile site doesn't show livestream chat, and
quick-history-delete, which only works on the `www.youtube.com` watch history.
best-quality, captions-off and unstick-start also run in embedded players (including
`youtube-nocookie.com` embeds).

## Scripts

| Script | What it does | Install |
| --- | --- | --- |
| [best-quality.user.js](best-quality.user.js) | Sets every video to the highest available quality. | [Install](https://github.com/OoyaSan/yt-enhancements/raw/main/best-quality.user.js) |
| [captions-off.user.js](captions-off.user.js) | Starts every video with captions off, without overriding you if you turn them on. | [Install](https://github.com/OoyaSan/yt-enhancements/raw/main/captions-off.user.js) |
| [never-autoplay.user.js](never-autoplay.user.js) | Keeps Autoplay (playing the next video when one ends) turned off. | [Install](https://github.com/OoyaSan/yt-enhancements/raw/main/never-autoplay.user.js) |
| [no-livestream-chat.user.js](no-livestream-chat.user.js) | Closes the chat on livestreams, and chat replay on past streams. | [Install](https://github.com/OoyaSan/yt-enhancements/raw/main/no-livestream-chat.user.js) |
| [quick-history-delete.user.js](quick-history-delete.user.js) | Adds buttons to your watch history that remove a video, or every video from its channel, in one click. | [Install](https://github.com/OoyaSan/yt-enhancements/raw/main/quick-history-delete.user.js) |
| [unstick-start.user.js](unstick-start.user.js) | Reloads a video that gets stuck loading because something (like SponsorBlock) skipped ahead before it started. | [Install](https://github.com/OoyaSan/yt-enhancements/raw/main/unstick-start.user.js) |

### best-quality

Once each video has started playing, after any pre-roll ad, locks playback to the top entry
of the player's available quality levels (e.g. 2160p if offered, otherwise 1080p, and so on).
It waits for playback because switching quality before the first frame can hold up the start
by several seconds, so a video that's paused before it starts keeps YouTube's choice until you
press play.

If YouTube then reloads the video, which drops the setting (it does this, for example, to retry
a stalled start), the script sets it again, at most three times per video. As soon as you open
the player's settings during a video, it leaves that video's quality alone, so your own choice
sticks.

### captions-off

YouTube sometimes turns captions on by itself, for example when it remembers that you
turned them on for an earlier video. This script turns them back off during the first
8 seconds of each video (not counting ads or time spent in a background tab). It acts
at most once per video, and stops for that video as soon as you use the CC button, the
player settings menu or the `c` shortcut, so it never undoes your own choice.

### never-autoplay

Whenever YouTube's Autoplay setting is on, including in each new incognito window, this
script clicks the player's Autoplay toggle to turn it off, and YouTube saves the change as
it would for your own click. Right after a page loads YouTube can ignore clicks on the
toggle, so the script retries every 2 seconds until it takes. On m.youtube.com the toggle
only exists once the player controls have been shown, so it's turned off the first time
you tap the player. If you flip the toggle yourself, the script leaves it alone until you
close the tab.

This is about the next video starting when one ends. It doesn't stop a video from
starting by itself when you open its page. Some YouTube sessions get a player whose
Autoplay toggle is hidden and doesn't respond; those sessions don't autoplay the next
video either, so the script has nothing to do there.

### no-livestream-chat

YouTube opens the chat beside every livestream, and the chat replay beside past streams,
on every page load. This script clicks the chat's own Close button as soon as the chat has
loaded, trying again every second if YouTube ignores the click. Once the chat has been
closed for a video, whether by the script or by you, the script leaves it alone, so you
can reopen it with **Open panel** under the video and it stays open until the next video.

### quick-history-delete

On your [watch history](https://www.youtube.com/feed/history), each video gets two buttons
below its ⋮ menu button:

- **Remove from watch history** (trash can) removes the video right away, the same as
  choosing **Remove from watch history** in its ⋮ menu. Like that menu entry, it removes
  every view of the video, not just that day's.
- **Remove all videos from** *channel* (trash can with lines) asks you to confirm, then
  removes every video from that channel, including collaborations it's part of. So it doesn't
  have to load your whole history, it searches your watch history for the channel's name (as
  the **Search watch history** box does), goes through the results, loading more as it
  reaches the end, and removes each one from that channel. Videos from other channels that
  only mention the name stay. A message in the bottom-right corner shows how many it has
  removed so far and has a **Stop** button. When it's done you're left on the search
  results, which you can clear with the search box's ✕.

The script removes each video through its own ⋮ menu (kept out of sight while it does), so
YouTube handles it exactly like a removal you make yourself, in your language. Only regular
videos get the buttons; Shorts in your history aren't covered.

### unstick-start

If a video jumps far ahead before it has started playing, YouTube's player can get stuck: it
only loads the first few seconds of the video, so the video never appears, and after about 20
seconds YouTube shows "Something went wrong". SponsorBlock makes exactly that jump when a video
has a sponsor segment right at 0:00. It happens most with the first video in a fresh window
(such as a new incognito window), where SponsorBlock is ready before the video is. It doesn't
happen with every video.

When a video has been stuck like this for 4 seconds, the script reloads the page at the time
it was jumping to (adding `t=` to the address, or `start=` in embeds), which YouTube handles
fine. In testing, a video stuck like this then started about 11 to 16 seconds after the page
was opened, instead of not at all. The script does nothing once the video has played, doesn't
count time while an ad is showing or the tab is in the background, and reloads the same video
at most once a minute. On a very slow connection, a video opened at a timestamp may get one
unneeded reload.

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
([tests/fixtures/player.html](tests/fixtures/player.html)) and a fake watch history page
([tests/fixtures/history.html](tests/fixtures/history.html)) in headless Chromium. A fake
clock makes the polling, retries and the 8-second captions window run instantly, and
clicks, taps and key presses are real browser input, so the "user changed it themselves"
cases are tested for real. It covers desktop and m.youtube.com (emulated phone) and needs
no network. GitHub Actions runs it on every push to `main` and on every pull request
([.github/workflows/test.yml](.github/workflows/test.yml)); you can also start a run by hand
from the Actions tab.

`npm run test:live` runs a few checks against the real YouTube (www, m. and a
youtube-nocookie embed). They confirm the player still has the methods and controls the
scripts use, and that the scripts still work there. The fake player only reflects YouTube
as of when it was written, so run this now and then, and whenever a script seems broken.
It needs network access, can be flaky (ads, bot checks), and skips itself if YouTube shows
a cookie consent page. The autoplay checks also skip themselves when YouTube serves a
player without a working Autoplay toggle, which happens often in fresh sessions. It doesn't
cover quick-history-delete, since the watch history needs a signed-in account; check that
one by hand.

If YouTube changes its player or watch history page, update the fake to match so the
fixture tests keep describing reality.
