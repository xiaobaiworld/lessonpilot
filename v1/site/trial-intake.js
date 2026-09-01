// 定位: 挂载独立的 KnownMap 本地留言表单并提交到本地 API。
// 入口参数: 页面 document，或测试传入的 root 与 fetch 实现。
// 返回参数: 导出配置、B 站链接校验器、提交函数和挂载函数。
/**
 * KnownMap 真实课程留言入口。
 *
 * 表单字段、提交状态和服务端入口集中在这里，页面只提供结构与品牌文案。
 * 成功状态只有在服务端确认保存后才显示。
 */
(function initTrialIntake(global, factory) {
  const api = factory(global);
  global.KnownMapTrialIntake = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global.document) {
    api.mountTrialIntake(global.document);
  }
})(typeof window !== 'undefined' ? window : globalThis, function createTrialIntake(global) {
  const TRIAL_INTAKE = Object.freeze({
    endpoint: '/api/v1/public/trial-applications',
    buttonLabel: '提交留言'
  });

  function isBilibiliUrl(value) {
    if (!value) return true;
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
      const allowedHost = hostname === 'bilibili.com'
        || hostname.endsWith('.bilibili.com')
        || hostname === 'b23.tv'
        || hostname.endsWith('.b23.tv');
      return url.protocol === 'https:' && url.pathname !== '/' && allowedHost;
    } catch (error) {
      return false;
    }
  }

  function resolveEndpoint(config) {
    const endpoint = config && config.endpoint ? config.endpoint : TRIAL_INTAKE.endpoint;
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    if (global.location && (global.location.protocol === 'file:'
      || /^(localhost|127\.0\.0\.1)$/.test(global.location.hostname))) {
      return `http://localhost:8000${endpoint}`;
    }
    return endpoint;
  }

  function formPayload(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function submitTrialApplication(form, config = TRIAL_INTAKE, fetchImpl = global.fetch) {
    const fetcher = fetchImpl || global.fetch;
    if (typeof fetcher !== 'function') throw new Error('当前环境无法提交申请');

    const payload = formPayload(form);
    if (payload.bilibiliUrl && !isBilibiliUrl(payload.bilibiliUrl)) {
      const error = new Error('请输入有效的 B 站网页链接或 b23.tv 短链接');
      error.code = 'BILIBILI_URL_INVALID';
      throw error;
    }

    const response = await fetcher(resolveEndpoint(config), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body?.error?.message || '申请提交失败，请稍后再试');
      error.code = body?.error?.code;
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function setStatus(element, text, kind) {
    if (!element) return;
    element.hidden = !text;
    element.textContent = text || '';
    element.dataset.state = kind || '';
  }

  function mountTrialIntake(root, config = TRIAL_INTAKE) {
    const container = root && root.querySelector
      ? root.querySelector('[data-trial-intake]')
      : null;
    if (!container) return false;

    const form = container.querySelector('[data-trial-intake-form]');
    const submit = container.querySelector('[data-trial-intake-submit]');
    const status = container.querySelector('[data-trial-intake-status]');
    const success = container.querySelector('[data-trial-intake-success]');
    if (!form || !submit || !status || !success) return false;

    container.hidden = false;
    submit.textContent = config.buttonLabel;
    success.hidden = true;
    setStatus(status, '', '');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const payload = formPayload(form);
      if (payload.bilibiliUrl && !isBilibiliUrl(payload.bilibiliUrl)) {
        setStatus(status, 'B 站链接格式不正确，请检查后再提交。', 'error');
        return;
      }

      submit.disabled = true;
      setStatus(status, '正在提交，请稍候…', 'busy');
      try {
        await submitTrialApplication(form, config);
        form.hidden = true;
        setStatus(status, '', '');
        success.hidden = false;
      } catch (error) {
        const message = error && error.message
          ? error.message
          : '申请提交失败，请稍后再试。';
        setStatus(status, message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
    return true;
  }

  return {
    TRIAL_INTAKE,
    isBilibiliUrl,
    resolveEndpoint,
    formPayload,
    submitTrialApplication,
    mountTrialIntake
  };
});
