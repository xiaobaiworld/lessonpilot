// 定位: 验证链接导航的必需入口、权限提示与外链安全属性。
// 入口参数: v1/site/link.html 的静态 HTML 内容。
// 返回参数: Node test 通过/失败结果。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync('v1/site/link.html', 'utf8');

const requiredLinks = [
  'https://knownmap.com/',
  'https://knownmap.com/admin/',
  'https://knownmap.com/teacher/',
  'https://knownmap.com/student-guide.html',
  'https://knownmap.com/downloads/student-plugin/knownmap-v1.zip',
  'https://my.feishu.cn/share/base/form/shrcnGpoiVzLw8v5sD5K2TV8sFb',
  'https://my.feishu.cn/base/ZI5vbke3Ia9dpPsL4khcko09nwf?table=tblGmuYqdNDy7rSZ&amp;view=vewNhBX7cO'
];

test('链接导航包含本站、飞书填写和结果查看入口', () => {
  for (const link of requiredLinks) {
    assert.match(page, new RegExp(`href="${link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }
  assert.match(page, /<strong>学生使用步骤<\/strong>/);
});

test('链接导航禁止搜索引擎收录并标明结果页权限', () => {
  assert.match(page, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(page, /访问说明/);
  assert.match(page, /外部填写表单可公开分享/);
  assert.match(page, /查看收集结果/);
  assert.match(page, /结果页和设置页仍需获授权的飞书账号登录/);
});

test('所有新窗口链接都有安全的 rel 属性', () => {
  const anchors = [...page.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
  assert.ok(anchors.length > 0);
  for (const anchor of anchors) {
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);
  }
});

test('链接导航已进入 v1 生产发布白名单和探针', () => {
  const releaseScript = fs.readFileSync('tools/web-release.sh', 'utf8');
  assert.match(releaseScript, /public\/link\.html/);
  assert.match(releaseScript, /source_dir\/v1\/site\/link\.html/);
  assert.match(releaseScript, /\/link\.html/);
});
