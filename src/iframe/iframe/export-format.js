import { escapeHtml } from "./utils.js";
import { renderMarkdown } from "./ai-summary-render.js";

/**
 * 导出正文的统一预处理。
 * HTML 导出保留 `#` 标题语法，交给 renderMarkdown 变成真正的标题；
 * Markdown / TXT 仍按 flattenExportBodyMarkdown 的规则把标题压成加粗行，避免与外层标题层级冲突。
 */
function prepareExportBody(raw, keepHeadings) {
  if (keepHeadings) {
    const text = String(raw || "").trim();
    return (text || "暂未提取到内容").replace(/\n{3,}/g, "\n\n");
  }
  return flattenExportBodyMarkdown(raw);
}

/**
 * 导出用：去掉正文里的 #～###### 标题语法，改为加粗行，避免与外层「问题 / 模型」标题层级冲突；
 * 保留列表、加粗等；合并过多空行为「段落之间空一行」。
 */
export function flattenExportBodyMarkdown(raw) {
  const text = String(raw || "").trim();
  if (!text || text === "暂未提取到内容") {
    return text || "暂未提取到内容";
  }

  const lines = text.split(/\r?\n/);
  const out = [];
  let inCodeFence = false;
  for (const line of lines) {
    const trimmedEnd = line.trimEnd();
    const trimmed = trimmedEnd.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      out.push(trimmedEnd);
      continue;
    }
    if (inCodeFence) {
      out.push(trimmedEnd);
      continue;
    }
    const headingMatch = trimmedEnd.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const title = headingMatch[2].trim();
      out.push(`**${title}**`);
      out.push("");
    } else {
      out.push(trimmedEnd);
    }
  }

  let result = out.join("\n");
  result = result.replace(/\n{3,}/g, "\n\n").trim();
  return result || "暂未提取到内容";
}

/**
 * 当 turns 提取失败时，从平铺的 content 文本里尝试解析 Q&A pairs。
 * 支持两种模式：
 *   1. Claude 的 "You said: xxx" 文本标记
 *   2. 通用 "---" 分隔块（Grok、Kimi 等，extractReadablePageText 用 --- 拼接多个容器）
 */
function parseQAFromFlatContent(content, keepHeadings = false) {
  if (!content || content === "暂未提取到内容") return null;

  // 清理 UI 杂项（按钮文字等）——同时处理行内和行尾形式
  const cleanUI = (text) =>
    text
      .replace(/(编辑|复制|分享|收藏|朗读|Edit|Copy|Share|点赞|踩|Thumbs up|Thumbs down)\s*/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  // ── 模式 1：Claude "You said: xxx" ─────────────────────────────────────────
  if (content.includes("You said:")) {
    const pairs = [];
    const segs = content.split(/(?:^|\n)You said:\s*/m).filter(Boolean);
    for (const seg of segs) {
      const nl = seg.indexOf("\n");
      if (nl === -1) continue;
      const question = seg.slice(0, nl).trim();
      let answer = seg.slice(nl).trim();
      answer = answer
        .replace(/^[^\n]*Claude responded:[^\n]*\n/gm, "")
        .replace(/^\d{1,2}:\d{2}\s*\n/gm, "")
        .replace(/^Claude is AI[^\n]*\n/gm, "")
        .replace(/^Sonnet[^\n]*\n/gm, "")
        .replace(/^Adaptive\s*\n/gm, "")
        .replace(/^[^\n]*finished the response[^\n]*\n/gm, "")
        .trim();
      if (question && answer && answer.length > 20) {
        pairs.push({ question, answers: [prepareExportBody(answer, keepHeadings)] });
      }
    }
    if (pairs.length > 0) return pairs;
  }

  // ── 模式 2：按 "---" 分隔块，短块=用户问题，长块=AI 回答 ──────────────────
  const blocks = content
    .split(/\n{1,2}---\n{1,2}/)
    .map((b) => cleanUI(b))
    .filter((b) => b.length > 0);

  if (blocks.length < 2) return null;

  /**
   * 判断一个块是否"像用户问题"，采用严格标准避免把 AI 回答的第一句话误判为问题：
   * - 长度 8~350 字符（排除过短的代码片段和过长的 AI 回答）
   * - 不包含反引号（排除代码）
   * - 不包含编程关键词
   * - 没有 markdown 结构标记（排除 AI 格式化回答）
   * - 不以数字序号或破折号列表开头（排除 AI 列表回答）
   */
  const isQuestion = (b) => {
    if (!b || b.length < 8 || b.length > 350) return false;
    if (/`/.test(b)) return false;
    if (/\bfunction\b|\bconst\b|\blet\b|\bvar\b|\bclass\b|\breturn\b|=>|===/m.test(b)) return false;
    const mdCount = (b.match(/^#{1,6}\s|^\s*[-*+]\s|\*\*|```/gm) || []).length;
    if (mdCount > 0) return false;
    if (/^\d+[\.\)]\s/.test(b.trim())) return false;
    return true;
  };

  const pairs = [];
  let i = 0;
  while (i < blocks.length) {
    if (isQuestion(blocks[i])) {
      const q = blocks[i].replace(/\r?\n/g, " ").trim();
      const ansBlocks = [];
      let j = i + 1;
      while (j < blocks.length && !isQuestion(blocks[j])) {
        ansBlocks.push(blocks[j]);
        j++;
        if (ansBlocks.length >= 2) break;
      }
      if (ansBlocks.length > 0 && q.length >= 2) {
        pairs.push({
          question: q,
          answers: [prepareExportBody(ansBlocks.join("\n\n"), keepHeadings)],
        });
        i = j;
        continue;
      }
    }
    i++;
  }

  return pairs.length > 0 ? pairs : null;
}

