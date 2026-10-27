/**
 * extractor.js — public entry point for content extraction.
 *
 * Sub-modules:
 *   extractor-dom-to-markdown.js   — DOM → Markdown converter
 *   extractor-site-selectors.js    — page-text extraction (site + generic)
 *   extractor-conversation.js      — conversation turns (API / window-state / DOM)
 */

import { EXTENSION_ORIGIN, isParentExtensionPage } from "./constants.js";
import { MSG } from "../../shared/compare-protocol.js";
import { extractReadablePageText } from "./extractor-site-selectors.js";
import { extractTurnsWithFallback } from "./extractor-conversation.js";
import { stripChromeLines, stripChromeFromTurns } from "./extractor-chrome.js";
import { checkGenerationReady } from "./extractor-readiness.js";

// 导出/摘要前父页会先问一次"回答写完了吗"，避免把搜索途中的半截状态当答案导出。
export async function handleReadyCheckRequest(message) {
  if (!isParentExtensionPage()) return;
  let result = { ready: true, reason: "error" };
  try {
    result = await checkGenerationReady();
  } catch (_err) {
    result = { ready: true, reason: "error" };
  }
  window.parent.postMessage(
    {
      type: MSG.READY_RESULT,
      requestId: message.requestId,
      siteId: message.site?.id,
      ready: result.ready,
      reason: result.reason,
      url: window.location.href,
    },
    EXTENSION_ORIGIN || "*"
  );
}

// Review note (CWS/Edge Add-ons): extraction is only used for user-visible
// export/summary features triggered from the extension page. Extracted text
// is postMessage'd back to the extension compare page only; no upload.
export async function handleExtractRequest(message) {
  if (!isParentExtensionPage()) return;
  const host = window.location.hostname.replace(/^www\./, "");
  const targetOrigin = EXTENSION_ORIGIN || "*";
  try {
    const [rawContent, rawTurns] = await Promise.all([
      Promise.resolve(extractReadablePageText()),
      extractTurnsWithFallback(host),
    ]);
    const content = stripChromeLines(rawContent);

    // 状态条（"搜索到 15 个网页"）单独成行时会被上面过滤掉，user 轮次就空了；
    // 这时用父页传来的真实提问补位，比把状态条当用户问题导出更贴近事实。
    const query = String(message.query || "").trim();
    let turns = stripChromeFromTurns(rawTurns) || [];
    const hasAssistantText = turns.some(
      (t) => t.role !== "user" && String(t.text || "").trim()
    );
    // 只有真的拿到 AI 正文时才保留 turns。否则宁可回空数组：
    // 下游（导出/总结）见 turns 非空就只用它，会把已经抓到的平铺 content 整段丢掉。
    if (hasAssistantText) {
      const firstUser = turns.find((t) => t.role === "user");
      if (query && !firstUser) {
        turns = [{ role: "user", text: query }, ...turns];
      } else if (query && firstUser && firstUser.text.length < 40 && !firstUser.text.includes(query.slice(0, 12))) {
        firstUser.text = query;
      }
    } else {
      turns = [];
    }

    window.parent.postMessage(
      {
        type: MSG.EXTRACT_RESULT,
        requestId: message.requestId,
        siteId: message.site?.id,
        content,
        turns,
        url: window.location.href,
      },
      targetOrigin
    );
  } catch (_err) {
    // Any async error takes the sync fallback so postMessage is guaranteed.
    // If the fallback extraction throws too we still have to reply, otherwise
    // the card keeps showing its "加载中" status forever.
    let content = "";
    let turns = null;
    try {
      content = stripChromeLines(extractReadablePageText());
    } catch (_fallbackErr) {
      content = "";
    }
    window.parent.postMessage(
      {
        type: MSG.EXTRACT_RESULT,
        requestId: message.requestId,
        siteId: message.site?.id,
        content,
        turns,
        url: window.location.href,
      },
      targetOrigin
    );
  }
}
