// 定位: 挂载销售页的飞书真实课程试用入口并执行链接安全校验。
// 入口参数: 页面 document，或测试传入的 root 与表单配置对象。
// 返回参数: 导出配置、URL 校验器和挂载函数；浏览器中更新入口可见性与链接属性。
/**
 * KnownMap 真实课程试用申请入口。
 *
 * 飞书公开 URL、老师可见文案和挂载规则集中在这里，销售页只保留一个空的挂载点。
 * URL 缺失、格式错误或不是飞书官方域名时，入口保持隐藏，不向老师展示死链接。
 */
(function initTrialIntake(global, factory) {
  const api = factory();
  global.KnownMapTrialIntake = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global.document) {
    api.mountTrialIntake(global.document);
  }
})(typeof window !== 'undefined' ? window : globalThis, function createTrialIntake() {
  const TRIAL_INTAKE = Object.freeze({
    url: 'https://my.feishu.cn/share/base/form/shrcnGpoiVzLw8v5sD5K2TV8sFb',
    buttonLabel: '在线填写试用申请',
    note: '无需登录飞书 · 提交后由我人工联系。'
  });

  function isAllowedFormUrl(value) {
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase();
      const isFeishu = hostname === 'feishu.cn' || hostname.endsWith('.feishu.cn');
      const isLark = hostname === 'larksuite.com' || hostname.endsWith('.larksuite.com');
      const isPublishedForm = url.pathname.startsWith('/share/base/form/');
      return url.protocol === 'https:' && (isFeishu || isLark) && isPublishedForm;
    } catch (error) {
      return false;
    }
  }

  function mountTrialIntake(root, config = TRIAL_INTAKE) {
    const container = root && root.querySelector
      ? root.querySelector('[data-trial-intake]')
      : null;
    if (!container) return false;

    const link = container.querySelector('[data-trial-intake-link]');
    const note = container.querySelector('[data-trial-intake-note]');
    container.hidden = true;

    if (!link || !note || !isAllowedFormUrl(config && config.url)) {
      if (link && link.removeAttribute) link.removeAttribute('href');
      return false;
    }

    link.href = config.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = config.buttonLabel;
    note.textContent = config.note;
    container.hidden = false;
    return true;
  }

  return {
    TRIAL_INTAKE,
    isAllowedFormUrl,
    mountTrialIntake
  };
});
