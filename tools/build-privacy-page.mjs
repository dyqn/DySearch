// Builds publish/privacy.html from PRIVACY.md (English body) + PRIVACY.zh-CN-summary.md.
// Run: node tools/build-privacy-page.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "publish");
const OUT = path.join(OUT_DIR, "privacy.html");

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(text) {
  let out = text;
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, bold) => `<strong>${bold}</strong>`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const safe = /^(https?:\/\/|mailto:)/i.test(href) ? href : "#";
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return out;
}

const isListItem = (line) => /^(\s*)-\s+/.test(line);
const isTableDelim = (line) => /^\|[\s:|-]+\|$/.test(line.trim());

function renderTable(lines, start) {
  const split = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const head = split(lines[start]);
  let i = start + 2;
  const body = [];
  while (i < lines.length && lines[i].trim().startsWith("|")) body.push(split(lines[i++]));
  const thead = head.map((cell) => `<th>${inlineMd(escapeHtml(cell))}</th>`).join("");
  const tbody = body.map((row) => `      <tr>${row.map((cell) => `<td>${inlineMd(escapeHtml(cell))}</td>`).join("")}</tr>`).join("\n");
  return {
    html: `    <div class="tw">\n    <table>\n      <thead><tr>${thead}</tr></thead>\n      <tbody>\n${tbody}\n      </tbody>\n    </table>\n    </div>`,
    next: i,
  };
}

function renderList(lines, start) {
  const items = [];
  let i = start;
  while (i < lines.length && isListItem(lines[i])) {
    const [, indent, text] = lines[i].match(/^(\s*)-\s+(.*)$/);
    items.push({ depth: indent.length >= 2 ? 1 : 0, text });
    i += 1;
  }
  let html = "    <ul>\n";
  items.forEach((item, index) => {
    if (index > 0 && item.depth === 0 && items[index - 1].depth === 1) html += "        </ul>\n      </li>\n";
    if (item.depth === 0) {
      html += `      <li>${inlineMd(escapeHtml(item.text))}`;
    } else {
      if (items[index - 1].depth === 0) html += "\n        <ul>\n";
      html += `          <li>${inlineMd(escapeHtml(item.text))}</li>\n`;
    }
  });
  if (items.length && items[items.length - 1].depth === 1) html += "        </ul>\n      </li>\n";
  html += "    </ul>";
  return { html, next: i };
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let index = 0;

  const flush = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").trim();
    if (text) blocks.push(`    <p>${inlineMd(escapeHtml(text)).replace(/\u0001/g, "<br />")}</p>`);
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === "" || trimmed === "---") {
      flush();
      if (trimmed === "---") blocks.push("    <hr />");
      index += 1;
      continue;
    }
    if (trimmed.startsWith("|") && index + 1 < lines.length && isTableDelim(lines[index + 1])) {
      flush();
      const table = renderTable(lines, index);
      blocks.push(table.html);
      index = table.next;
      continue;
    }
    if (isListItem(line)) {
      flush();
      const list = renderList(lines, index);
      blocks.push(list.html);
      index = list.next;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length === 1 ? 2 : heading[1].length;
      blocks.push(`    <h${level}>${inlineMd(escapeHtml(heading[2].trim()))}</h${level}>`);
      index += 1;
      continue;
    }
    if (trimmed.startsWith(">")) {
      flush();
      const quote = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quote.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(`    <blockquote><p>${inlineMd(escapeHtml(quote.join(" ")))}</p></blockquote>`);
      continue;
    }
    paragraph.push(line.trimEnd() + (/[ \t]{2,}$/.test(line) ? "\u0001" : ""));
    index += 1;
  }
  flush();
  return blocks.join("\n");
}