const normDedupeText = (text) => String(text || "").replace(/\s+/g, "");
const MIN_DUPLICATE_CHARS = 40;
const DUPLICATE_OVERLAP = 0.6;

/** 短文本被长文本覆盖的比例（按 12 字符滑窗抽样，避免整段子串比对）。 */
function overlapRatio(shortText, longText) {
  if (!shortText || !longText) return 0;
  const size = 12;
  if (shortText.length < size) return longText.includes(shortText) ? 1 : 0;
  let total = 0;
  let hit = 0;
  for (let i = 0; i + size <= shortText.length; i += size) {
    total++;
    if (longText.includes(shortText.slice(i, i + size))) hit++;
  }
  return total ? hit / total : 0;
}

function isDuplicateText(a, b) {
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length < MIN_DUPLICATE_CHARS) return false;
  return overlapRatio(short, long) >= DUPLICATE_OVERLAP;
}

/**
 * 同一轮回答被重复抓取时（外层容器和内层气泡常常都会命中选择器），只保留一条。
 * 保留文字更短的那条：超集那份通常还带着提问回显、时间戳、追问建议按钮等界面杂讯。
 */
function dedupeByAnswer(items, getAnswer) {
  const out = [];
  const keys = [];
  for (const item of items) {
    const key = normDedupeText(getAnswer(item));
    if (!key) continue;
    const hit = keys.findIndex((prev) => isDuplicateText(prev, key));
    if (hit === -1) {
      out.push(item);
      keys.push(key);
      continue;
    }
    if (key.length < keys[hit].length) {
      out[hit] = item;
      keys[hit] = key;
    }
  }
  return out;
}

/** 重复的 Q&A 轮次合并；没有抓到回答的提问属于界面杂讯，直接丢掉。 */
function dedupeQAPairs(pairs) {
  return dedupeByAnswer(pairs, (pair) => pair.answers.join("\n\n"));
}

