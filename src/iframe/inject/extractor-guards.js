/**
 * extractor-guards.js
 * Shared node-level guards used by both extraction paths.
 *
 * Why these exist: in streaming chat UIs the assistant bubble usually contains
 * more than just the answer (a 思考/reasoning panel ahead of it, timestamps,
 * follow-up suggestion chips). Picking the *first* markdown node inside such a
 * bubble grabs the reasoning panel and loses the answer.
 *
 * Deliberately NOT filtered here: whether a node is painted on screen. Cards
 * live in iframes that can be hidden (collapsed layout, background tab), and a
 * visibility test then discards the whole conversation. That mistake cost one
 * release, so exclusion is name/label based only.
 */

import { domToMarkdown } from "./extractor-dom-to-markdown.js";

const REASONING_TOKENS = new Set([
  "think",
  "thinking",
  "thought",
  "thoughts",
  "reason",
  "reasoned",
  "reasoning",
  "cot",
  "deepthink",
  "deepthought",
]);
const REASONING_TEXT_RE = /(深度思考|思考过程|已完成思考|思考中|正在思考|推理过程|分析过程|thinking|reasoning)/i;

/**
 * 答案气泡里常见的"非正文卡片"：参考资料条、视频推荐卡、追问建议。
 * 它们和"思考过程"一样属于气泡内的杂项，判据同样只用名字（class/id/testid），
 * 不看内容长度也不看是否可见——真实回答里不会有整块叫这个名字的容器。
 */
const CHROME_BLOCK_RE = /(video|videos|recommend|related|refs|reference|references|citation|sources|suggest|follow-?up|ask-?more|quick-?ask)/i;
const CHROME_BLOCK_WORDS = new Set(["video", "videos", "recommend", "recommendation", "related", "refs", "reference", "references", "citation", "citations", "sources", "suggest", "suggestion", "suggestions", "followup", "followups", "ask", "askmore", "quickask"]);

/** Split a class/id/testid string into lowercase words, camelCase included. */
function tokensOf(value) {
  return String(value)
    .split(/[^A-Za-z]+/)
    .flatMap((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/\s+/))
    .map((word) => word.toLowerCase())
    .filter(Boolean);
}

function attrString(el) {
  const parts = [typeof el.className === "string" ? el.className : "", el.id];
  for (const name of ["data-testid", "data-test", "data-role", "data-part", "data-type", "aria-label"]) {
    parts.push(el.getAttribute ? el.getAttribute(name) : null);
  }
  return parts.filter(Boolean).join(" ");
}

function directTextOf(el) {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent || "")
    .join("")
    .trim();
}

/** True when a reasoning label ("深度思考", "Thinking…") is rendered inside el. */
function hasReasoningLabelWithin(el) {
  const labels = el.querySelectorAll("summary, h1, h2, h3, h4, span, div, p, button");
  for (const node of labels) {
    const text = directTextOf(node);
    if (text && text.length <= 24 && REASONING_TEXT_RE.test(text)) return true;
  }
  return false;
}

/** True when the element is a reasoning panel, by its own names or its collapse control. */
export function isReasoningElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (tokensOf(attrString(el)).some((word) => REASONING_TOKENS.has(word))) return true;
  const tag = el.tagName.toLowerCase();
  const collapsible = tag === "details" || tag === "summary" || el.hasAttribute("aria-expanded");
  return collapsible && hasReasoningLabelWithin(el);
}

/** True unless the element itself, or an ancestor up to root, is a reasoning panel. */
export function isAnswerCandidate(el, root) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (isReasoningElement(el) || isChromeBlockElement(el)) return false;
  let node = el.parentElement;
  while (node && node !== root && node.nodeType === Node.ELEMENT_NODE) {
    if (isReasoningElement(node) || isChromeBlockElement(node)) return false;
    node = node.parentElement;
  }
  return true;
}

/**
 * True when the node sits inside page chrome (sidebar / top bar / footer).
 * Only structural names are used: an <aside>/<nav>/<footer> tag, a landmark
 * role, or a shell-ish class/aria name. Text density cannot tell a one-sentence
 * answer from a one-sentence footer notice, but chrome never wraps an answer.
 */
const NAVISH_TAGS = new Set(["NAV", "ASIDE", "HEADER", "FOOTER"]);
const NAVISH_ROLES = new Set(["navigation", "menu", "menubar", "complementary", "contentinfo", "breadcrumb", "search", "toolbar", "tablist"]);
const NAVISH_NAME_RE = /(sidebar|side-nav|sidenav|navbar|nav-list|menu-list|__nav|__side|history-list|侧边栏|侧栏|导航|菜单|页脚)/i;

export function isWithinNavigation(el) {
  let node = el && el.nodeType === Node.ELEMENT_NODE ? el : null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (NAVISH_TAGS.has(node.tagName)) return true;
    if (NAVISH_ROLES.has(String(node.getAttribute("role") || "").toLowerCase())) return true;
    if (NAVISH_NAME_RE.test(String(node.className || "")) || NAVISH_NAME_RE.test(String(node.id || ""))) return true;
    if (NAVISH_NAME_RE.test(String(node.getAttribute("aria-label") || ""))) return true;
    node = node.parentElement;
  }
  return false;
}

