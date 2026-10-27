/** Shared prompt-picker CSS used by overlay, inject launcher, popup, and compare page.
 *  The overlay bakes its metrics at 1.167x (see src/iframe/overlay/styles.js); every other
 *  host renders this sheet at 1x, so the multiplier is a parameter, never a transform. */
export function promptPickerStyles(scale = 1) {
  const px = (n) => Math.round(n * scale);
  return `
  .prompt-picker {
    position: absolute;
    top: calc(100% + ${px(8)}px);
    left: -${px(1)}px;
    right: -${px(1)}px;
    min-height: ${px(228)}px;
    max-height: ${px(320)}px;
    display: grid;
    grid-template-columns: ${px(112)}px minmax(0, 1fr);
    grid-template-rows: 1fr auto;
    border: ${px(1)}px solid rgba(0, 0, 0, 0.1);
    border-radius: ${px(6)}px;
    background: #fff;
    box-shadow: 0 ${px(18)}px ${px(34)}px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    z-index: 6;
  }
  .prompt-picker[hidden] { display: none; }
  .prompt-groups-col {
    padding: ${px(10)}px;
    border-right: ${px(1)}px solid rgba(0, 0, 0, 0.08);
    background: #fbfbfb;
    display: flex;
    flex-direction: column;
    gap: ${px(6)}px;
    overflow-y: auto;
    min-height: 0;
  }
  .prompt-group-item {
    width: 100%;
    min-height: ${px(32)}px;
    padding: ${px(6)}px ${px(10)}px;
    border: none;
    border-radius: ${px(4)}px;
    background: transparent;
    color: #111;
    text-align: left;
    font-size: ${px(12)}px;
    line-height: 1.4;
    cursor: pointer;
    flex-shrink: 0;
  }
  .prompt-group-item.is-active,
  .prompt-group-item:hover {
    background: #111;
    color: #fff;
  }
  .prompt-list-col {
    padding: ${px(6)}px 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .prompt-item {
    min-height: ${px(36)}px;
    padding: ${px(4)}px ${px(12)}px;
    font-size: ${px(13)}px;
    font-weight: 500;
    line-height: 1.4;
    color: #111;
    cursor: pointer;
    border-bottom: ${px(1)}px solid rgba(0, 0, 0, 0.07);
    display: flex;
    align-items: center;
    gap: ${px(6)}px;
  }
  .prompt-item:last-child { border-bottom: none; }
  .prompt-item:hover { background: #f6f6f6; }
  .prompt-item-label {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: ${px(4)}px 0;
  }
  .prompt-item-icons {
    display: flex;
    align-items: center;
    gap: ${px(2)}px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  .prompt-item:hover .prompt-item-icons { opacity: 1; }
  .prompt-icon-btn {
    width: ${px(22)}px;
    height: ${px(22)}px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: #999;
    border-radius: ${px(4)}px;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: color 120ms ease, background 120ms ease;
  }
  .prompt-icon-btn:hover { background: #e8e8e8; color: #333; }
  .prompt-empty {
    padding: ${px(14)}px ${px(12)}px;
    font-size: ${px(12)}px;
    color: #888;
  }
  .prompt-picker-footer {
    grid-column: 1 / -1;
    display: flex;
    justify-content: center;
    padding: ${px(6)}px 0;
    border-top: ${px(1)}px solid rgba(0, 0, 0, 0.07);
    background: #fbfbfb;
  }
  .prompt-picker-footer-btn {
    display: inline-flex;
    align-items: center;
    gap: ${px(5)}px;
    border: none;
    background: transparent;
    font-size: ${px(11)}px;
    color: #aaa;
    cursor: pointer;
    padding: ${px(3)}px ${px(8)}px;
    border-radius: ${px(4)}px;
    transition: color 140ms ease, background 140ms ease;
  }
  .prompt-picker-footer-btn:hover { color: #555; background: #f0f0f0; }
  ${window.PromptItemUI?.PREVIEW_CSS ?? ""}
`;
}
