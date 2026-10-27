/**
 * compare-protocol.js
 *
 * Single source of truth for all postMessage type strings that cross the
 * compare-page ↔ inject content-script boundary.
 *
 * Usage:
 *   import { MSG } from "../../shared/compare-protocol.js";   // from inject/
 *   import { MSG } from "../shared/compare-protocol.js";       // from iframe/iframe/
 *
 * Both sides import the same constants, so a typo or rename is caught at
 * build time rather than silently dropping messages at runtime.
 */

export const MSG = {
  /** compare → inject: run a search query in the AI site iframe */
  SEARCH: "DYSEARCH_SEARCH",

  /** inject → compare: result of a SEARCH request */
  RESULT: "DYSEARCH_RESULT",

  /** inject → compare: current URL after navigation (heartbeat) */
  URL_UPDATE: "DYSEARCH_URL_UPDATE",

  /** compare → inject: deliver file blobs to the AI site input */
  PASTE_FILES: "DYSEARCH_PASTE_FILES",

  /** inject → compare: result of a PASTE_FILES request */
  PASTE_RESULT: "DYSEARCH_PASTE_RESULT",

  /** compare → inject: in-frame navigate to a history restore URL (SPA 已冷启动后) */
  NAVIGATE: "DYSEARCH_NAVIGATE",

  /** inject → compare: history restore in-frame navigation ack */
  NAVIGATE_RESULT: "DYSEARCH_NAVIGATE_RESULT",

  /** compare → inject: request page content extraction for export / AI summary */
  EXTRACT: "DYSEARCH_EXTRACT",

  /** inject → compare: extracted content in response to EXTRACT */
  EXTRACT_RESULT: "DYSEARCH_EXTRACT_RESULT",

  /** compare → inject: is the current answer finished generating? */
  READY_CHECK: "DYSEARCH_READY_CHECK",

  /** inject → compare: result of a READY_CHECK request */
  READY_RESULT: "DYSEARCH_READY_RESULT",
};