/** Drop nodes that are descendants of another node in the same list. */
export function keepOutermost(nodes) {
  const list = Array.from(nodes || []);
  return list.filter((el) => !list.some((other) => other !== el && other.contains(el)));
}

/** Nodes that are not contained in another node of the same list (the reverse of keepOutermost). */
export function keepInnermost(nodes) {
  const list = Array.from(nodes || []);
  return list.filter((el) => !list.some((other) => other !== el && el.contains(other)));
}

/** Matches for a selector inside root that are not reasoning panels (empty result means "all of them are"). */
export function queryAnswerNodes(root, selector) {
  const found = Array.from(root.querySelectorAll(selector));
  const guarded = found.filter((el) => isAnswerCandidate(el, root));
  return keepOutermost(guarded);
}

/**
 * Markdown for a node list: reasoning nodes are dropped and the rest converted
 * and joined. When every candidate is a reasoning panel we still convert them,
 * because exporting reasoning plus nothing beats exporting nothing.
 */
export function markdownFromCandidates(nodes) {
  const list = Array.from(nodes || []);
  const guarded = list.filter((el) => !isReasoningElement(el));
  const picked = guarded.length > 0 ? guarded : list;
  const texts = [];
  for (const el of picked) {
    const text = markdownWithoutReasoning(el);
    if (!text) continue;
    if (!texts.some((prev) => prev === text || prev.includes(text))) texts.push(text);
  }
  // 再删"被后面某块完整包含"的短块：站点会把表头单独渲染一份（吸顶克隆），
  // 它先出现，上面的去重管不到，导出里表格就重复了一遍只有表头的空表。
  const merged = texts.filter((text, i) =>
    !texts.some((other, j) => j > i && other.includes(text))
  );
  return merged.join("\n\n").trim();
}

/**
 * True when the node is a non-answer card inside an answer bubble.
 * 类名命中"视频/引用/来源"只算一半：卡片里只有链接和一小截标题，
 * 一旦容器里有标题、段落、列表这类成块正文（DeepSeek 的小标题和"研究来源"整段
 * 就住在类名带 source 的容器里），就当正文留着，不剪。
 * 宁可留下一张卡片，也不能删掉一段答案。
 */
const PROSE_BLOCK_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table";

export function isChromeBlockElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  const named =
    tokensOf(attrString(el)).some((word) => CHROME_BLOCK_WORDS.has(word)) ||
    CHROME_BLOCK_RE.test(String(el.className || ""));
  if (!named) return false;
  return !el.querySelector(PROSE_BLOCK_SELECTOR);
}

/**
 * 历史对话列表：同一个父节点下并排着好几条结构一样、文字都很短的兄弟节点。
 * 侧边栏改版后可能不再是 <aside>，类名也猜不完，但"一整列短标题"这个形状很稳定。
 * 条件全部同时满足才剪：≥5 条、每条 ≤24 字、内部没有段落/列表/表格、
 * 这一列本身窄于 360px、不在回答气泡里、且删掉的字数不超过这份文本的三分之一。
 * 最后一条是保险丝：千问的回答本身就是一排短 div，误判会把答案整段删没。
 */
const LIST_MIN_ITEMS = 5;
const LIST_MAX_ITEM_CHARS = 24;
const LIST_MAX_TOTAL_CHARS = 200;
const LIST_MAX_PRUNE_RATIO = 0.34;
const LIST_MAX_SIDEBAR_WIDTH = 360;
const LIST_BLOCK_TAGS = ["p", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "table", "pre", "blockquote"];

function listGroupsOf(parent) {
  const groups = new Map();
  for (const child of parent.children) {
    const tag = child.tagName.toLowerCase();
    if (tag !== "div" && tag !== "a" && tag !== "span") continue;
    const text = String(child.textContent || "").trim();
    if (!text || text.length > LIST_MAX_ITEM_CHARS) return null;
    if (child.querySelector(LIST_BLOCK_TAGS.join(","))) return null;
    const key = tag + "." + (String(child.className || "").split(/\s+/)[0] || "");
    const group = groups.get(key) || [];
    group.push(child);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < LIST_MIN_ITEMS) continue;
    const total = group.reduce((sum, node) => sum + String(node.textContent || "").trim().length, 0);
    if (total > LIST_MAX_TOTAL_CHARS) continue;
    return group;
  }
  return null;
}

/** 回答气泡里的类名一旦命中，就绝不把它当成侧栏列表剪掉。 */
const ANSWER_NAME_RE = /(answer|assistant|markdown|prose|reply|response|bubble|msg[-_]?body|message-body)/i;

