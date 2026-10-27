## 中文要点（便于快速阅读）

> 以下是英文正文的要点摘要，内容与英文正文一致；若表述有出入，以英文完整条款为准。

- **开发者不收集数据**：没有账号体系、没有自建后端、没有第三方统计 / 广告 / 追踪 SDK，也不会把你的输入内容、浏览记录、账号信息或页面内容发送到开发者控制的服务器。
- **配置只存在你本机**：搜索组、自定义站点、提示词库、搜索历史、快捷入口、界面偏好，以及你填写的 AI 总结 API Key，全部保存在浏览器本地存储（`chrome.storage.local`）中；扩展不提供开发者侧云同步。
- **你主动触发时，数据会直达第三方**：提问时你的搜索词由你的浏览器直接发给你选中的 AI / 网站；开启 AI 总结后，页面提取出的正文会直接发往**你自己配置的** API 服务商。“不上传开发者服务器”不等于“第三方看不到”。
- **内容提取只在你点击导出 / 复制 / 总结时发生**，处理在你的浏览器本地完成，不上传。
- **预热门请求是可选项**，只直连目标站点，可在设置里关闭。
- **为了把站点显示在卡片里**：部分 AI 站点禁止被内嵌，扩展会删除其阻止内嵌的响应头，并在该 iframe 内把 `window.parent`、`window.top`、`document.frameElement` 报成普通页面。它只服务于**你主动打开**的页面，不用于伪装来源、不用于刷量、不用于绕过任何站点的登录 / 付费 / 用量限制。
- **权限最小必要**：`storage`、`tabs`、`windows`、`alarms`、`declarativeNetRequest`、`contextMenus` 与 `host_permissions: <all_urls>`，逐条用途见英文正文第 9 节。
- **更新不会清空你的数据**；卸载扩展时浏览器会移除它的本地存储。
- **不面向 13 岁以下儿童**。
- **联系方式**：邮箱 1@dyqn.com；本政策网页版 [https://dyqn.github.io/DySearch/privacy.html](https://dyqn.github.io/DySearch/privacy.html)；开源地址 [https://github.com/dyqn/DySearch](https://github.com/dyqn/DySearch)。
