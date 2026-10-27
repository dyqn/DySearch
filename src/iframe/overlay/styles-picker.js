import { promptPickerStyles } from "../../shared/prompt-picker-styles.js";

const OVERLAY_PANEL_STYLES = `
  .panel-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    animation: dysearchPopIn 180ms cubic-bezier(.2,.9,.3,1.1) forwards;
    transform: translateY(var(--dysearch-panel-offset-y));
  }
  .hint-row {
    display: flex;
    justify-content: center;
    color: rgba(255, 255, 255, 0.78);
    font-size: 14px;
    user-select: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .kbd {
    display: inline-block;
    padding: 1px 7px;
    margin: 0 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.18);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
  }
  .panel { position: relative; }
  .settings-corner-btn {
    position: absolute;
    top: 24px;
    right: 19px;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #bbb;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: color 150ms ease, background 150ms ease, transform 150ms ease;
  }
  .settings-corner-btn:hover {
    color: #555;
    background: rgba(0, 0, 0, 0.06);
    transform: rotate(30deg);
  }
  .settings-corner-btn svg {
    width: 15px;
    height: 15px;
    display: block;
    flex-shrink: 0;
  }
`;

export const OVERLAY_PICKER_STYLES = promptPickerStyles(1.167) + OVERLAY_PANEL_STYLES;
