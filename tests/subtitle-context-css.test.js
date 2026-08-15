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
/* 销售页是自包含单文件：样式、结构和脚本都在 forsales.html 内。 */
const page = fs.readFileSync('teacher-web/forsales.html', 'utf8');
const css = page;
const html = page;
const js = page;

test('CSS 的 --subtitle-columns 等于 JS 的 columnsPerLine', () => {
  const match = css.match(/--subtitle-columns:\s*(\d+)/);
  assert.ok(match, 'forsales.html 必须声明 --subtitle-columns');
  assert.equal(Number(match[1]), DEFAULT_CONTEXT_OPTIONS.columnsPerLine);
});

test('CSS 的 -webkit-line-clamp 等于 JS 的 maxLinesPerCaption', () => {
  const match = css.match(/-webkit-line-clamp:\s*(\d+)/);
  assert.ok(match, '字幕条目必须用 line-clamp 限制行数');
  assert.equal(Number(match[1]), DEFAULT_CONTEXT_OPTIONS.maxLinesPerCaption);
});

test('中心句有明显底色，不是只靠字重或边框', () => {
  const block = css.match(/\.subtitle-item\.is-center\s*\{([^}]*)\}/);
  assert.ok(block, '必须存在 .subtitle-item.is-center 规则');
  assert.match(block[1], /background:/, 'COURSE-06 明确要求底色区分');
});

test('销售页含字幕上下文列，且不再有常驻节点属性表单', () => {
  assert.match(html, /id="subtitle-list"/);
  assert.match(html, /id="subtitle-empty"/);
  assert.ok(!html.includes('class="inspector"'), '常驻 inspector 表单已改为弹出式（COURSE-07）');
  assert.ok(!html.includes('inspector-head'), '右侧区域已由字幕上下文列取代');
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
  assert.match(html, /class="marker[^"]*" tabindex="0" role="button"/);
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
  assert.match(demo, /示例课程数据/);
  assert.match(demo, /真实工作台的字幕来自老师本地导入/);
});

test('销售页外部脚本入口带版本参数（页面本体自包含样式与脚本）', () => {
  assert.ok(!html.includes('sample.css'), '销售页是自包含单文件，不引外部样式');
  assert.match(html, /src="subtitle-context\.js\?v=[^"]+"/);
  assert.match(html, /src="demo-captions\.js\?v=[^"]+"/);
});

test('销售页不残留已删除的 inspector 选择器', () => {
  assert.ok(!css.includes('.inspector'), '孤立 CSS 会让后来者以为该结构还在');
  assert.ok(!css.includes('.inspector-head'));
  for (const orphan of ['.field{', '.rubric{', '.save{', '.autosave{', '.control{']) {
    assert.ok(!css.includes(orphan), `${orphan} 已无对应结构，必须一并删除`);
  }
});

/**
 * "至少 7 行"的保证由条数下限承担，不由栏宽常量承担。
 * 若有人把 minRows 去掉、只留 minTotalLines，窄屏会退回 6 行。
 */
test('minRows 是"至少 7 行"的视口无关保证，必须存在且不小于 7', () => {
  assert.equal(DEFAULT_CONTEXT_OPTIONS.minRows, 7);
  assert.ok(
    DEFAULT_CONTEXT_OPTIONS.minRows >= DEFAULT_CONTEXT_OPTIONS.above + 1,
    'minRows 至少要容纳上方条数加中心条'
  );
});

test('浏览器实测页面在库内，行数保证可被复核', () => {
  const probe = fs.readFileSync('tests/manual/subtitle-rail-lines.html', 'utf8');
  assert.match(probe, /forsales\.html/);
  assert.match(probe, /getBoundingClientRect/, '必须量实际渲染高度，而不是断言字符串');
  for (const w of ['1440', '900', '600']) {
    assert.ok(probe.includes(w), `要覆盖 ${w}px 视口`);
  }
});