const english = mdToHtml(fs.readFileSync(path.join(ROOT, "PRIVACY.md"), "utf8"));
const summary = mdToHtml(fs.readFileSync(path.join(ROOT, "PRIVACY.zh-CN-summary.md"), "utf8"));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>多元搜索 Dysearch — Privacy Policy 隐私政策</title>
<meta name="description" content="Privacy policy for the Dysearch browser extension: no developer-side collection, all settings stored locally, third-party data flows explained per permission." />
<style>
  :root { --ink:#1a1a1a; --muted:#5f6368; --line:#e3e5e8; --bg:#ffffff; --code:#f4f5f7; --accent:#111111; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#e8eaed; --muted:#9aa0a6; --line:#2c2f33; --bg:#17181a; --code:#22252a; --accent:#ffffff; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px 20px 72px; background:var(--bg); color:var(--ink);
    font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","Segoe UI Variable","Microsoft YaHei UI","Microsoft YaHei",Roboto,Helvetica,Arial,sans-serif;
    -webkit-text-size-adjust:100%; }
  main { max-width:820px; margin:0 auto; }
  h1 { font-size:28px; line-height:1.35; margin:0 0 4px; letter-spacing:.2px; }
  h2 { font-size:22px; margin:44px 0 14px; padding-bottom:8px; border-bottom:1px solid var(--line); }
  h3 { font-size:18px; margin:32px 0 10px; }
  h4 { font-size:16px; margin:24px 0 8px; }
  p { margin:12px 0; }
  a { color:var(--ink); text-decoration:underline; text-underline-offset:2px; word-break:break-word; }
  ul { margin:12px 0; padding-left:24px; }
  li { margin:6px 0; }
  code { background:var(--code); padding:2px 5px; border-radius:4px; font-size:.88em;
    font-family:ui-monospace,SFMono-Regular,Consolas,"Cascadia Mono",Menlo,monospace; word-break:break-word; }
  hr { border:0; border-top:1px solid var(--line); margin:32px 0; }
  blockquote { margin:16px 0; padding:12px 16px; border-left:3px solid var(--accent); background:var(--code); }
  blockquote p { margin:0; }
  table { width:100%; border-collapse:collapse; margin:16px 0; font-size:15px; }
  th, td { border:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; }
  th { background:var(--code); font-weight:600; }
  .tw { overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .langbar { display:flex; gap:8px; margin:0 0 28px; font-size:14px; }
  .langbar a { padding:5px 14px; border:1px solid var(--line); border-radius:999px; text-decoration:none; }
  .langbar a:hover { background:var(--accent); color:var(--bg); border-color:var(--accent); }
  .lead { color:var(--muted); font-size:15px; margin:0 0 24px; }
  .zh { }
  .en { margin-top:40px; }
  .note { color:var(--muted); font-size:13.5px; }
  footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted); font-size:13.5px; }
  @media (max-width:560px) { body { padding:24px 16px 56px; } h1 { font-size:24px; } }
  @media print { body { background:#fff; color:#000; } .langbar { display:none; } }
</style>
</head>
<body>
<main>
  <h1>多元搜索 Dysearch · Privacy Policy</h1>
  <p class="lead">浏览器扩展「多元搜索 / Dysearch」的隐私政策 · Privacy policy for the Dysearch browser extension</p>
  <nav class="langbar">
    <a href="#zh">中文要点</a>
    <a href="#en">Full policy (English)</a>
  </nav>

  <section id="zh" class="zh" lang="zh-CN">
${summary}
  </section>

  <hr />

  <section id="en" class="en" lang="en">
${english}
  </section>

  <footer lang="zh-CN">
    <p>本页面不含任何脚本，不加载外部资源，不放置 Cookie，也不做任何访问统计。<br />
    This page contains no scripts, loads no external resources, sets no cookies, and performs no analytics.</p>
    <p class="note">Source of truth: <code>PRIVACY.md</code> shipped inside the extension package — this page is generated from that file, so the two stay in sync.</p>
  </footer>
</main>
</body>
</html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html, "utf8");

const checks = {
  bytes: Buffer.byteLength(html),
  scriptTags: (html.match(/<script/gi) || []).length,
  resourceSrcAttrs: (html.match(/\ssrc=/gi) || []).length,
  h2: (html.match(/<h2/g) || []).length,
  h3: (html.match(/<h3/g) || []).length,
  h4: (html.match(/<h4/g) || []).length,
  li: (html.match(/<li>/g) || []).length,
  tableRows: (html.match(/<tr>/g) || []).length,
  rawUnescapedLt: (html.match(/<(all_urls|all_urls>)/gi) || []).length,
};
console.log(JSON.stringify(checks, null, 1));
console.log("wrote", OUT);
