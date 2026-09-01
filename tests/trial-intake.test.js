// 定位: 验证本地试用申请模块的 B 站链接校验、挂载和提交行为。
// 入口参数: v1/site/trial-intake.js 导出的配置与函数。
// 返回参数: Node test 通过/失败结果。
/**
 * 本地试用申请入口模块测试（FR-INTAKE-002、D-V1-027）。
 * 运行：node --test tests/trial-intake.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TRIAL_INTAKE,
  isBilibiliUrl,
  resolveEndpoint,
  submitTrialApplication,
  mountTrialIntake
} = require('../v1/site/trial-intake.js');

function createRoot() {
  const listeners = {};
  const form = {
    hidden: false,
    addEventListener(name, listener) {
      listeners[name] = listener;
    },
    checkValidity: () => true,
    reportValidity: () => true
  };
  const submit = { disabled: false, textContent: '' };
  const status = { hidden: true, textContent: '', dataset: {} };
  const success = { hidden: true };
  const container = {
    hidden: true,
    querySelector(selector) {
      if (selector === '[data-trial-intake-form]') return form;
      if (selector === '[data-trial-intake-submit]') return submit;
      if (selector === '[data-trial-intake-status]') return status;
      if (selector === '[data-trial-intake-success]') return success;
      return null;
    }
  };
  return {
    form,
    listeners,
    submit,
    status,
    success,
    container,
    root: {
      querySelector(selector) {
        return selector === '[data-trial-intake]' ? container : null;
      }
    }
  };
}

test('B 站链接可选，填写时只接受 B 站网页或 b23.tv', () => {
  assert.equal(isBilibiliUrl(''), true);
  assert.equal(isBilibiliUrl('https://www.bilibili.com/video/BVexample'), true);
  assert.equal(isBilibiliUrl('https://b23.tv/example'), true);
  assert.equal(isBilibiliUrl('http://www.bilibili.com/video/BVexample'), false);
  assert.equal(isBilibiliUrl('https://example.com/video/BVexample'), false);
  assert.equal(isBilibiliUrl('https://bilibili.com'), false);
  assert.equal(isBilibiliUrl('javascript:alert(1)'), false);
});

test('本地表单挂载后显示提交按钮', () => {
  const fixture = createRoot();
  const config = {
    ...TRIAL_INTAKE,
    buttonLabel: '填写试用信息'
  };

  assert.equal(mountTrialIntake(fixture.root, config), true);
  assert.equal(fixture.container.hidden, false);
  assert.equal(fixture.submit.textContent, config.buttonLabel);
  assert.equal(typeof fixture.listeners.submit, 'function');
});

test('默认配置挂载本地公开表单', () => {
  const fixture = createRoot();

  assert.equal(mountTrialIntake(fixture.root), true);
  assert.equal(fixture.container.hidden, false);
  assert.equal(TRIAL_INTAKE.endpoint, '/api/v1/public/trial-applications');
  assert.equal(fixture.submit.textContent, '提交留言');
});

test('默认配置使用相对路径，方便生产同源代理', () => {
  assert.equal(resolveEndpoint(TRIAL_INTAKE), TRIAL_INTAKE.endpoint);
});

test('直接打开 file 页面时连接本地 API', () => {
  const originalLocation = global.location;
  global.location = { protocol: 'file:', hostname: '' };
  try {
    assert.equal(
      resolveEndpoint(TRIAL_INTAKE),
      'http://localhost:8000/api/v1/public/trial-applications'
    );
  } finally {
    if (originalLocation === undefined) delete global.location;
    else global.location = originalLocation;
  }
});

test('页面没有挂载点时安全退出', () => {
  assert.equal(mountTrialIntake({ querySelector: () => null }), false);
  assert.equal(mountTrialIntake(null), false);
});

test('挂载点缺少表单、状态或成功节点时保持隐藏', () => {
  for (const missingSelector of [
    '[data-trial-intake-form]',
    '[data-trial-intake-submit]',
    '[data-trial-intake-status]',
    '[data-trial-intake-success]'
  ]) {
    const fixture = createRoot();
    const originalQuery = fixture.container.querySelector.bind(fixture.container);
    fixture.container.querySelector = (selector) => (
      selector === missingSelector ? null : originalQuery(selector)
    );

    assert.equal(mountTrialIntake(fixture.root), false);
    assert.equal(fixture.container.hidden, true);
  }
});

test('提交只发送表单字段，成功响应原样返回', async () => {
  const originalFormData = global.FormData;
  global.FormData = class {
    entries() {
      return Object.entries({
        name: '测试老师',
        contact: 'contact-example',
        courseCategory: '英语口语',
        videoStatus: '已有 B 站课程',
        bilibiliUrl: 'https://b23.tv/example',
        teachingProblem: '增加练习',
        subtitleStatus: '已有字幕',
        validationQuestion: '',
        website: ''
      })[Symbol.iterator]();
    }
  };
  try {
    let request;
    const result = await submitTrialApplication({}, TRIAL_INTAKE, async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ status: 'accepted' }) };
    });
    assert.deepEqual(result, { status: 'accepted' });
    assert.equal(request.url, TRIAL_INTAKE.endpoint);
    assert.match(request.options.body, /courseCategory/);
    assert.ok(!request.options.body.includes('password'));
  } finally {
    global.FormData = originalFormData;
  }
});
