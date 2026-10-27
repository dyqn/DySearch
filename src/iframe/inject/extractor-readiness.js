/**
 * extractor-readiness.js
 * 判断"这一轮回答写完了没有"，供导出/摘要在抓内容前等待。
 *
 * 只在页面上真实存在的名字上做判断，不猜类名：
 *   1) 停止按钮——站点在生成期间会在输入区放一个可访问名为"停止/Stop"的按钮；
 *   2) 站点自己写的进行中提示（"思考中""正在搜索"这类短标签）；
 *   3) 两条都不成立时，采样最后一块回答的字数是否还在增长。
 *
 * 为什么不看 DOM 是否可见、不看长度阈值：卡片在隐藏 iframe 里也要能导出，
 * 长度阈值又会把短回答误判成"还没写完"。字数增长是站点自己的信号，最可靠。
 */

const STOP_NAME_RE = /^(停止|停止回答|终止|终止回答|取消生成|停止生成|stop|stop\s*response|cancel\s*generation)$/i;
const IN_PROGRESS_RE = /(思考中|正在思考|正在搜索|搜索中|正在生成|生成中|正在阅读|阅读中|分析中|正在分析|Thinking|Searching|Generating|Reading)/i;

/** 输入区里的按钮、[role=button] 都可能被站点拿来当停止键 */
function candidateControls() {
  const nodes = Array.from(document.querySelectorAll("button, [role='button'], a[aria-label], span[role='img'][aria-label], [data-testid]"));
  return nodes;
}

function accessibleName(el) {
  const aria = String(el.getAttribute("aria-label") || "").trim();
  if (aria) return aria;
  const title = String(el.getAttribute("title") || "").trim();
  if (title) return title;
  return String(el.innerText || el.textContent || "").trim();
}

/** 找到页面上的"停止回答"按钮（按可访问名字，不按类名猜） */
export function findStopControl() {
  for (const el of candidateControls()) {
    const name = accessibleName(el);
    if (!name || name.length > 24) continue;
    if (STOP_NAME_RE.test(name)) return el;
  }
  return null;
}

/** 站点自己显示的进行中提示（短标签，避免把正文里的"正在思考人生"读成状态） */
export function findInProgressHint() {
  const nodes = Array.from(document.querySelectorAll("span, div, p, button, [role='status'], [aria-live]"));
  for (const el of nodes) {
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => String(n.textContent || "").trim())
      .join(" ")
      .trim();
    if (!text || text.length > 24) continue;
    if (IN_PROGRESS_RE.test(text)) return el;
  }
  return null;
}

function lastAnswerLength() {
  const nodes = Array.from(
    document.querySelectorAll(
      "[data-message-author-role='assistant'], [class*='markdown'], [class*='prose'], [class*='answer'], [class*='assistant'], [class*='response']"
    )
  );
  let max = 0;
  for (const el of nodes) {
    const len = String(el.innerText || "").trim().length;
    if (len > max) max = len;
  }
  return max;
}

/**
 * @returns {Promise<{ready: boolean, reason: string}>}
 */
export async function checkGenerationReady() {
  if (findStopControl()) return { ready: false, reason: "stop-button" };
  if (findInProgressHint()) return { ready: false, reason: "hint" };

  const before = lastAnswerLength();
  // 没有任何回答文字、也没有停止按钮和进行中提示 = 这页现在根本没在生成
  // （刚打开的历史对话、纯壳子页面）。这里若回"没写完"，父页会白等满 2 分钟。
  if (before === 0) return { ready: true, reason: "idle" };

  await new Promise((resolve) => setTimeout(resolve, 800));
  const after = lastAnswerLength();
  if (after > before) return { ready: false, reason: "growing" };
  return { ready: true, reason: after === before ? "stable" : "shrunk" };
}