/** 比较用的归一化：空白和中文标点差异不算差异 */
function normEchoText(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .replace(/[，。、；：！？…·—\-,.:;?!'"“”‘’]/g, "")
    .toLowerCase();
}

/**
 * 答案气泡里会把用户提问原样回显一遍（千问每条回答上面都顶着一句问题），
 * 结尾还可能挂一句"需要我帮你…吗？"的追问建议。这两类都不是回答内容。
 * 剥完什么都不剩就保留原文——宁可多留一句，不能把答案剥没。
 */
/** 壳子短行的特征：一行话、没有 markdown 结构、不超过 40 字。 */
function looksLikeChromePara(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 40 || /\n/.test(t)) return false;
  return !/^[#>*\-|]/.test(t);
}

/**
 * 千问把侧栏历史标题、模型名芯片顶在回答前面，回显的用户提问正好是它们的分界线：
 * 提问之前全是短行壳子，就一起丢掉。提问回显出现在第 6 段之后不动它——
 * 那是回答自己在引用问题，不是页面壳子。
 */
function trimLeadingChrome(paragraphs, questionKey) {
  const upto = Math.min(paragraphs.length, 6);
  let echoAt = -1;
  for (let i = 0; i < upto; i++) {
    if (normEchoText(paragraphs[i]) === questionKey) {
      echoAt = i;
      break;
    }
  }
  if (echoAt < 1) return paragraphs;
  if (!paragraphs.slice(0, echoAt).every(looksLikeChromePara)) return paragraphs;
  return paragraphs.slice(echoAt + 1);
}

function stripQuestionEcho(answerList, question) {
  const q = normEchoText(question);
  if (!q) return answerList;
  return answerList.map((answer) => {
    const paragraphs = trimLeadingChrome(String(answer || "").split(/\n{2,}/), q);
    const text = paragraphs.filter((p) => normEchoText(p) !== q).join("\n\n").trim();
    return text ? text : answer;
  });
}

/** 只认"我来帮你做某事"和"反问你一句"这两种收尾，避免误伤以"需要"开头的正文段落。 */
const FOLLOW_UP_RE = /^\s*(需要我|要不要我|需不需要我|是否需要我|想不想让我|我可以帮|我可以为你|我也可以|你呢|你觉得呢|你怎么看)/;

function trimTrailingRules(paragraphs) {
  const kept = paragraphs.slice();
  while (kept.length > 1 && /^(-{3,}|_{3,}|\*{3,})$/.test(String(kept[kept.length - 1]).trim())) {
    kept.pop();
  }
  return kept;
}

function stripTrailingFollowUp(answerList) {
  if (answerList.length === 0) return answerList;
  return answerList.map((answer, index) => {
    if (index !== answerList.length - 1) return answer;
    const paragraphs = String(answer || "").split(/\n{2,}/);
    const last = String(paragraphs[paragraphs.length - 1] || "").trim();
    if (paragraphs.length === 1 || last.length > 220) return answer;
    if (!FOLLOW_UP_RE.test(last) || !/[？?]/.test(last.slice(0, 160))) return answer;
    const kept = trimTrailingRules(paragraphs.slice(0, -1)).join("\n\n").trim();
    return kept ? kept : answer;
  });
}

function tidyPairs(list) {
  return (list || []).map((pair) => {
    const before = pair.answers || [];
    let answers = stripQuestionEcho(before, pair.question);
    answers = stripTrailingFollowUp(answers);
    answers = answers.filter((answer) => String(answer || "").trim().length > 0);
    // 保险丝：清洗后一条答案都不剩，说明规则误伤了，原样留着——
    // 导出里多一行壳子，远好过整段回答没了。
    if (answers.length === 0 && before.length > 0) return { ...pair, answers: before };
    return { ...pair, answers };
  });
}

/** 同样规则用于平铺文本块。 */
function dedupeTextBlocks(blocks) {
  return dedupeByAnswer(blocks, (block) => block);
}

/**
 * 将单个模型的对话提取为 Q&A pair 列表。
 * 优先使用结构化的 turns，其次用 content 文本解析兜底。
 * 每个 pair：{ question: string, answers: string[] }
 */
function extractModelQAPairs(resp, keepHeadings = false) {
  const turns = Array.isArray(resp.turns) ? resp.turns : null;
  const pairs = [];
  if (turns && turns.length > 0) {
    let cur = null;
    for (const turn of turns) {
      if (turn.role === "user") {
        const q = String(turn.text || "")
          .replace(/^(你说|You\s+said)[：:：\s]*/i, "")
          .trim();
        if (!q) continue;
        cur = { question: q, answers: [] };
        pairs.push(cur);
      } else if (turn.role === "assistant" && cur) {
        const text = prepareExportBody(turn.text, keepHeadings);
        const last = cur.answers[cur.answers.length - 1];
        if (text && text !== last) cur.answers.push(text);
      }
    }
    // turns 里只有 user（站点还在搜索/刚开始生成时就是这样）时不能就此收工，
    // 否则平铺文本里已经拿到的答案会被丢掉，导出只剩"暂未提取到内容"。
    if (pairs.some((p) => p.answers.length > 0)) {
      const deduped = dedupeQAPairs(pairs);
      if (deduped.length > 0) return tidyPairs(deduped);
      return tidyPairs(pairs);
    }
  }

  const contentPairs = parseQAFromFlatContent(resp.content, keepHeadings);
  if (contentPairs && contentPairs.length > 0) return tidyPairs(dedupeQAPairs(contentPairs));

  // turns 里有提问但没有答案，而平铺文本里有答案（DeepSeek 常见：提问在 user 气泡、
  // 答案只在平铺文本里）：把答案并回这一轮，别把提问丢掉——
  // 上一版就是这里两头翘，要么只有提问，要么只有答案。
  if (pairs.length === 1 && pairs[0].answers.length === 0) {
    const flat = prepareExportBody(resp.content || "", keepHeadings);
    if (flat && flat !== "暂未提取到内容" && flat.length > 10) {
      return tidyPairs([{ ...pairs[0], answers: [flat] }]);
    }
  }

  return [];
}

/**
 * 将单个模型的数据渲染为指定格式的文本块。
 * 新格式：模型名一级标题 + URL，对话轮次用 "User:" / "AI:" 标签展示。
 * 当无法提取用户提问时（如豆包、元宝等），直接用 "AI:" 前缀展示各条回答。
 */
export function renderSingleModelBlock(resp, format) {
  const name     = resp.siteName;
  const url      = resp.url;
  const keepHeadings = format === "html";
  const pairs    = extractModelQAPairs(resp, keepHeadings);

  const contentBlocks = (() => {
    const raw = resp.content || "";
    if (!raw || raw === "暂未提取到内容") return [];
    const bs = dedupeTextBlocks(
      raw
        .split(/\n{1,2}---\n{1,2}/)
        .map((b) => prepareExportBody(b.trim(), keepHeadings))
        .filter((b) => b && b !== "暂未提取到内容" && b.length > 10)
    );
    return bs;
  })();

  const singleFallback = prepareExportBody(resp.content || "暂未提取到内容", keepHeadings);

  if (format === "markdown") {
    const header = `# ${name}\n\n**URL：**${url}`;

    if (pairs.length > 0) {
      const body = pairs
        .map((p) => {
          const qLine = p.question.replace(/\r?\n/g, " ").trim();
          const ans   = p.answers.join("\n\n") || "暂未提取到内容";
          return [
            qLine ? `**User:** ${qLine}` : null,
            `**AI:** ${ans}`,
          ].filter(Boolean).join("\n\n");
        })
        .filter(Boolean)
        .join("\n\n---\n\n");
      return `${header}\n\n${body}`;
    }

    if (contentBlocks.length > 1) {
      const body = contentBlocks.map((b) => `**AI:** ${b}`).join("\n\n---\n\n");
      return `${header}\n\n${body}`;
    }
    return `${header}\n\n${singleFallback}`;
  }

  if (format === "html") {
    const headerHtml = `<h1>${escapeHtml(name)}</h1><p><strong>URL：</strong><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>`;
    const answerHtml = (text) => `<div class="ai-body">${renderMarkdown(text, { links: true })}</div>`;

    if (pairs.length > 0) {
      const body = pairs
        .map((p) => {
          const qLine = p.question.replace(/\r?\n/g, " ").trim();
          const ans   = p.answers.join("\n\n") || "暂未提取到内容";
          return [
            qLine ? `<p class="user-turn"><strong>User:</strong> ${escapeHtml(qLine)}</p>` : null,
            `<section class="ai-turn"><strong>AI:</strong>${answerHtml(ans)}</section>`,
          ].filter(Boolean).join("");
        })
        .filter(Boolean)
        .join("<hr class=\"turn-sep\">");
      return `<section class="model-section">${headerHtml}${body}</section>`;
    }

    if (contentBlocks.length > 1) {
      const body = contentBlocks
        .map((b) => `<section class="ai-turn"><strong>AI:</strong>${answerHtml(b)}</section>`)
        .join("<hr class=\"turn-sep\">");
      return `<section class="model-section">${headerHtml}${body}</section>`;
    }
    return `<section class="model-section">${headerHtml}${answerHtml(singleFallback)}</section>`;
  }

  // ── TXT ─────────────────────────────────────────────────────────────────────
  if (pairs.length > 0) {
    const body = pairs
      .map((p) => {
        const qLine = p.question.replace(/\r?\n/g, " ").trim();
        const ans   = p.answers.join("\n\n") || "暂未提取到内容";
        return [qLine ? `User: ${qLine}` : null, `AI: ${ans}`].filter(Boolean).join("\n\n");
      })
      .filter(Boolean)
      .join("\n\n" + "-".repeat(40) + "\n\n");
    return `${name}\nURL: ${url}\n\n${body}`;
  }

  if (contentBlocks.length > 1) {
    const body = contentBlocks
      .map((b) => `AI: ${b}`)
      .join("\n\n" + "-".repeat(40) + "\n\n");
    return `${name}\nURL: ${url}\n\n${body}`;
  }
  return `${name}\nURL: ${url}\n\n${singleFallback}`;
}
