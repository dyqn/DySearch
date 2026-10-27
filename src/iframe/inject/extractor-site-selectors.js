/**
 * extractor-site-selectors.js
 * Page-text extraction: site-specific CSS selectors + generic fallback.
 * Exports: extractReadablePageText (called by extractor.js entry point)
 */

import { extractAnswerMarkdown, isWithinNavigation, keepOutermost, markdownWithoutReasoning, queryAnswerNodes } from "./extractor-guards.js";
import { stripChromeLines } from "./extractor-chrome.js";

function getSiteContentConfig(host) {
  const configs = {
    "chatgpt.com": {
      containers: ["[data-message-author-role='assistant']"],
      content: [".markdown.prose", ".prose", "[class*='markdown']", "article"],
    },
    "chat.openai.com": {
      containers: ["[data-message-author-role='assistant']"],
      content: [".markdown.prose", ".prose"],
    },
    "chat.deepseek.com": {
      containers: ["[class*='ds-message-bubble'][class*='assistant']", "[class*='message'][class*='assistant']"],
      content: ["[class*='ds-markdown']", "[class*='markdown']", "[class*='chat-message-content']"],
    },
    "kimi.moonshot.cn": {
      containers: ["[class*='segment-item']", "[class*='message'][class*='ai']", "[class*='bubble'][class*='assistant']"],
      content: ["[class*='markdown-content']", "[class*='content']", "[class*='text']"],
    },
    "kimi.com": {
      containers: ["[class*='segment-item']", "[class*='message'][class*='ai']", "[class*='bubble'][class*='assistant']", "[class*='chat-content-item']"],
      content: ["[class*='markdown-content']", "[class*='content']", "[class*='text']", "[class*='markdown']"],
    },
    "tongyi.aliyun.com": {
      containers: ["[class*='answer-message']", "[class*='agent-chat__answer']", "[class*='chat-bubble']"],
      content: ["[class*='markdown']", "[class*='answer-text']", "[class*='content']"],
    },
    "doubao.com": {
      containers: ["[data-author-type='2']", "[class*='chat-response']", "[class*='assistant-message']"],
      content: ["[class*='markdown']", "[class*='message-text']", "[class*='content']"],
    },
    "gemini.google.com": {
      containers: ["model-response", "message-content[class*='model']", "[class*='response-container']"],
      content: [".markdown", "[class*='response-content']", "[class*='model-response-text']"],
    },
    "chatglm.cn": {
      containers: ["[class*='chat-msg--ai']", "[class*='assistant-message']"],
      content: ["[class*='content']", "[class*='markdown']", "[class*='text']"],
    },
    "yuanbao.tencent.com": {
      containers: ["[class*='agent-chat__message--ai']", "[class*='ai-message']"],
      content: ["[class*='hyper-text']", "[class*='markdown']", "[class*='content']"],
    },
    "qianwen.com": {
      containers: ["[class*='answer-message']", "[class*='ai-message']", "[class*='assistant-message']"],
      content: ["[class*='markdown']", "[class*='answer-text']", "[class*='content']"],
    },
  };

  for (const [domain, config] of Object.entries(configs)) {
    if (host === domain || host.endsWith("." + domain)) return config;
  }
  return null;
}

/**
 * 一个块里到底装的是正文还是导航/壳子——只看文字本身的形状：
 * 长文本节点多不多（段落、句子），链接文字占多大比例。
 * 刻意不数 <p>/<li> 标签：React 站点的段落经常是嵌套 div/span，
 * 数标签会让整页外壳（侧边栏+答案+页脚）当成兜底结果导出。
 */
const MIN_LINE_CHARS = 14;
const SCAN_TEXT_NODE_CAP = 400;

// 选择器本身已经说明"这是回答"（author-role / assistant / ai-message 这类）时，
// 不再要求正文密度：三四句话的短答案会卡在密度门槛上被丢掉，
// 那比混进一两个杂词更糟。密度只用来拦 [class*='content'] 这类含糊选择器。
const ROLE_SELECTOR_PATTERN = /author-role|assistant|ai-message|bot-message|answer|receiver-content|model-response|message--bot|data-author-type/i;

function contentStats(el) {
  let total = 0;
  let longNodes = 0;
  let linkChars = 0;
  let elements = 0;
  let scanned = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      elements++;
      continue;
    }
    const len = String(node.nodeValue || "").trim().length;
    if (!len) continue;
    scanned++;
    total += len;
    if (len >= MIN_LINE_CHARS) longNodes++;
    for (let p = node.parentElement; p && p !== el; p = p.parentElement) {
      if (p.tagName === "A") {
        linkChars += len;
        break;
      }
    }
    if (scanned >= SCAN_TEXT_NODE_CAP) break;
  }
  return { total, longNodes, linkChars, elements };
}

function looksLikeProse(el) {
  if (isWithinNavigation(el)) return false;
  const stats = contentStats(el);
  // 20 字以下基本都是按钮文案、标签、欢迎语，不可能是这次要导出的回答
  if (stats.total < 20 || stats.total > 40000) return false;
  if (stats.linkChars / stats.total > 0.5) return false;
  if (stats.longNodes >= 2) return true;
  // 只有一两句的短回答（"先…再…"这种）在 qshot 原版是能导出的。
  // 它和壳子的区别不在长度，而在块里还有没有别的东西：
  // 答案块子节点很少，壳子块裹着一堆菜单项/卡片。
  return stats.elements <= 14 && stats.linkChars / stats.total <= 0.25;
}

