// The extension compare page origin — used to validate incoming postMessages
// and to target outgoing postMessages. inject.js is injected into every
// matching frame, so without this origin check any third-party page could
// forge DYSEARCH_SEARCH / DYSEARCH_EXTRACT messages and weaponize a logged-in AI
// tab on the user's behalf.
export const EXTENSION_ORIGIN =
  typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id
    ? `chrome-extension://${chrome.runtime.id}`
    : null;

// inject.js runs with all_frames:true, so a site's own nested iframe executes
// it too, and there window.parent is the site page rather than our compare
// page. Posting to that parent with EXTENSION_ORIGIN as the target makes the
// browser drop the message and log "target origin does not match".
// window.location.ancestorOrigins exposes the parent origin even across
// frames; where it is unavailable (Firefox) fall back to the old behaviour.
export function isParentExtensionPage() {
  if (window.parent === window) return false;
  if (!EXTENSION_ORIGIN) return true;
  const ancestors = window.location.ancestorOrigins;
  if (!ancestors || ancestors.length === 0) return true;
  return ancestors[0] === EXTENSION_ORIGIN;
}

// These actions actually "submit". Once one of them has fired successfully we
// must not let later fallback steps (extra click / synthesized Enter) re-fire,
// otherwise sites like ChatGPT/ProseMirror submit the same query twice.
export const SUBMIT_ACTIONS = new Set(["click", "sendKeys", "smartSubmit"]);

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
