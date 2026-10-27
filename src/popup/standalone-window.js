// Ctrl+Q on a restricted page cannot use the toolbar popup, so the background opens
// popup.html in its own window (see openExtensionComposerUi in background/main.js).
// A window, unlike the action popup, never sizes itself to the document — without this
// the card floats in the leftover area of a fixed 440x680 frame.
const isStandaloneWindow = new URLSearchParams(window.location.search).get("mode") === "window";

export function fitStandaloneWindow() {
  if (!isStandaloneWindow) return;
  document.documentElement.classList.add("is-standalone-window");

  const shell = document.querySelector(".popup-shell");
  if (!shell) return;

  let windowId = null;
  chrome.windows.getCurrent().then((win) => {
    windowId = win.id;
    fit();
  });

  async function fit() {
    if (windowId === null) return;
    const win = await chrome.windows.get(windowId).catch(() => null);
    if (!win) return;
    const doc = document.documentElement;
    // Measured, never assumed: a popup window may or may not carry an OS frame.
    const frameW = Math.max(0, win.width - doc.clientWidth);
    const frameH = Math.max(0, win.height - doc.clientHeight);
    const width = Math.round(shell.offsetWidth + frameW);
    const height = Math.round(shell.offsetHeight + frameH);
    if (Math.abs(win.width - width) <= 1 && Math.abs(win.height - height) <= 1) return;
    // The background placed this window in the middle of the page; resizing to the card
    // must grow it around that same centre point or it drifts off to one side.
    const patch = { width, height };
    if (typeof win.left === "number" && typeof win.top === "number") {
      patch.left = Math.max(0, Math.round(win.left + (win.width - width) / 2));
      patch.top = Math.max(0, Math.round(win.top + (win.height - height) / 2));
    }
    chrome.windows.update(windowId, patch).catch(() => {});
  }

  let queued = 0;
  const requestFit = () => {
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      fit();
    });
  };

  new ResizeObserver(requestFit).observe(shell);
  window.addEventListener("resize", requestFit);
}
