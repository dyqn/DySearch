/**
 * extractor-chrome.js
 * 站点固定文案（壳子）过滤：只删"整行完全等于已知界面文案"的行，
 * 不做模糊匹配、不删包含关键词的句子，避免把答案里的话误删。
 *
 * 为什么需要：AI 站点把"搜索到 15 个网页""已完成分析，共参考 23 篇资料"
 * "今天 16:25""内容由AI生成，可能不准确，请注意核实"这类状态条渲染在答案气泡内部，
 * 按容器抽取时它们会跟着一起进来，导出里就成了噪音。
 */

const EXACT_LINES = new Set([
  // 千问 / 通义侧边栏与输入区
  "日常",
  "工作",
  "新对话",
  "云空间",
  "千问创作",
  "对话分组",
  "新分组",
  "最近对话",
  "定时任务",
  "新定时任务",
  "向千问提问",
  "快速",
  "工作助理",
  "云端",
  "更多",
  "AI生视频",
  "PPT创作",
  "AI生图",
  "代码",
  "翻译",
  "AI写作",
  "录音纪要",
  "研究",
  "千问高考",
  "音视频速读",
  "你好，我是千问",
  "千问 - 阿里旗下全能AI助手",
  "内容由AI生成，可能不准确，请注意核实",
  "AI 生成可能有误 请核实",
  // 豆包侧边栏
  "API 服务",
  "API服务",
  "草稿",
  "项目",
  "最近",
  "插件 · 技能 · 伙伴",
  "云盘",
  "查看全部",
  "查看全部",
  "相关视频",
  "参考资料",
  "参考来源"
]);

const LINE_PATTERNS = [
  /^已完成分析[，,]?共参考\s*\d+\s*篇资料$/,
  /^正在?搜索\s*\d+\s*个?关键词[，,]?.*篇资料$/,
  /^搜索\s*\d+\s*个关键词[，,]?\s*(参考\s*\d+\s*篇资料)?$/,
  /^搜索到\s*\d+\s*个网页$/,
  /^搜索网页\s*[（(]\s*\d+\s*个结果\s*[)）]$/,
  /^参考\s*\d+\s*篇资料$/,
  /^共\s*\d+\s*条来源$/,
  /^共\s*\d+\s*篇来源$/,
  /^\d+\s*篇来源$/,
  /^已阅读\s*\d+\s*篇资料$/,
  /^今天\s*\d{1,2}[:：]\d{2}$/,
  /^昨天\s*\d{1,2}[:：]\d{2}$/,
  /^\d{4}-\d{2}-\d{2}\s*\d{1,2}[:：]\d{2}$/,
  /^已思考\s*\d+\s*秒$/,
  /^深度思考$/,
  /^已完成思考$/,
  // 视频推荐卡：我们自己转出来的图片标记（[图片: …] 只会由 <img> 产生，正文里不会出现）
  // 站点常把时长、缩略图、标题塞进同一个链接里，所以不限定行首。
  /\[图片:/,
  /^\[\s*\d{1,2}[:：]\d{2}\s*\]/,
  /^\d{1,2}[:：]\d{2}$/,
  // 引用角标被转成纯文本后剩下的这一小截（DeepSeek 的 "-2" / "-5"，粘在一起就是 "-2-5"）：
  // 必须是"短横+数字"独占一行才算，带空格或后面还有文字的一律不动，避免碰到代码块和列表。
  /^[-–—]\d{1,3}([,，、\s]*[-–—]?\d{1,3})*$/,
  // 模型选择器那一行：Qwen3.7-千问 / Qwen3-Max / DeepSeek-V3 这种"型号名独占一行"
  /^(Qwen|QwQ|DeepSeek|Kimi|Gemini|GPT|Claude|Doubao|豆包|通义|千问)[\w.\s·-]{0,14}([-–—][\u4e00-\u9fa5A-Za-z0-9]{1,8})?$/,
  /^(Ctrl|⌘)\s/
];

function isChromeLine(rawLine) {
  const line = String(rawLine || "").trim();
  if (!line) return false;
  if (EXACT_LINES.has(line)) return true;
  // markdown 链接写法（[云盘](/chat/drive)）与纯文本同义，剥掉壳再比一次
  const unlink = line.replace(/^\[([^\]]*)\]\([^)]*\)$/, "$1").trim();
  if (unlink && EXACT_LINES.has(unlink)) return true;
  // 站点侧栏渲染成 markdown 链接时被拆成多行（"[云盘" / "" / "](/chat/drive)"），
  // 整行匹配删不掉，会留下半个方括号。答案里不会出现这种断行的链接壳。
  if (/^\[[^\]]*$/.test(line) || /^\]\([^)]*\)$/.test(line)) return true;
  for (const pattern of LINE_PATTERNS) {
    if (pattern.test(line)) return true;
  }
  // 整行只有一个短导航词后面跟快捷键，如 "定时任务 Ctrl Shift T"
  if (/^.{1,12}\s+(Ctrl|⌘)\s/i.test(line)) return true;
  return false;
}

export function stripChromeLines(text, options = {}) {
  const source = String(text || "");
  if (!source) return source;
  const kept = source
    .split(/\r?\n/)
    .map((line) => {
      if (isChromeLine(line)) return null;
      const stripped = stripLeadingChrome(line);
      // 整行都是状态条（千问把"已完成分析…"和"搜索 N 个关键词…"粘在同一行）
      if (stripped === "" && String(line).trim() !== "") return null;
      return stripped;
    })
    .filter((line) => line !== null)
    .join("\n");
  if (options.allowEmpty) return kept.trim();
  // 兜底：过滤后什么都不剩，说明整段都是识别错的正文，宁可原样返回
  return kept.trim() ? kept : source;
}

export function stripChromeFromTurns(turns) {
  if (!Array.isArray(turns)) return turns;
  return turns
    .map((turn) => ({ ...turn, text: stripChromeLines(turn && turn.text, { allowEmpty: true }) }))
    .filter((turn) => String(turn.text || "").trim().length > 0);
}

// 状态条和答案挤在同一行时（Kimi 的 "搜索网页（50 个结果）  以下 3 个方法…"），
// 整行匹配删不掉，只能剥掉开头这一段。千问会把两条状态条连着塞在答案前面，
// 所以要反复剥，直到开头不再是状态条；剥完必须留下内容，否则原样返回。
const LEADING_PATTERNS = [
  /^搜索到\s*\d+\s*个网页[，,、:：\s]*/,
  /^搜索网页\s*[（(]\s*\d+\s*个结果\s*[)）][，,、:：\s]*/,
  /^已完成分析[，,]?共参考\s*\d+\s*篇资料[，,、:：\s]*/,
  /^搜索\s*\d+\s*个关键词[，,]?\s*(参考\s*\d+\s*篇资料)?[，,、:：\s]*/,
  /^参考\s*\d+\s*篇资料[，,、:：\s]*/,
  /^今天\s*\d{1,2}[:：]\d{2}[，,、:：\s]*/,
  /^深度思考[，,、:：\s]+/,
  /^已完成思考[，,、:：\s]+/
];

function stripLeadingChrome(line) {
  let text = String(line || "");
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const pattern of LEADING_PATTERNS) {
      const match = text.match(pattern);
      if (!match || !match[0]) continue;
      const rest = text.slice(match[0].length);
      // 剥掉状态条后几乎什么都不剩 → 这一行本来就是状态条
      if (rest.trim().length < 8) return "";
      text = rest;
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return text;
}
