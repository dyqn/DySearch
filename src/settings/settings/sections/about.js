import { state, msg } from "../state.js";

export function renderAboutSection() {
  const { aboutSection } = state.dom;
  aboutSection.innerHTML = "";

  const privacyCard = document.createElement("section");
  privacyCard.className = "other-settings-card about-plugin-card";
  privacyCard.innerHTML = `
    <div class="other-settings-intro about-plugin-intro">
      <strong>${msg("settings_about_privacyTitle", "隐私与数据说明")}</strong>
    </div>
    <div class="about-plugin-privacy" role="note">
      <p><strong>${msg("settings_about_openSourceLabel", "开源且免费：")}</strong>${msg("settings_about_openSourceBody", "多元搜索是一个开源且免费插件，不会进行任何后端服务器运行。欢迎审查与贡献。")}</p>
      <p><strong>${msg("settings_about_zeroDataLabel", "零数据收集：")}</strong>${msg("settings_about_zeroDataBody", "多元搜索不会将您的搜索关键词、浏览记录或页面内容上传到开发者服务器。用于功能的配置数据仅保存在本地。")}</p>
      <p><strong>${msg("settings_about_transparencyLabel", "交互透明性：")}</strong>${msg("settings_about_transparencyBody", "插件通过 iframe 或\u201c新标签页模式\u201d打开目标网站，您与网站的登录与交互均直接发生在浏览器与目标网站之间。")}</p>
    </div>
  `;
  aboutSection.appendChild(privacyCard);

  const actions = document.createElement("div");
  actions.className = "about-plugin-actions";
  actions.innerHTML = `
    <a class="about-plugin-action-btn" href="https://ss.dyqn.com" target="_blank" rel="noopener noreferrer">${msg("settings_about_site", "插件官网")}</a>
    <a class="about-plugin-action-btn" href="https://github.com/dyqn/DySearch" target="_blank" rel="noopener noreferrer">${msg("settings_about_source", "开源地址")}</a>
    <div class="about-plugin-action-btn about-plugin-wechat-host" tabindex="0" aria-label="${msg("settings_about_wechat", "作者公众号")}">
      <span>${msg("settings_about_wechat", "作者公众号")}</span>
      <img class="about-plugin-wechat-card" src="wxgzh.png" alt="${msg("settings_about_wechat", "作者公众号")}" width="460" height="168" />
    </div>
  `;
  privacyCard.appendChild(actions);
}
