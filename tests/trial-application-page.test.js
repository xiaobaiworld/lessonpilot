// 定位: 验证独立本地试用申请页面的入口、字段和成功态挂载点。
// 入口参数: v1/site/trial-application.html 的静态 HTML 内容。
// 返回参数: Node test 通过/失败结果。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const salesPage = fs.readFileSync('v1/site/index.html', 'utf8');
const applicationPage = fs.readFileSync('v1/site/trial-application.html', 'utf8');

test('销售页只提供独立试用申请入口，不嵌入表单', () => {
  assert.match(salesPage, /href="\/trial-application\.html"/);
  assert.doesNotMatch(salesPage, /data-trial-intake-form/);
  assert.doesNotMatch(salesPage, /trial-intake\.js\?v=/);
});

test('独立申请页包含完整字段、返回入口和本地提交模块', () => {
  assert.match(applicationPage, /<title>课程留言/);
  assert.match(applicationPage, /href="\/"[^>]*aria-label="返回 KnownMap 销售页"/);
  assert.match(applicationPage, /data-trial-intake-form/);
  for (const field of [
    'name',
    'contact',
    'courseCategory',
    'videoStatus',
    'bilibiliUrl',
    'subtitleStatus',
    'teachingProblem',
    'validationQuestion'
  ]) {
    assert.match(applicationPage, new RegExp(`name="${field}"`), `缺少字段 ${field}`);
  }
  assert.match(applicationPage, /trial-intake\.js\?v=/);
  assert.match(applicationPage, /留言板/);
  assert.match(applicationPage, /提交留言/);
  assert.match(applicationPage, /谢谢你的留言/);
  assert.match(applicationPage, /class="thanks-icon"/);
  assert.doesNotMatch(applicationPage, /<p class="trial-intake-intro"|data-trial-intake-note|提交后我会看到你的留言/);
  assert.match(applicationPage, /<select name="videoStatus" required><option selected>已有 B 站课程<\/option>/);
  assert.match(applicationPage, /<select name="subtitleStatus" required><option selected>还没确定<\/option>/);
  assert.match(applicationPage, /<img class="brand-mark" src="assets\/knownmap-icon\.png" alt="">/);
  assert.doesNotMatch(applicationPage, /name="bilibiliUrl"[^>]*required/);
  assert.doesNotMatch(applicationPage, /无需登录|当前不会自动创建账号|没有自动创建账号/);
  assert.match(applicationPage, /data-trial-intake-success[^>]*hidden/);
  assert.ok(!applicationPage.includes('my.feishu.cn'));
});
