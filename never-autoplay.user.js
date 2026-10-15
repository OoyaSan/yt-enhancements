// ==UserScript==
// @name         YouTube: never autoplay
// @namespace    https://github.com/OoyaSan/yt-enhancements
// @version      1.0
// @description  Keeps YouTube's Autoplay (playing the next video when one ends) turned off, including in incognito.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  // The player's Autoplay toggle, and how to tell whether it's on. Clicking it is the only thing that
  // changes the setting; YouTube then saves it the same way as when the user clicks it.
  const TOGGLES = [
    // www.youtube.com. The current player layout may hide it, but clicking it still works.
    {
      selector: 'button.ytp-autonav-toggle',
      isOn: (b) => { const s = b.querySelector('.ytp-autonav-toggle-button'); return !!s && s.getAttribute('aria-checked') === 'true'; },
    },
    // m.youtube.com. Only added to the page once the player controls have been shown.
    { selector: 'button.ytwAutonavToggleButtonHost', isOn: (b) => b.getAttribute('aria-pressed') === 'true' },
  ];
  const ANY_TOGGLE = TOGGLES.map(t => t.selector).join(', ');
  // YouTube ignores clicks until the toggle is wired up, so retry, but leave enough time that a click
  // it's still applying doesn't get undone by the next one.
  const RETRY_MS = 2000;

  let lastClick = 0, userChose = false;

  // If the user flips the toggle themselves, respect it for as long as this tab stays open.
  const onUserInput = (e) => {
    if (e.isTrusted && e.composedPath().some(n => n instanceof Element && n.matches(ANY_TOGGLE))) userChose = true;
  };
  for (const type of ['click', 'touchend']) {
    document.addEventListener(type, onUserInput, true);
  }

  setInterval(() => {
    if (userChose || Date.now() - lastClick < RETRY_MS) return;
    for (const { selector, isOn } of TOGGLES) {
      const toggle = document.querySelector(selector);
      if (toggle && isOn(toggle)) {
        lastClick = Date.now();
        toggle.click();
        return;
      }
    }
  }, 300);
})();