function insideAnswerBubble(node, root) {
  for (let cur = node.parentElement; cur && cur !== root.parentElement; cur = cur.parentElement) {
    if (ANSWER_NAME_RE.test(String(cur.className || "") + " " + String(cur.id || ""))) return true;
  }
  return false;
}

function collectListItemGroups(root) {
  const doomed = [];
  for (const parent of root.querySelectorAll("div, section, ul")) {
    if (parent.children.length < LIST_MIN_ITEMS) continue;
    const group = listGroupsOf(parent);
    if (!group) continue;
    if (insideAnswerBubble(parent, root)) continue;
    // 历史列表挤在左侧那一窄列里；回答那一栏是宽的。宽度取不到（没渲染）就宁可不剪，
    // 因为那种情况下 innerText 本来也拿不到这段文字。
    let width = 0;
    try {
      width = parent.getBoundingClientRect().width;
    } catch (_error) {
      width = 0;
    }
    if (!(width > 0 && width <= LIST_MAX_SIDEBAR_WIDTH)) continue;
    doomed.push(...group);
  }
  // 兜底：剪掉的字数超过了这份文本的三分之一，说明我们把答案本身当成列表删了
  // （千问的回答就是一排短 div 段落），这种情况下整条列表剪枝作废。
  const doomedChars = doomed.reduce((sum, node) => sum + String(node.textContent || "").trim().length, 0);
  const totalChars = String(root.textContent || "").trim().length;
  if (doomedChars > totalChars * LIST_MAX_PRUNE_RATIO) return [];
  return doomed;
}

/** Nodes inside el that are reasoning panels or recommendation/reference cards. */
function collectPrunedNodes(el) {
  const set = new Set();
  for (const node of el.querySelectorAll("*")) {
    if (isReasoningElement(node) || isChromeBlockElement(node)) set.add(node);
  }
  for (const node of collectListItemGroups(el)) {
    if (!set.has(node)) set.add(node);
  }
  return set;
}

function tableHeadText(table) {
  const thead = table.querySelector("thead");
  if (!thead) return "";
  return String(thead.textContent || "").replace(/\s+/g, " ").trim();
}

/**
 * 站点把表头单独克隆一份吸顶（千问的表格就是这样）：那份只有表头、没有数据行，
 * 转成 Markdown 就变成一张重复的空表。同块里已经有一张带数据行的同样表格时，
 * 把这份只有表头的剪掉——不分先后顺序，克隆可能在前也可能在后。
 */
function collectHeaderOnlyDuplicates(root) {
  const full = new Set();
  const headerOnly = [];
  for (const table of root.querySelectorAll("table")) {
    const head = tableHeadText(table);
    if (!head) continue;
    if (table.querySelectorAll("tbody td, tr td").length > 0) full.add(head);
    else headerOnly.push({ table, head });
  }
  return headerOnly.filter((item) => full.has(item.head));
}

function dropDuplicateHeaderTables(root) {
  for (const item of collectHeaderOnlyDuplicates(root)) item.table.remove();
}

function hasDuplicateHeaderTables(el) {
  return collectHeaderOnlyDuplicates(el).length > 0;
}

/**
 * Convert an element to Markdown, skipping reasoning/card subtrees and the
 * sticky duplicate table header. Falls back to the plain converter on error.
 */
export function markdownWithoutReasoning(el) {
  if (!el) return "";
  const pruned = collectPrunedNodes(el);
  if (pruned.size === 0 && !hasDuplicateHeaderTables(el)) return domToMarkdown(el);
  try {
    const clone = el.cloneNode(true);
    if (pruned.size > 0) {
      const live = Array.from(el.querySelectorAll("*"));
      const copies = Array.from(clone.querySelectorAll("*"));
      for (let i = 0; i < copies.length && i < live.length; i++) {
        if (!pruned.has(live[i])) continue;
        const tag = copies[i].tagName.toLowerCase();
        if (tag === "html" || tag === "body") continue;
        copies[i].remove();
      }
    }
    dropDuplicateHeaderTables(clone);
    return domToMarkdown(clone) || domToMarkdown(el);
  } catch (_err) {
    return domToMarkdown(el);
  }
}

/**
 * Pick the answer inside one assistant element.
 * Same shape as the previous implementation, except that every non-reasoning
 * match is kept (answers are often split across several markdown blocks) and
 * the original first-match behaviour is still used whenever the guard finds
 * nothing at all.
 */
export function extractAnswerMarkdown(el, selectors) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return "";
  for (const selector of selectors || []) {
    let all;
    let guarded;
    try {
      all = Array.from(el.querySelectorAll(selector));
      guarded = all.filter((node) => isAnswerCandidate(node, el));
    } catch (_err) {
      continue;
    }
    if (all.length === 0) continue;
    if (guarded.length === 0) return domToMarkdown(all[0]);
    const inner = keepInnermost(guarded);
    const text = markdownFromCandidates(inner.length > 0 ? inner : guarded);
    if (text) return text;
    return domToMarkdown(all[0]);
  }
  return markdownWithoutReasoning(el);
}
