// 定位: 验证飞书试用入口模块的域名白名单、挂载和失败关闭行为。
// 入口参数: v1/site/trial-intake.js 导出的配置与函数。
// 返回参数: Node test 通过/失败结果。
/**
 * 飞书试用申请入口模块测试（WEB-05、D-012、D-013）。
 * 运行：node --test tests/trial-intake.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TRIAL_INTAKE,
  isAllowedFormUrl,
  mountTrialIntake
} = require('../v1/site/trial-intake.js');

function createRoot() {
  const link = {
    href: '',
    target: '',
    rel: '',
    textContent: '',
    removeAttribute(name) {
      if (name === 'href') this.href = '';
    }
  };
  const note = { textContent: '' };
  const container = {
    hidden: true,
    querySelector(selector) {
      if (selector === '[data-trial-intake-link]') return link;
      if (selector === '[data-trial-intake-note]') return note;
      return null;
    }
  };
  return {
    link,
    note,
    container,
    root: {
      querySelector(selector) {
        return selector === '[data-trial-intake]' ? container : null;
      }
    }
  };
}

test('只接受 HTTPS 飞书或 Lark 官方域名', () => {
  assert.equal(isAllowedFormUrl('https://example.feishu.cn/share/base/form/abc'), true);
  assert.equal(isAllowedFormUrl('https://example.larksuite.com/share/base/form/abc'), true);
  assert.equal(isAllowedFormUrl('https://my.feishu.cn/base/internal-editor'), false);
  assert.equal(isAllowedFormUrl('http://example.feishu.cn/share/base/form/abc'), false);
  assert.equal(isAllowedFormUrl('https://feishu.cn.example.com/form'), false);
  assert.equal(isAllowedFormUrl('https://example.com/form'), false);
  assert.equal(isAllowedFormUrl(''), false);
});

test('合法配置会显示入口并固定新窗口安全属性', () => {
  const fixture = createRoot();
  const config = {
    url: 'https://example.feishu.cn/share/base/form/abc',
    buttonLabel: '填写试用信息',
    note: '留下课程情况，我会联系你。'
  };

  assert.equal(mountTrialIntake(fixture.root, config), true);
  assert.equal(fixture.container.hidden, false);
  assert.equal(fixture.link.href, config.url);
  assert.equal(fixture.link.target, '_blank');
  assert.equal(fixture.link.rel, 'noopener noreferrer');
  assert.equal(fixture.link.textContent, config.buttonLabel);
  assert.equal(fixture.note.textContent, config.note);
});

test('默认配置挂载已发布的公开表单', () => {
  const fixture = createRoot();

  assert.equal(mountTrialIntake(fixture.root), true);
  assert.equal(fixture.container.hidden, false);
  assert.equal(fixture.link.href, TRIAL_INTAKE.url);
  assert.equal(fixture.link.textContent, '在线填写试用申请');
  assert.equal(fixture.note.textContent, '无需登录飞书 · 提交后由我人工联系。');
});

test('URL 缺失或域名不可信时不显示死链接', () => {
  for (const url of ['', 'https://example.com/form']) {
    const fixture = createRoot();
    fixture.link.href = 'https://stale.invalid/';
    assert.equal(mountTrialIntake(fixture.root, { ...TRIAL_INTAKE, url }), false);
    assert.equal(fixture.container.hidden, true);
    assert.equal(fixture.link.href, '');
  }
});

test('页面没有挂载点时安全退出', () => {
  assert.equal(mountTrialIntake({ querySelector: () => null }), false);
  assert.equal(mountTrialIntake(null), false);
});

test('挂载点缺少链接或说明时保持隐藏', () => {
  for (const missingSelector of ['[data-trial-intake-link]', '[data-trial-intake-note]']) {
    const fixture = createRoot();
    const originalQuery = fixture.container.querySelector.bind(fixture.container);
    fixture.container.querySelector = (selector) => (
      selector === missingSelector ? null : originalQuery(selector)
    );

    assert.equal(mountTrialIntake(fixture.root), false);
    assert.equal(fixture.container.hidden, true);
  }
});
