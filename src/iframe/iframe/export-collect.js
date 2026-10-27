import { state } from "./state.js";
import { createRequestId } from "./utils.js";
import { MSG } from "../../shared/compare-protocol.js";

// 页面级兜底（整页扫正文密度）在站点改版、类名全换时才走，最慢可到几百毫秒；
// 2500ms 在低配机器上会把"其实已经提取到"的请求判成超时，这里放宽到 4000ms。
// 只在提取失败时才会等满，成功时收到消息立即返回。
const EXTRACT_TIMEOUT_MS = 4000;

// 「探测停止按钮」就绪等待：站点还在生成时先等它写完，别把搜索途中的半截状态当答案导出。
// 间隔 1500ms 轮询；单次回执 2500ms 没等到就当作"已就绪"（内容脚本没注入的页面不能卡住导出）；
// 总时长封顶 120s，超了就导出现有内容——一直干等更糟。
const READY_POLL_MS = 1500;
const READY_REPLY_TIMEOUT_MS = 2500;
const READY_MAX_WAIT_MS = 120000;

/** 向单张卡片的 iframe 问一次"回答写完了吗" */
export function requestIframeReady(iframe, site) {
  return new Promise((resolve) => {
    if (!iframe || !iframe.contentWindow) {
      resolve({ ready: true, reason: "no-iframe" });
      return;
    }
    const requestId = createRequestId();
    const expectedWindow = iframe.contentWindow;
    let done = false;
    let timer = null;
    const finish = (result) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", handler);
      if (timer) window.clearTimeout(timer);
      resolve(result);
    };
    const handler = (event) => {
      if (event.source !== expectedWindow) return;
      if (!event.data || event.data.type !== MSG.READY_RESULT || event.data.requestId !== requestId) return;
      finish({ ready: !!event.data.ready, reason: event.data.reason || "unknown" });
    };
    window.addEventListener("message", handler);
    try {
      iframe.contentWindow.postMessage({ type: MSG.READY_CHECK, requestId, site }, "*");
    } catch (_error) {
      finish({ ready: true, reason: "post-failed" });
      return;
    }
    timer = window.setTimeout(() => finish({ ready: true, reason: "no-reply" }), READY_REPLY_TIMEOUT_MS);
  });
}

/**
 * 等所有卡片写完（并行轮询，谁先写完谁退出）。
 * @param {(waitingCount: number) => void} [onStatus]
 * @param {() => boolean} [isAborted] 用户关掉导出弹窗后立刻停止轮询，别再骚扰页面
 */
export async function waitForCardsReady(refs, onStatus, isAborted) {
  const list = Array.from(refs || []).filter((ref) => ref && ref.iframeEl);
  if (list.length === 0) return;
  const deadline = Date.now() + READY_MAX_WAIT_MS;
  const pending = new Set(list);
  const aborted = () => {
    try {
      return typeof isAborted === "function" && !!isAborted();
    } catch (_error) {
      return false;
    }
  };

  const tick = async () => {
    const results = await Promise.all(Array.from(pending).map((ref) => requestIframeReady(ref.iframeEl, ref.site)));
    let changed = false;
    Array.from(pending).forEach((ref, index) => {
      if (results[index].ready) {
        pending.delete(ref);
        changed = true;
      }
    });
    if (onStatus && changed) onStatus(pending.size);
  };

  await tick();
  while (pending.size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
    if (pending.size === 0 || Date.now() >= deadline || aborted()) break;
    await tick();
  }
}

export async function quickCaptureAllResponses() {
  const CAPTURE_TIMEOUT = 4500;
  const promises = [];
  for (const [, ref] of state.cardRefs.entries()) {
    const p = Promise.race([
      collectResponseForSite(ref),
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              siteName: ref.site.name,
              content: "暂未提取到内容",
              turns: null,
              url: ref.currentUrl || ref.site.url
            }),
          CAPTURE_TIMEOUT
        )
      )
    ]);
    promises.push(p);
  }
  return Promise.all(promises);
}

export async function collectVisibleResponses(selectedSiteIds = null, options = {}) {
  const refs = Array.from(state.cardRefs.entries())
    .filter(([siteId]) => !selectedSiteIds || selectedSiteIds.has(siteId))
    .map(([, ref]) => ref);

  if (!options.skipReadyCheck) {
    await waitForCardsReady(refs, options.onStatus, options.isAborted);
  }

  return Promise.all(refs.map((ref) => collectResponseForSite(ref)));
}