/**
 * Matches for a page-wide selector, with reasoning panels removed.
 * If everything matched is a reasoning panel we fall back to matching all of
 * them: exporting reasoning text is worse than exporting nothing, but exporting
 * nothing while an answer exists is worse still.
 */
function answerNodesOrDefault(selector, { proseOnly = true } = {}) {
  const guarded = queryAnswerNodes(document.body, selector);
  const nodes = guarded.length > 0 ? guarded : keepOutermost(Array.from(document.querySelectorAll(selector)));
  if (!proseOnly || ROLE_SELECTOR_PATTERN.test(selector)) return nodes;
  return nodes.filter(looksLikeProse);
}

function collectTexts(nodes) {
  const texts = [];
  for (const node of nodes) {
    const text = markdownWithoutReasoning(node);
    if (!text) continue;
    if (!texts.some((prev) => prev === text || prev.includes(text))) texts.push(text);
  }
  return texts;
}

function extractBySiteSelectors(host) {
  const config = getSiteContentConfig(host);
  if (!config) return "";

  const parts = [];
  // The same answer is often matched twice (outer wrapper + inner bubble), and
  // the flat text feeds the "---" Q&A parser, so nested/duplicate blocks here
  // would be exported as two separate answers.
  const pushPart = (text) => {
    if (!text) return;
    if (parts.some((prev) => prev === text || prev.includes(text))) return;
    parts.push(text);
  };

  for (const containerSel of (config.containers || [])) {
    const containers = keepOutermost(Array.from(document.querySelectorAll(containerSel)));
    if (containers.length === 0) continue;

    for (const container of containers) {
      pushPart(extractAnswerMarkdown(container, config.content));
    }

    if (parts.length > 0) break;
  }

  if (parts.length > 0) return parts.join("\n\n---\n\n").slice(0, 10000);

  for (const contentSel of (config.content || [])) {
    const nodes = answerNodesOrDefault(contentSel);
    const texts = collectTexts(nodes);
    if (texts.length > 0) return texts.join("\n\n---\n\n").slice(0, 10000);
  }

  return "";
}

/**
 * 站点改版、类名全换时的兜底：用"内容密度"找正文块——
 * 密度 = 文字量 / (1 + 子元素数)。整页外壳文字多但混着侧边栏、页脚、按钮，密度被稀释；
 * 答案块几乎每个子节点都是长句子，密度高。先按密度筛，再在合格里取文字量最大的，
 * 避免只拿到一个段落。这一步之前，任何结果都会退化成 body.innerText（把导航一起导出）。
 */
function extractProseFallback() {
  const root = document.body;
  if (!root) return "";
  const scored = [];
  let bestDensity = 0;
  for (const el of root.querySelectorAll("div, section, article, main, td, li")) {
    if (el.childElementCount < 2) continue;
    if (isWithinNavigation(el)) continue;
    const stats = contentStats(el);
    if (stats.total < 200 || stats.longNodes < 3) continue;
    if (stats.linkChars / stats.total > 0.5) continue;
    const density = stats.total / (1 + stats.elements);
    if (density > bestDensity) bestDensity = density;
    scored.push({ el, density, total: stats.total });
  }
  if (scored.length === 0) return "";

  let chosen = null;
  for (const candidate of scored) {
    if (candidate.density < bestDensity * 0.6) continue;
    if (!chosen || candidate.total > chosen.total) chosen = candidate;
  }
  if (!chosen) {
    chosen = scored.reduce((a, b) => (a.density >= b.density ? a : b));
  }
  return markdownWithoutReasoning(chosen.el).slice(0, 10000);
}

function extractWithGenericSelectors() {
  const selectors = [
    "[data-message-author-role='assistant']",
    ".markdown",
    ".prose",
    "[class*='assistant-message']",
    "[class*='ai-message']",
    "[class*='bot-message']",
    "[class*='response-content']",
  ];

  for (const selector of selectors) {
    const texts = collectTexts(answerNodesOrDefault(selector));
    if (texts.length > 0) return texts.join("\n\n---\n\n").slice(0, 10000);
  }

  const prose = extractProseFallback();
  if (prose) return prose;

  for (const selector of ["main article", "main"]) {
    const texts = collectTexts(answerNodesOrDefault(selector));
    if (texts.length > 0) return texts.join("\n\n---\n\n").slice(0, 10000);
  }

  // 学 XuSearch：壳子（侧边栏、页脚、视频推荐卡）当答案导出比说"暂未提取到内容"更糟。
  // 但也不能一律不回内容——站点正在搜索/刚出第一句时，容器和密度都可能没锁定，
  // 所以最后再给整页文字一次机会：必须长句足够多（正文特征）且链接占比低（非导航）。
  const body = document.body;
  if (body) {
    const stats = contentStats(body);
    if (stats.longNodes >= 6 && stats.linkChars / Math.max(1, stats.total) <= 0.35) {
      return markdownWithoutReasoning(body).slice(0, 8000);
    }
  }
  return "";
}

export function extractReadablePageText() {
  const host = window.location.hostname.replace(/^www\./, "");
  const siteText = extractBySiteSelectors(host);
  // 站点专属选择器命中的块就是回答本体：哪怕只有一句话也要留着。
  // 上游 qshot 这里要求超过 40 字，于是一句话回答被退回通用路径，
  // 而通用路径的兜底是整页文字——侧边栏、页脚会跟着一起进导出。
  // 唯一的例外是命中的全是壳子文案（剥掉壳子行后什么都不剩）。
  if (siteText && stripChromeLines(siteText)) return siteText;
  return extractWithGenericSelectors();
}
