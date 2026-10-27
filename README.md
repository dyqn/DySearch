<p align="center">
  <img src="src/icons/icon128.png" width="80" height="80" alt="多元搜索 Logo">
</p>

<h1 align="center">多元搜索 · Dysearch</h1>

<p align="center">
  <strong>Language / 语言</strong>：
  <a href="#readme-zh">简体中文</a> ·
  <a href="#readme-en">English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Version-1.0.1-green" alt="Version">
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue" alt="License">
  <img src="https://img.shields.io/badge/Build-esbuild-orange" alt="Build Tool">
</p>

<p align="center">
  <a href="PRIVACY.md">隐私政策</a> ·
  <a href="LICENSE">开源协议</a>
</p>

---

## 项目来源

多元搜索（Dysearch）基于开源项目 [Qshot](https://github.com/30bewater/Qshot) v1.1.5（GPL-3.0）二次开发，继续沿用 GPL-3.0 协议开源。

---

<a id="readme-zh"></a>

## 简体中文

<p align="center">
  一次提问，并排打开多个 AI / 搜索站点，对比回答、导出整理。<br>
  支持 Ctrl+Q 全局浮层、分组管理、提示词库、自定义站点、AI 一键总结等。
</p>

### 项目定位

多元搜索（Dysearch）是一个 **Chrome / Edge Manifest V3** 扩展，面向「多元搜索 / 多 AI 对比」场景：

- 减少在 ChatGPT、DeepSeek、Kimi、Gemini 等站点之间来回切换的成本
- 同一问题并排查看多个模型的回答
- 分组、提示词、历史、布局等均可配置，**数据保存在浏览器本地**

> 本仓库基于 **v1.1.5 商店核心版** 源码，只保留商店功能（`npm run build:store`），不含实验模块。

### 核心功能

| 功能 | 说明 |
|------|------|
| 多站并行搜索 | 一次输入，同时向多个 AI / 搜索站点发送 |
| Compare 对比页 | 多栏 / 全局布局并排展示，支持卡片导航与布局持久化 |
| Ctrl+Q 悬浮层 | 任意网页快速唤起搜索、历史与提示词 |
| 分组与站点 | 内置主流 AI 站 + 自定义 URL 模板，分组一键切换 |
| 提示词库 | 多组提示词，popup / 浮层 / 官网输入框旁 Q 按钮均可调用 |
| 搜索历史 | 可选保存，便于复盘与再次打开 |
| 右键 / 划词 | 选中文本后右键菜单或气泡搜索（可配置） |
| AI 一键总结 | 对比页汇总多模型回答，需自备 API Key（可选） |
| 导出 | 将对比结果导出为 Markdown 等格式 |
| 配置导入导出 | 搜索组、自定义站、快捷站点、右键提示词等可备份为 JSON |
| 暗色模式 | popup / 设置页 / 对比页统一支持 |

### 安装与使用

#### 从源码加载（开发者）

```bash
npm install --include=dev
npm run build:store
```

在 `chrome://extensions/` 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 **`dist/`** 目录。

> `dist/` 为构建产物，不在 Git 仓库中；改代码请编辑 `src/` 后重新构建。

### 典型使用流程

1. 点击扩展图标或在网页按 **Ctrl+Q** 输入问题
2. 选择搜索组，进入 **Compare 对比页**
3. 各站点卡片加载完成后点击发送，查看并排结果
4. 可选：导出、AI 总结、切换布局或追加站点

### 开发与调试

| 命令 | 说明 |
|------|------|
| `npm run watch:store` | 监听 `src/` 变更并持续构建商店版 |
| `npm run build:store` | 单次构建商店版（无实验模块） |
| `NODE_ENV=production npm run build:store` | 生产构建（压缩） |

**刷新注意**：改 background / popup / settings / compare 页 → 在 `chrome://extensions/` 刷新扩展；改 **content script**（inject / overlay）→ 还需 **关闭并重开** 目标标签页。

### 仓库结构

```text
dysearch/
├── src/                 # 扩展源码（改这里）
│   ├── background/      # Service Worker
│   ├── iframe/          # 对比页 + inject + overlay
│   ├── popup/           # 工具栏弹窗
│   ├── settings/        # 设置页
│   ├── config/          # 站点规则、初始预设、DNR 规则源
│   ├── shared/          # i18n、协议常量、共用工具
│   └── build-stubs/     # 功能关闭时的构建占位（非实验代码）
├── build.mjs            # esbuild 打包
├── PRIVACY.md           # 隐私政策
├── LICENSE
└── README.md
```

### 权限与隐私

- 配置、提示词、历史等保存在 **`chrome.storage.local`**，不上传开发者服务器
- 发送搜索、可选 AI 总结时，数据由浏览器 **直连** 你选择的第三方站点或 AI API
- 详见 [`PRIVACY.md`](PRIVACY.md)

### 技术栈

- Manifest V3 · Vanilla JavaScript · esbuild
- Declarative Net Request（iframe 嵌入兼容）
- Shadow DOM（悬浮层样式隔离）

### 开源协议

本项目采用 [GPL-3.0](LICENSE)。

---

<a id="readme-en"></a>

## English

<p align="center">
  Ask once, compare answers from multiple AI / search sites side by side.<br>
  Ctrl+Q overlay, groups, prompts, custom sites, export, and optional AI summary.
</p>

### Overview

**Dysearch** is a **Chrome / Edge Manifest V3** extension for multi-AI comparison workflows:

- Cut down tab-switching between ChatGPT, DeepSeek, Kimi, Gemini, and more
- View answers to the same prompt in one compare page
- Groups, prompts, history, and layout are configurable — **data stays on your device**

> This public repo is the **v1.1.5 store core** source (`npm run build:store`). Experimental modules are not included.

### Features

| Feature | Description |
|---------|-------------|
| Multi-site search | Send one query to many AI / search sites at once |
| Compare page | Side-by-side cards, global layout, card navigation |
| Ctrl+Q overlay | Quick search, history, and prompts on any page |
| Groups & sites | Built-in AI sites + custom URL templates |
| Prompt library | Prompt groups usable from popup, overlay, and on-site launcher |
| Search history | Optional local history for review |
| Context / selection | Right-click or optional selection bubble search |
| AI summary | Optional compare-page summary with your own API key |
| Export | Export comparison results (e.g. Markdown) |
| Config backup | Import/export JSON for groups, sites, prompts, etc. |
| Dark mode | Popup, settings, and compare page |

### Install

#### Load from source (developers)

```bash
npm install --include=dev
npm run build:store
```

Open `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select the **`dist/`** folder.

> `dist/` is generated locally and not committed. Edit `src/`, then rebuild.

### Typical flow

1. Open the popup or press **Ctrl+Q** and type a question
2. Pick a search group → **Compare page** opens
3. Send to loaded site cards and read answers side by side
4. Optionally export, run AI summary, or change layout

### Development

| Command | Description |
|---------|-------------|
| `npm run watch:store` | Watch `src/` and rebuild store package |
| `npm run build:store` | One-shot store build |
| `NODE_ENV=production npm run build:store` | Production build (minified) |

After changing **content scripts** (inject / overlay), reload the extension **and** close/reopen target tabs.

### Repository layout

```text
dysearch/
├── src/                 # Extension source
├── build.mjs            # esbuild entry
├── PRIVACY.md
├── LICENSE
└── README.md
```

### Privacy

- Settings, prompts, and history are stored in **`chrome.storage.local`** only
- Queries and optional AI summary requests go **directly** from your browser to sites/APIs you choose — not to the developer's servers
- See [`PRIVACY.md`](PRIVACY.md)

### Tech stack

Manifest V3 · Vanilla JS · esbuild · DNR · Shadow DOM

### License

[GPL-3.0](LICENSE)
