// ==UserScript==
// @name         YouTube: best quality
// @namespace    https://github.com/OoyaSan/yt-enhancements
// @version      1.1
// @description  Sets YouTube videos (including embeds and incognito) to the highest available quality.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  // Player settings controls: desktop/embed player (.ytp-*) and m.youtube.com. Once the user opens
  // them during a video, quality is theirs to change, so the script leaves that video alone.
  const USER_CONTROLS = '.ytp-settings-button, .ytp-settings-menu, .player-settings-icon, player-settings-menu';
  const PLAYING = 1;
  const MAX_SETS = 3; // per video, in case YouTube keeps undoing it

  let currentId = null, sets = 0, checkedRun = null, leftToUser = null;
  const getPlayer = () =>
    document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  const videoId = (p) => {
    try { return p.getVideoData().video_id; } catch (e) { return location.href; }
  };

  const onUserInput = (e) => {
    if (!e.isTrusted || !e.composedPath().some(n => n instanceof Element && n.matches(USER_CONTROLS))) return;
    const player = getPlayer();
    if (player) leftToUser = videoId(player);
  };
  for (const type of ['click', 'touchend']) {
    document.addEventListener(type, onUserInput, true);
  }

  const setQuality = (player, q) => {
    if (player.setPlaybackQualityRange) player.setPlaybackQualityRange(q, q);
    if (player.setPlaybackQuality) player.setPlaybackQuality(q);
    sets++;
  };

  setInterval(() => {
    const player = getPlayer();
    if (!player) return;
    const id = videoId(player);
    if (id !== currentId) { currentId = id; sets = 0; checkedRun = null; }

    if (leftToUser === id || sets >= MAX_SETS || player.classList.contains('ad-showing')) return;
    try {
      const levels = player.getAvailableQualityLevels(); // highest first
      const best = levels && levels.find(q => q !== 'auto');
      if (!best) return;
      // Wait until the video is playing: switching quality before its first frame can hold up the
      // start by seconds.
      const playing = !player.getPlayerState || player.getPlayerState() === PLAYING;
      if (!sets) { if (playing) setQuality(player, best); return; }

      // Check again each time YouTube starts the video over (a new playback ID, cpn): reloading a
      // video, e.g. after a stalled start, drops the quality setting.
      if (!player.getPreferredQuality || !player.getPlayerState || !playing) return;
      const run = player.getVideoData().cpn;
      if (run === checkedRun) return;
      checkedRun = run;
      if (player.getPreferredQuality() !== best) setQuality(player, best);
    } catch (e) {}
  }, 300);
})();
