// ==UserScript==
// @name         YouTube: unstick start
// @namespace    https://github.com/OoyaSan/yt-enhancements
// @version      1.0
// @description  Reloads a YouTube video that gets stuck loading when something (like SponsorBlock) skips ahead before it starts playing.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  // If a video jumps far ahead before it has started playing (as SponsorBlock does to skip a
  // segment at 0:00), YouTube's player can get stuck: it has only buffered the first few seconds
  // and never fetches the rest, then shows "Something went wrong". Opening the video at that time
  // from its URL works, so when that happens, reload the page there.
  const UNSTARTED = -1, PLAYING = 1, BUFFERING = 3;
  const HAVE_CURRENT_DATA = 2; // <video> readyState: a frame to show
  const STUCK_MS = 4000; // a normal seek at the start finishes well within this
  const KEY = 'yt-enhancements:unstick-start'; // sessionStorage: the last restart, so it can't loop
  const AGAIN_MS = 60_000; // restart the same video at most once in this long

  let currentId = null, started = false, stuckSince = 0;
  const getPlayer = () =>
    document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  const videoId = (p) => {
    try { return p.getVideoData().video_id; } catch (e) { return null; }
  };

  // This page's URL, starting the video at `seconds`; null unless the page is that video's own.
  const urlAt = (id, seconds) => {
    const url = new URL(location.href);
    const s = String(Math.ceil(seconds));
    if (url.searchParams.get('v') === id) url.searchParams.set('t', s + 's'); // www and m. watch pages
    else if (url.pathname === '/embed/' + id) url.searchParams.set('start', s);
    else return null;
    return url.href;
  };

  const restartedRecently = (id) => {
    try {
      const last = JSON.parse(sessionStorage.getItem(KEY));
      return !!last && last.id === id && Date.now() - last.at < AGAIN_MS;
    } catch (e) { return true; } // can't tell, so don't risk a loop
  };

  const restart = (id, seconds) => {
    const url = urlAt(id, seconds);
    if (!url || restartedRecently(id)) return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() })); } catch (e) { return; }
    location.replace(url);
  };

  setInterval(() => {
    const player = getPlayer();
    const video = player && player.querySelector('video');
    if (!video || typeof player.getPlayerState !== 'function') return;
    const id = videoId(player);
    if (!id) return;
    if (id !== currentId) { currentId = id; started = false; stuckSince = 0; }

    const state = player.getPlayerState();
    if (state === PLAYING) started = true;
    // Where the player is meant to be. The <video> element can say 0 here, if YouTube reloaded it
    // (e.g. for a quality change) while stuck.
    const time = player.getCurrentTime ? player.getCurrentTime() : video.currentTime;
    const stuck = !started && (state === UNSTARTED || state === BUFFERING) && time >= 1 &&
      video.readyState < HAVE_CURRENT_DATA && !document.hidden && !player.classList.contains('ad-showing');
    if (!stuck) { stuckSince = 0; return; }
    if (!stuckSince) stuckSince = Date.now();
    if (Date.now() - stuckSince >= STUCK_MS) restart(id, time);
  }, 500);
})();
