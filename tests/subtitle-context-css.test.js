/**
 * 锁定 COURSE-06 的 JS 估算参数与 CSS 渲染规则一致。
 * 运行：node --test tests/subtitle-context-css.test.js
 *
 * 「总行数至少 7 行」是需求，但它只有在"JS 认为一条占几行"和
 * "CSS 实际让一条占几行"一致时才成立。两者一旦脱节，测试仍然全绿而页面已经不满足需求。
 * 因此这里把两处数字直接对齐，让脱节变成测试失败而不是无声的行为偏差。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { DEFAULT_CONTEXT_OPTIONS } = require('../teacher-web/subtitle-context.js');
const css = fs.readFileSync('teacher-web/sample.css', 'utf8');
const html = fs.readFileSync('teacher-web/index.html', 'utf8');
const js = fs.readFileSync('teacher-web/sample.js', 'utf8');

test('CSS 的 --subtitle-context-columns 等于 JS 的 columnsPerLine', () => {
  const match = css.match(/--subtitle-context-columns:\s*(\d+)/);
  assert.ok(match, 'sample.css 必须声明 --subtitle-context-columns');
  assert.equal(Number(match[1]), DEFAULT_CONTEXT_OPTIONS.columnsPerLine);
});

test('CSS 的 -webkit-line-clamp 等于 JS 的 maxLinesPerCaption', () => {
  const match = css.match(/-webkit-line-clamp:\s*(\d+)/);
  assert.ok(match, '字幕条目必须用 line-clamp 限制行数');
  assert.equal(Number(match[1]), DEFAULT_CONTEXT_OPTIONS.maxLinesPerCaption);
});

test('中心句有明显底色，不是只靠字重或边框', () => {
  const block = css.match(/\.sample-subtitle-item\.is-center\s*\{([^}]*)\}/);
  assert.ok(block, '必须存在 .sample-subtitle-item.is-center 规则');
  assert.match(block[1], /background:/, 'COURSE-06 明确要求底色区分');
});

test('销售页含字幕上下文列，且不再有常驻节点属性表单', () => {
  assert.match(html, /id="subtitle-context-list"/);
  assert.match(html, /id="subtitle-context-empty"/);
  assert.ok(!html.includes('id="add-node-panel"'), '常驻表单已改为弹出式（COURSE-07）');
  assert.ok(!html.includes('sample-add-rail'), '右侧区域已由字幕上下文列取代');
});

test('属性表单是弹出式，且右键与双击都能打开', () => {
  assert.match(html, /<dialog[^>]*id="node-form-dialog"/);
  assert.match(js, /addEventListener\('contextmenu'/);
  assert.match(js, /addEventListener\('dblclick'/);
  assert.match(js, /preventDefault\(\)/, 'contextmenu 必须抑制浏览器菜单');
});

test('提供键盘可达的等价入口，右键与双击不是唯一操作方式', () => {
  assert.match(js, /addEventListener\('keydown'/);
  assert.match(js, /event\.key === 'Enter'/);
  // 节点本身是 button，天然可聚焦；这里确认没有被改成不可聚焦的元素。
  assert.match(html, /<button class="sample-mark/);
});

test('关闭表单前不静默丢弃未保存修改', () => {
  assert.match(js, /confirm\(/);
  assert.match(js, /snapshot/);
});

test('字幕文本用 textContent 渲染，不拼接 HTML', () => {
  const stripped = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!stripped.includes('innerHTML'), '字幕是不可信输入，禁止 innerHTML');
  assert.match(stripped, /text\.textContent = item\.caption\.text/);
});

test('演示字幕是示例数据，不冒充老师真实课程', () => {
  const demo = fs.readFileSync('teacher-web/demo-captions.js', 'utf8');
  assert.match(demo, /演示数据/);
  assert.match(demo, /真实工作台的字幕来自本地导入/);
});

test('销售页仍然只有一份样式与脚本入口，且带版本参数', () => {
  assert.match(html, /<link rel="stylesheet" href="sample\.css\?v=[^"]+">/);
  assert.match(html, /src="sample\.js\?v=[^"]+"/);
  assert.match(html, /src="subtitle-context\.js\?v=[^"]+"/);
  assert.match(html, /src="demo-captions\.js\?v=[^"]+"/);
});

test('sample.css 不残留已删除的 add-rail/add-panel 选择器', () => {
  assert.ok(!css.includes('.sample-add-rail'), '孤立 CSS 会让后来者以为该结构还在');
  assert.ok(!css.includes('.sample-add-panel'));
  assert.ok(!css.includes('.sample-add-fields'));
});
