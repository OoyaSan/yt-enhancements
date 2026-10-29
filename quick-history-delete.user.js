// ==UserScript==
// @name         YouTube: quick history delete
// @namespace    https://github.com/OoyaSan/yt-enhancements
// @version      1.0
// @description  Adds buttons to your YouTube watch history that remove a video, or every video from its channel, in one click.
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==
(function () {
  // The watch history page (YouTube keeps pages you've left in the document, hidden), its videos, and
  // each video's ⋮ menu. The script removes videos through that menu, like a click on its "Remove from
  // watch history" entry, so YouTube updates the page as usual.
  const PAGE = 'ytd-browse[page-subtype="history"]:not([hidden])';
  const ITEM = 'yt-lockup-view-model';
  const MENU_BUTTON = '.ytLockupMetadataViewModelMenuButton button';
  const MENU = 'ytd-popup-container tp-yt-iron-dropdown';
  const MENU_ENTRY = 'yt-list-item-view-model';
  const MORE = 'ytd-continuation-item-renderer'; // loads the next part of the history once scrolled to
  const BUSY = 'qhd-busy'; // on <html> while the script uses a ⋮ menu, which keeps the menu out of sight
  const MENU_MS = 2000, REMOVE_MS = 10_000, SEARCH_MS = 15_000, LOAD_MS = 20_000, SETTLE_MS = 2000;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TRASH_ICON = 'M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z';
  const SWEEP_ICON = 'M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zm2-8h6v8H5v-8zm5-6H6L5 5H2v2h12V5h-3z';

  const root = document.documentElement;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const waitFor = async (check, ms) => {
    for (const end = Date.now() + ms; ; await sleep(50)) {
      const value = check();
      if (value || Date.now() >= end) return value;
    }
  };
  const videos = (n) => `${n} video${n === 1 ? '' : 's'}`;

  // What YouTube rendered the item from (its lockupViewModel), read fresh each time: YouTube can reuse
  // an item's element for another video.
  const dataOf = (item) => {
    try { const d = item.componentProps.data; return (typeof d === 'function' ? d() : d) || null; } catch (e) { return null; }
  };
  const metadataOf = (d) => (d && d.metadata && d.metadata.lockupMetadataViewModel) || {};

  // The text of the item's "Remove from watch history" menu entry, in the user's language, or null.
  const removeLabel = (d) => {
    try {
      const sheet = metadataOf(d).menuButton.buttonViewModel.onTap.innertubeCommand.showSheetCommand;
      for (const { listItemViewModel: entry } of sheet.panelLoadingStrategy.inlineContent.sheetViewModel.content.listViewModel.listItems) {
        const feedback = entry && entry.rendererContext.commandContext.onTap.innertubeCommand.feedbackEndpoint;
        if (feedback && (feedback.actions || []).some(a => a.hideItemSectionVideosByIdCommand || a.localWatchHistoryCommand)) {
          return entry.title.content;
        }
      }
    } catch (e) {}
    return null;
  };

  // The video's channels as a Map of channel ID to name: its channel first, then any collaborators.
  const channelsOf = (d) => {
    const m = metadataOf(d), channels = new Map();
    let byline = null;
    try { byline = m.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text.content; } catch (e) {}
    // The avatar links to the channel; a collaboration's avatars open a list of its channels.
    const walk = (o, name) => {
      if (!o || typeof o !== 'object') return;
      if (o.listItemViewModel && o.listItemViewModel.title) name = o.listItemViewModel.title.content;
      const id = o.browseEndpoint && o.browseEndpoint.browseId;
      if (id && id.startsWith('UC') && name && !channels.has(id)) channels.set(id, name);
      for (const key in o) walk(o[key], name);
    };
    walk(m.image, byline);
    return channels;
  };

  const style = document.createElement('style');
  style.textContent = `
    .qhd-actions { flex: none; display: flex; flex-direction: column; margin: 34px -10px 0 auto; }
    .qhd-actions button { display: block; width: 40px; height: 40px; padding: 8px; border: 0; border-radius: 50%;
      background: none; color: var(--yt-sys-color-baseline--text-primary, currentColor); cursor: pointer; }
    .qhd-actions button:hover, .qhd-actions button:focus-visible {
      background: var(--yt-sys-color-baseline--additive-background, rgba(128, 128, 128, 0.2)); outline: none; }
    .qhd-actions button:disabled { opacity: 0.4; cursor: default; background: none; }
    .qhd-actions button[hidden] { display: none; }
    .qhd-actions svg { display: block; width: 24px; height: 24px; fill: currentColor; pointer-events: none; }
    html.${BUSY} ${MENU} { opacity: 0 !important; }
    .qhd-status { position: fixed; z-index: 3000; right: 24px; bottom: 24px; display: flex; gap: 16px; align-items: center;
      max-width: min(480px, calc(100vw - 48px)); box-sizing: border-box; padding: 6px 8px 6px 16px; border-radius: 8px;
      background: var(--yt-sys-color-baseline--inverted-background, #0f0f0f);
      color: var(--yt-sys-color-baseline--text-primary-inverse, #fff); font: 14px/20px Roboto, Arial, sans-serif;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3); }
    .qhd-status[hidden] { display: none; }
    .qhd-status button { flex: none; padding: 8px 12px; border: 0; border-radius: 18px; background: none; color: inherit;
      font: 500 14px/20px Roboto, Arial, sans-serif; cursor: pointer; }
    .qhd-status button:hover { background: rgba(128, 128, 128, 0.25); }
    .qhd-dialog { max-width: min(400px, calc(100vw - 48px)); padding: 0; border: 0; border-radius: 12px;
      background: var(--yt-sys-color-baseline--menu-background, #fff); color: var(--yt-sys-color-baseline--text-primary, #0f0f0f);
      font: 14px/20px Roboto, Arial, sans-serif; box-shadow: 0 4px 32px rgba(0, 0, 0, 0.4); }
    .qhd-dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
    .qhd-dialog > div { padding: 24px; }
    .qhd-dialog h2 { margin: 0 0 12px; font: 400 18px/24px Roboto, Arial, sans-serif; }
    .qhd-dialog p { margin: 0; color: var(--yt-sys-color-baseline--text-secondary, #606060); }
    .qhd-dialog-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
    .qhd-dialog button { height: 36px; padding: 0 16px; border: 0; border-radius: 18px; background: none; color: inherit;
      font: 500 14px/36px Roboto, Arial, sans-serif; cursor: pointer; }
    .qhd-dialog button:not(.qhd-primary):hover {
      background: var(--yt-sys-color-baseline--additive-background, rgba(128, 128, 128, 0.2)); }
    .qhd-dialog .qhd-primary { background: var(--yt-sys-color-baseline--inverted-background, #0f0f0f);
      color: var(--yt-sys-color-baseline--text-primary-inverse, #fff); }
    .qhd-dialog .qhd-primary:hover { opacity: 0.85; }
  `;
  document.head.append(style);

  // Asks a yes/no question in a dialog on the page, resolving to whether the answer was yes. (Not
  // confirm(), which browsers can be set to block, answering no.)
  const ask = (question, detail, yes) => new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'qhd-dialog';
    const content = document.createElement('div');
    const heading = document.createElement('h2'), text = document.createElement('p');
    heading.textContent = question;
    text.textContent = detail;
    const buttons = document.createElement('div'), no = document.createElement('button'), ok = document.createElement('button');
    buttons.className = 'qhd-dialog-buttons';
    no.textContent = 'Cancel';
    ok.textContent = yes;
    ok.className = 'qhd-primary';
    no.onclick = () => dialog.close();
    ok.onclick = () => dialog.close('yes');
    buttons.append(no, ok);
    content.append(heading, text, buttons);
    dialog.append(content);
    // Escape, or a click outside the dialog, cancels.
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(dialog.returnValue === 'yes'); });
    document.body.append(dialog);
    dialog.showModal();
    no.focus();
  });

  // A message in the corner of the page, with one button (Close unless an action is given).
  let statusBox = null, statusTimer = 0;
  const hideStatus = () => { if (statusBox) statusBox.hidden = true; };
  const showStatus = (text, { action = 'Close', onAction = hideStatus, autoHide = false } = {}) => {
    if (!statusBox) {
      statusBox = document.createElement('div');
      statusBox.className = 'qhd-status';
      statusBox.setAttribute('role', 'status');
      statusBox.append(document.createElement('span'), document.createElement('button'));
      document.body.append(statusBox);
    }
    const [message, actionButton] = statusBox.children;
    message.textContent = text;
    actionButton.textContent = action;
    actionButton.onclick = onAction;
    statusBox.hidden = false;
    clearTimeout(statusTimer);
    if (autoHide) statusTimer = setTimeout(hideStatus, 10_000);
  };

  const openMenus = () => [...document.querySelectorAll(MENU)].filter(m => m.opened);
  const closeMenus = () => { for (const m of openMenus()) m.close(); };
  const menuEntry = (label) => {
    for (const menu of openMenus()) {
      for (const entry of menu.querySelectorAll(MENU_ENTRY)) if (entry.textContent.trim() === label) return entry;
    }
    return null;
  };
  // Removed: YouTube put its "All views of this video removed" notice inside the item (as it does in each
  // of the video's entries), so it no longer has its ⋮ button. Also counts the item being hidden, taken
  // away, or used for another video.
  const isGone = (item, id) => {
    if (!item.isConnected || !item.checkVisibility() || !item.querySelector(MENU_BUTTON)) return true;
    const d = dataOf(item);
    return !d || d.contentId !== id;
  };

  // Removes the item's video from watch history (all views of it) through its ⋮ menu. Resolves to
  // whether it worked. Tries twice, in case the menu still showed another video's entries.
  const removeNow = async (item) => {
    const d = dataOf(item), id = d && d.contentId, label = removeLabel(d);
    if (!id || !label || !item.querySelector(MENU_BUTTON)) return false;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt && isGone(item, id)) return true; // the first try worked after all
      closeMenus();
      root.classList.add(BUSY);
      let entry = null;
      try {
        item.querySelector(MENU_BUTTON).click();
        entry = await waitFor(() => menuEntry(label), MENU_MS);
        if (entry) {
          (entry.querySelector('button') || entry).click();
          await waitFor(() => !openMenus().length, 1000);
        }
      } finally {
        closeMenus();
        root.classList.remove(BUSY);
      }
      if (entry && await waitFor(() => isGone(item, id), REMOVE_MS)) return true;
    }
    return false;
  };
  // One removal at a time, since they share the menu.
  let queue = Promise.resolve();
  const remove = (item) => {
    const run = queue.then(() => removeNow(item));
    queue = run.catch(() => {});
    return run.catch(() => false);
  };

  const removeOne = async (item, button) => {
    button.disabled = true;
    if (await remove(item)) return;
    button.disabled = false;
    showStatus("Couldn't remove this video from your watch history. Try again, or use its ⋮ menu.", { autoHide: true });
  };

  // Shows only the history entries that mention `query`, using the page's "Search watch history".
  const search = (query) => new Promise((resolve) => {
    const page = document.querySelector(PAGE);
    if (!page) return resolve();
    const done = () => { clearTimeout(timer); document.removeEventListener('yt-navigate-finish', done); resolve(); };
    const timer = setTimeout(done, SEARCH_MS);
    document.addEventListener('yt-navigate-finish', done);
    page.dispatchEvent(new CustomEvent('yt-navigate', {
      bubbles: true,
      composed: true,
      detail: {
        endpoint: {
          commandMetadata: {
            webCommandMetadata: {
              url: `/feed/history?query=${encodeURIComponent(query)}`,
              webPageType: 'WEB_PAGE_TYPE_BROWSE',
              rootVe: 6827,
              apiUrl: '/youtubei/v1/browse',
            },
          },
          browseEndpoint: { browseId: 'FEhistory', query },
        },
      },
    }));
  });
  const searchedFor = () => new URLSearchParams(location.search).get('query');

  // Removes every video from the channel: searches the history for the channel's name, then goes
  // through the results, loading more as it reaches the end, and removes each video from that channel.
  let channelRun = null;
  const removeChannel = async (item) => {
    if (channelRun) return;
    const [channel] = channelsOf(dataOf(item));
    if (!channel) return;
    const [channelId, name] = channel;
    const sure = await ask(`Remove all videos from ${name} from your watch history?`,
      "All views of each video are removed. This can't be undone.", 'Remove all');
    if (!sure || channelRun) return;

    const run = channelRun = { stopped: false };
    let removed = 0, outcome = 'done';
    const tried = new Set();
    const progress = () => showStatus(`Removing videos from ${name}… ${removed} removed`, {
      action: 'Stop',
      onAction: () => { run.stopped = true; },
    });
    const next = () => [...document.querySelectorAll(`${PAGE} ${ITEM}`)].find((i) => {
      const d = dataOf(i);
      return d && !tried.has(d.contentId) && !isGone(i, d.contentId) && channelsOf(d).has(channelId);
    });
    const more = () => document.querySelector(`${PAGE} ${MORE}`);

    progress();
    try {
      if (searchedFor() !== name) {
        await search(name);
        if (searchedFor() !== name) outcome = 'no-search';
      }
      while (outcome === 'done') {
        if (run.stopped || !document.querySelector(PAGE)) { outcome = 'stopped'; break; }
        const target = next();
        if (target) {
          tried.add(dataOf(target).contentId);
          target.scrollIntoView({ block: 'center' });
          if (await remove(target)) { removed++; progress(); } else outcome = 'failed';
          continue;
        }
        const loader = more();
        if (loader) {
          loader.scrollIntoView({ block: 'end' });
          if (!await waitFor(() => !loader.isConnected || run.stopped, LOAD_MS)) outcome = 'no-more';
          continue;
        }
        // Nothing left to remove, unless YouTube is still putting the page together.
        if (!await waitFor(() => next() || more(), SETTLE_MS)) break;
      }
    } catch (e) {
      outcome = 'failed';
    } finally {
      channelRun = null;
    }

    const total = `Removed ${videos(removed)} from ${name} from your watch history.`;
    showStatus({
      done: removed ? total : `Found no videos from ${name} in your watch history.`,
      stopped: `Stopped. ${total}`,
      failed: `${total} Then one couldn't be removed, so it stopped; try again to remove the rest.`,
      'no-more': `${total} YouTube didn't load the rest of your history; try again to remove the rest.`,
      'no-search': `Couldn't search your watch history for ${name}.`,
    }[outcome], { autoHide: outcome === 'done' });
  };

  const icon = (path) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', path);
    svg.append(p);
    return svg;
  };
  const button = (path) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.append(icon(path));
    return b;
  };
  const setLabel = (b, text) => { b.title = text; b.setAttribute('aria-label', text); };

  // Adds the buttons below the item's ⋮ button, or updates them if the item now shows another video.
  const decorate = (item) => {
    const host = item.querySelector('yt-lockup-metadata-view-model');
    if (!host) return;
    let box = host.querySelector(':scope > .qhd-actions');
    const d = dataOf(item), id = d && d.contentId;
    if (box && box.dataset.video === id) return;
    const removeText = removeLabel(d);
    if (!removeText || !item.querySelector(MENU_BUTTON)) { if (box) box.remove(); return; }

    if (!box) {
      box = document.createElement('div');
      box.className = 'qhd-actions';
      const trash = button(TRASH_ICON), sweep = button(SWEEP_ICON);
      box.append(trash, sweep);
      // Keep clicks from reaching the item, which would open the video.
      box.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = box.closest(ITEM);
        if (e.target === trash) removeOne(item, trash);
        else if (e.target === sweep) removeChannel(item);
      });
      host.append(box);
    }
    box.dataset.video = id;
    const [trash, sweep] = box.children;
    trash.disabled = false;
    setLabel(trash, removeText);
    const [channel] = channelsOf(d);
    sweep.hidden = !channel;
    if (channel) setLabel(sweep, `Remove all videos from ${channel[1]} from watch history`);
  };

  setInterval(() => {
    const page = document.querySelector(PAGE);
    if (page) for (const item of page.querySelectorAll(ITEM)) decorate(item);
  }, 500);
})();
