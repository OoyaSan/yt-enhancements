// ==UserScript==
// @name         YouTube: captions off
// @namespace    https://github.com/OoyaSan/yt-enhancements
// @version      1.1
// @description  Starts YouTube videos (including embeds and incognito) with captions off.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  // Captions controls: desktop/embed player (.ytp-*) and m.youtube.com.
  const CC_BUTTONS = '.ytp-subtitles-button, .ytmClosedCaptioningButtonButton';
  const USER_CONTROLS = CC_BUTTONS +
    ', .ytp-settings-button, .ytp-settings-menu, .player-settings-icon, player-settings-menu';

  let currentId = null, start = 0, doneId = null; // doneId: video we're finished with
  const getPlayer = () =>
    document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  const videoId = (p) => {
    try { return p.getVideoData().video_id; } catch (e) { return location.href; }
  };

  // Once the user touches the captions controls (CC button, player settings or the "c" key),
  // leave captions alone for the rest of the video.
  const onUserInput = (e) => {
    if (!e.isTrusted) return;
    if (e.type === 'keydown') {
      const t = e.target;
      if (e.key.toLowerCase() !== 'c' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    } else if (!e.composedPath().some(n => n instanceof Element && n.matches(USER_CONTROLS))) {
      return;
    }
    const player = getPlayer();
    if (player) doneId = videoId(player);
  };
  for (const type of ['click', 'touchend', 'keydown']) {
    document.addEventListener(type, onUserInput, true);
  }

  // Returns true if captions were on and have been turned off.
  const turnOffCaptions = (player) => {
    if (typeof player.isSubtitlesOn === 'function') {
      if (!player.isSubtitlesOn()) return false;
      player.setOption('captions', 'track', {});
      return true;
    }
    const btn = document.querySelector(CC_BUTTONS); // fallback if the player API isn't exposed
    if (!btn || btn.getAttribute('aria-pressed') !== 'true') return false;
    btn.click();
    return true;
  };

  setInterval(() => {
    const player = getPlayer();
    if (!player) return;
    const id = videoId(player);
    if (id !== currentId) { currentId = id; start = 0; }
    if (doneId === id) return;

    // Start the clock once the video itself is showing, not during ads or in a background tab.
    if (document.hidden || player.classList.contains('ad-showing')) { start = 0; return; }
    if (!start) start = Date.now();
    if (Date.now() - start > 8000) return; // only act during the first 8s of each video

    try { if (turnOffCaptions(player)) doneId = id; } catch (e) {}
  }, 300);
})();
