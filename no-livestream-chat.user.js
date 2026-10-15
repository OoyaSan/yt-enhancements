// ==UserScript==
// @name         YouTube: no livestream chat
// @namespace    https://github.com/OoyaSan/yt-enhancements
// @version      1.0
// @description  Closes the chat on livestreams (and chat replay on past streams), including in incognito.
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==
(function () {
  // The chat's Close button is inside the chat's own iframe (same origin), once that has loaded. It
  // only ever closes the chat, so clicking it again is safe if YouTube ignored a click.
  const CLOSE_BUTTON = 'yt-live-chat-header-renderer #close-button button';
  const RETRY_MS = 1000;

  let openId = null, doneId = null, lastClick = 0;
  const videoId = () => {
    try { return document.querySelector('#movie_player').getVideoData().video_id; } catch (e) { return location.href; }
  };

  setInterval(() => {
    const id = videoId();
    if (doneId === id) return;
    const chat = document.querySelector('ytd-live-chat-frame');
    if (!chat) return;

    if (chat.hasAttribute('collapsed')) {
      // Closed after being open on this video: done, so reopening it yourself sticks until the next
      // video. (A chat that's still closed from the previous video doesn't count.)
      if (openId === id) doneId = id;
      return;
    }
    openId = id;

    if (Date.now() - lastClick < RETRY_MS) return;
    let close = null;
    try { close = chat.querySelector('iframe').contentDocument.querySelector(CLOSE_BUTTON); } catch (e) {}
    if (!close) return;
    lastClick = Date.now();
    close.click();
  }, 300);
})();
