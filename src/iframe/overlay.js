import "../shared/i18n.js";
import "../shared/prompt-item.js";
import { initDysearchOverlay } from "./overlay/main.js";

if (window === window.top) {
  initDysearchOverlay();
}
