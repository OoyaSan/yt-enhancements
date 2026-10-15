// ==UserScript==
// @name         YouTube: best quality
// @namespace    https://github.com/OoyaSan/yt-enhancements
// @version      1.0
// @description  Sets YouTube videos (including embeds and incognito) to the highest available quality.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  let currentId = null, qualitySet = false;
  const getPlayer = () =>
    document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
  const videoId = (p) => {
    try { return p.getVideoData().video_id; } catch (e) { return location.href; }
  };

  setInterval(() => {
    const player = getPlayer();
    if (!player) return;
    const id = videoId(player);
    if (id !== currentId) { currentId = id; qualitySet = false; }

    if (qualitySet || player.classList.contains('ad-showing')) return;
    try {
      const levels = player.getAvailableQualityLevels(); // highest first
      const best = levels && levels.find(q => q !== 'auto');
      if (best) {
        if (player.setPlaybackQualityRange) player.setPlaybackQualityRange(best, best);
        if (player.setPlaybackQuality) player.setPlaybackQuality(best);
        qualitySet = true;
      }
    } catch (e) {}
  }, 300);
})();
