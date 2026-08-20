// 定位: 工具栏 popup 清单接线、学生入口、当前课程和教师入口的静态契约测试。
// 入口参数: src/manifest.json 与 src/popup/ 下的页面和脚本源码。
// 返回参数: Node test 断言结果，确保扩展左键首页包含全部当前入口。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('manifest exposes a toolbar popup with student and teacher entry points', () => {
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'));
  const html = fs.readFileSync('src/popup/popup.html', 'utf8');
  const script = fs.readFileSync('src/popup/popup.js', 'utf8');

  assert.equal(manifest.action.default_popup, 'popup/popup.html');
  assert.match(html, /使用授权码，无需注册/);
  assert.match(html, /课程授权码/);
  assert.match(html, /我的课程/);
  assert.match(html, /教师登录/);
  assert.match(script, /GET_INSTALLED_STUDENT_COURSE/);
  assert.match(script, /DOWNLOAD_STUDENT_COURSE/);
  assert.match(script, /buildCourseRecord/);
  assert.match(html, /teacher-web\/editor\.html/);
});
