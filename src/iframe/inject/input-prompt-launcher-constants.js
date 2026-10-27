export const HOST_ID = "dysearch-input-prompt-launcher";
export const ICON_SIZE = 30;
export const GAP_ABOVE = 6;
export const PANEL_HEIGHT_PX = 214;
/** Clearance between the panel edge and the FAB. */
export const PANEL_GAP_PX = 12;

export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="55 55 180 180" fill="currentColor" width="16" height="16" aria-hidden="true">
  <path d="M145 55C194.706 55 235 95.2944 235 145C235 162.846 229.805 179.478 220.846 193.468C217.565 191.886 213.886 191 210 191C196.193 191 185 202.193 185 216C185 219.107 185.568 222.081 186.604 224.825C174.16 231.324 160.01 235 145 235H75C63.9543 235 55 226.046 55 215V75C55 63.9543 63.9543 55 75 55H145ZM145 88C113.52 88 88 113.52 88 145C88 176.48 113.52 202 145 202C176.48 202 202 176.48 202 145C202 113.52 176.48 88 145 88Z"/>
  <circle cx="210" cy="216" r="16"/>
</svg>`;

export const DEFAULT_INPUT_FALLBACK = [
  "#prompt-textarea",
  "textarea",
  "motion-prompt textarea",
  "div.ProseMirror[contenteditable='true']",
  "div[contenteditable='true']",
  "[contenteditable='true']",
];

export const DEFAULT_ANCHOR_SELECTORS = [
  "form[data-type='unified-composer']",
  "footer form",
  "footer",
  "form",
  "[class*='composer']",
  "[class*='input-area']",
  "[class*='chat-input']",
];

export const SITE_INPUT_EXTRAS = {
  deepseek: ["[placeholder*='\u53d1\u9001']", "[placeholder*='\u95ee\u70b9']"],
  doubao: ["[data-testid*='chat-input']"],
  kimi: [
    "div.chat-input-editor[contenteditable='true']",
    "[data-lexical-editor='true'][contenteditable='true']",
    "[class*='chat-input'] [contenteditable='true']",
  ],
  qianwen: [
    ".t-chat__sender div[contenteditable='true']",
    ".t-chat-sender div[contenteditable='true']",
    "[class*='sender'] div[contenteditable='true']",
    "[data-slate-editor='true']",
    "[class*='chat-input'] div[contenteditable='true']",
  ],
  qwen: [
    "textarea",
    "div[contenteditable='true']",
    "[role='textbox']",
    "[class*='chat-input'] div[contenteditable='true']",
  ],
  grok: [
    "textarea[placeholder*='\u77e5\u9053']",
    "textarea[placeholder*='know']",
    "textarea[placeholder*='Ask']",
    "textarea",
    "[contenteditable='plaintext-only']",
    "[contenteditable='true'][role='textbox']",
    "[contenteditable='true']",
    "[class*='composer'] textarea",
    "[class*='composer'] [contenteditable]",
  ],
  copilot: [
    ".fai-EditorInput__input",
    "[class*='EditorInput'] [contenteditable='true']",
    "[class*='EditorInput'] textarea",
    "[class*='EditorInput'] [role='textbox']",
    "textarea[placeholder*='Copilot']",
    "textarea[placeholder*='\u53d1\u9001']",
    "[placeholder*='Copilot'][contenteditable]",
    "[role='textbox'][contenteditable='true']",
  ],
};

export const SITE_ANCHOR_EXTRAS = {
  chatgpt: ["form[data-type='unified-composer']", "form.stretch"],
  kimi: ["[class*='chat-input']", "[class*='composer']", "footer"],
  qianwen: [
    "[class*='chat-sender']",
    "[class*='sender']",
    "[class*='chat-input']",
    "footer",
  ],
  qwen: [
    "[class*='chat-input']",
    "[class*='composer']",
    "footer",
  ],
  grok: [
    "[class*='composer']",
    "form",
    "footer",
    "[class*='input']",
  ],
  copilot: [
    "[class*='EditorInput']",
    "[class*='composer']",
    "[class*='input']",
    "footer",
    "form",
  ],
};