export async function collectResponseForSite(ref) {
  if (!ref.iframeEl) {
    return {
      siteName: ref.site.name,
      content: "暂未提取到内容",
      turns: null,
      url: ref.currentUrl || ref.site.url
    };
  }

  const response = await requestIframeContent(ref.iframeEl, ref.site);
  if (response.content && response.content !== "暂未提取到内容") {
    return response;
  }

  // 平铺文本可能故意留空（页面只剩壳子时宁可不导），但结构化 turns 拿到了真实问答，
  // 这时不能把卡片状态行（"正在加载…"）当内容塞进去——导出里会出现"加载中"当答案。
  if (Array.isArray(response.turns) && response.turns.length > 0) {
    return { ...response, content: "" };
  }

  return {
    ...response,
    content: extractFallbackContent(ref)
  };
}

export function extractFallbackContent(ref) {
  if (!ref || !ref.bodyEl) {
    return "暂未提取到内容";
  }

  const fallbackPanel = ref.bodyEl.querySelector(".fallback-panel");
  if (fallbackPanel) {
    return String(fallbackPanel.textContent || "暂未提取到内容").trim() || "暂未提取到内容";
  }

  return ref.statusEl?.textContent?.trim() || "暂未提取到内容";
}

export function requestIframeContent(iframe, site) {
  return new Promise((resolve) => {
    const requestId = createRequestId();
    let completed = false;
    let timeoutId = null;
    // Review note (CWS/Edge Add-ons):
    // - We only request readable text from the card iframe when the user triggers Export/Summary actions.
    // - We bind replies to the specific iframe via event.source to prevent other iframes from spoofing responses and polluting exported content.
    // 在闭包里快照 contentWindow，后续 event 校验一律对照这个快照做来源判定。
    // 为什么不在 handler 里每次读 iframe.contentWindow：iframe 被 detach 后它会变 null，
    // 那样任何 event.source 都会 !== null 而通过校验，反而变成"零校验"。
    const expectedWindow = iframe.contentWindow;

    const finish = (result) => {
      if (completed) {
        return;
      }
      completed = true;
      window.removeEventListener("message", handler);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      resolve(result);
    };

    const handler = (event) => {
      // ── 安全校验：只接受来自本次提取目标 iframe 的回执 ──
      // requestId 是 UUID/随机串，单靠它虽然攻击者难猜，但同页面里其它卡片/广告 iframe
      // 仍然可能监听到消息模式后向本对比页发伪造的 DYSEARCH_EXTRACT_RESULT，
      // 从而把导出 / 剪贴板 / 摘要里的内容替换成攻击者写的字符串。
      // 加 event.source 白名单后，即便攻击者抢先回消息，也会因 source 不匹配被丢弃。
      if (event.source !== expectedWindow) return;
      if (!event.data || event.data.type !== MSG.EXTRACT_RESULT || event.data.requestId !== requestId) {
        return;
      }

      finish({
        siteName: site.name,
        content: cleanExtractedContent(event.data.content || ""),
        turns: Array.isArray(event.data.turns) ? event.data.turns : null,
        url: event.data.url || site.url
      });
    };

    window.addEventListener("message", handler);

    try {
      // 站点 iframe 经常会跨 origin 重定向（例如入口域名跳到登录/对话域名）。
      // 使用 "*" 避免 targetOrigin 过期导致消息被静默丢弃；回包仍用 event.source + requestId 校验。
      const targetOrigin = "*";
      iframe.contentWindow.postMessage({
        type: MSG.EXTRACT,
        requestId,
        site,
        // 传入最近一次搜索词，inject.js 可在 turns 完全为空时用作 user turn 回退标签
        query: state.lastSearchQuery || ""
      }, targetOrigin);
    } catch (_error) {
      finish({
        siteName: site.name,
        content: "暂未提取到内容",
        turns: null,
        url: site.url
      });
      return;
    }

    timeoutId = window.setTimeout(() => {
      finish({
        siteName: site.name,
        content: "暂未提取到内容",
        turns: null,
        url: site.url
      });
    }, EXTRACT_TIMEOUT_MS);
  });
}

export function buildExportFilename(extension) {
  const query = state.lastSearchQuery || state.searchHistory[0]?.query || "";
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

  if (!query) {
    return `AI导出_${date}.${extension}`;
  }

  const keyword = query
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 16)
    .trim()
    .replace(/\s/g, "-");

  return `${keyword}_${date}.${extension}`;
}

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function cleanExtractedContent(content) {
  const text = String(content || "").trim();
  if (!text) {
    return "暂未提取到内容";
  }

  const junkPattern = /window\.__|\brequestAnimationFrame\b|function\s*\(|'use strict'|"use strict"|theme-host|__webpack|__NEXT_DATA__|gtag\(|ga\(/i;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !junkPattern.test(line))
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""));

  const result = lines.join("\n").trim();
  return result || text.slice(0, 6000) || "暂未提取到内容";
}
