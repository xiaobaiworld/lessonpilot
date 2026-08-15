/**
 * COURSE-06 字幕上下文列的选段逻辑。
 * 运行：node --test tests/subtitle-context.test.js
 *
 * 这里只测纯函数：给定字幕数组和一个时间点，返回要显示哪几条、哪条是中心、
 * 各占几行。渲染、底色和 DOM 属于页面层，不在本文件范围。
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  selectSubtitleContext,
  estimateDisplayWidth,
  estimateLineCount,
  DEFAULT_CONTEXT_OPTIONS
} = require('../teacher-web/subtitle-context.js');

/** 造一条字幕。text 默认足够长，占满 maxLinesPerCaption 行。 */
function cue(index, startSeconds, endSeconds, text) {
  return {
    id: `caption-${index}`,
    startSeconds,
    endSeconds,
    text: text === undefined ? '長'.repeat(60) : text
  };
}

/** 每条都是长句（2 行），时间连续不重叠。 */
function longCues(count) {
  return Array.from({ length: count }, (_, i) => cue(i + 1, i * 10, i * 10 + 9));
}

/** 每条都是短句（1 行）。 */
function shortCues(count) {
  return Array.from({ length: count }, (_, i) => cue(i + 1, i * 10, i * 10 + 9, '短'));
}

const ids = (result) => result.items.map((item) => item.caption.id);
const centerId = (result) => (result.items.find((item) => item.isCenter) || {}).caption.id;

test('时间落在某条字幕区间内时该条为中心', () => {
  const captions = longCues(12);
  // caption-6 覆盖 50-59 秒
  const result = selectSubtitleContext({ captions, timeSeconds: 55 });
  assert.equal(centerId(result), 'caption-6');
  assert.equal(result.centerIndex, 5);
});

test('区间边界（等于 start 或等于 end）算命中', () => {
  const captions = longCues(12);
  assert.equal(centerId(selectSubtitleContext({ captions, timeSeconds: 50 })), 'caption-6');
  assert.equal(centerId(selectSubtitleContext({ captions, timeSeconds: 59 })), 'caption-6');
});

test('没有命中时取与 startSeconds 差值最小的一条', () => {
  const captions = [cue(1, 0, 5), cue(2, 100, 105), cue(3, 200, 205)];
  // 96 距 caption-2 的 start 差 4，距 caption-1 的 start 差 96
  assert.equal(centerId(selectSubtitleContext({ captions, timeSeconds: 96 })), 'caption-2');
});

test('差值相等时取更早的一条，结果不依赖数组顺序偶然性', () => {
  // 50 距 caption-1.start(40) 与 caption-2.start(60) 均为 10
  const captions = [cue(1, 40, 45), cue(2, 60, 65)];
  const result = selectSubtitleContext({ captions, timeSeconds: 50 });
  assert.equal(centerId(result), 'caption-1');
  // 反序输入必须得到同一条，否则"最接近"就成了依赖输入顺序的偶然结果
  const reversed = selectSubtitleContext({ captions: [cue(2, 60, 65), cue(1, 40, 45)], timeSeconds: 50 });
  assert.equal(centerId(reversed), 'caption-1');
});

test('中心句上方固定 2 条，不因补行而增加', () => {
  const captions = shortCues(20);
  const result = selectSubtitleContext({ captions, timeSeconds: 105 });
  const center = result.items.findIndex((item) => item.isCenter);
  assert.equal(center, 2, '短句需要补行，但上方仍然只有 2 条');
  assert.ok(result.totalLines >= DEFAULT_CONTEXT_OPTIONS.minTotalLines);
});

test('长句行数已够，但条数下限仍然要补到 7 条', () => {
  const captions = longCues(20);
  const result = selectSubtitleContext({ captions, timeSeconds: 105 });
  // 每条估算 2 行，5 条就够 7 行；但估算依赖栏宽，窄屏下这些句子可能只占 1 行，
  // 那时 5 条就只有 5 行。条数下限与栏宽无关，所以按 7 条补。
  assert.equal(result.items.length, 7);
  assert.equal(result.totalLines, 14);
  assert.deepEqual(ids(result), [
    'caption-9', 'caption-10', 'caption-11', 'caption-12',
    'caption-13', 'caption-14', 'caption-15'
  ]);
});

test('短句不足 7 行时只向后补足', () => {
  const captions = shortCues(20);
  const result = selectSubtitleContext({ captions, timeSeconds: 105 });
  // 中心是 caption-11，上方固定 caption-9/10，向后补到 7 行 => 共 7 条
  assert.equal(result.totalLines, 7);
  assert.deepEqual(ids(result), [
    'caption-9', 'caption-10', 'caption-11',
    'caption-12', 'caption-13', 'caption-14', 'caption-15'
  ]);
});

test('后方字幕耗尽仍不足 7 行时返回现有条数，不向前扩展、不补空行', () => {
  const captions = shortCues(8);
  // 中心是最后一条 caption-8，上方固定 2 条，后方没有可补的了
  const result = selectSubtitleContext({ captions, timeSeconds: 72 });
  assert.equal(centerId(result), 'caption-8');
  assert.deepEqual(ids(result), ['caption-6', 'caption-7', 'caption-8']);
  assert.equal(result.totalLines, 3, '接受少于 7 行');
  assert.equal(result.belowExhausted, true);
  assert.ok(result.items.every((item) => item.caption.text), '不得插入空行占位');
});

test('中心是第一条时上方 0 条，是最后一条时下方 0 条，均不报错', () => {
  const captions = longCues(12);
  const first = selectSubtitleContext({ captions, timeSeconds: 0 });
  assert.equal(centerId(first), 'caption-1');
  assert.equal(first.items.findIndex((item) => item.isCenter), 0);

  const last = selectSubtitleContext({ captions, timeSeconds: 115 });
  assert.equal(centerId(last), 'caption-12');
  assert.equal(last.items.at(-1).caption.id, 'caption-12');
});

test('字幕总数不足 5 条时全部返回', () => {
  const captions = longCues(4);
  const result = selectSubtitleContext({ captions, timeSeconds: 5 });
  assert.deepEqual(ids(result), ['caption-1', 'caption-2', 'caption-3', 'caption-4']);
  assert.equal(centerId(result), 'caption-1');
  assert.equal(result.wholeList, true);
});

test('空字幕数组返回空结果，由页面显示空状态', () => {
  const result = selectSubtitleContext({ captions: [], timeSeconds: 60 });
  assert.deepEqual(result.items, []);
  assert.equal(result.centerIndex, -1);
  assert.equal(result.totalLines, 0);
  assert.equal(result.empty, true);
});

test('没有选中节点（时间为 null）时从字幕开头显示，不显示任意位置', () => {
  const captions = longCues(20);
  for (const timeSeconds of [null, undefined, NaN, 'abc']) {
    const result = selectSubtitleContext({ captions, timeSeconds });
    assert.equal(centerId(result), 'caption-1', `timeSeconds=${String(timeSeconds)}`);
    assert.equal(result.items.findIndex((item) => item.isCenter), 0);
  }
});

test('负时间与超出片尾的时间都夹到两端，不返回空', () => {
  const captions = longCues(12);
  assert.equal(centerId(selectSubtitleContext({ captions, timeSeconds: -30 })), 'caption-1');
  assert.equal(centerId(selectSubtitleContext({ captions, timeSeconds: 99999 })), 'caption-12');
});

/*
 * 行数估算。"至少 7 行"要可验证，就必须把估算函数的输入输出固定下来，
 * 否则它会退化成无法检验的口头约束。估算规则与 CSS 的
 * -webkit-line-clamp / --subtitle-context-columns 必须对应，
 * 由下面的 css-contract 测试锁定。
 */

test('宽度估算：CJK 记 2、ASCII 记 1、其它记 1', () => {
  assert.equal(estimateDisplayWidth('中文'), 4);
  assert.equal(estimateDisplayWidth('abcd'), 4);
  assert.equal(estimateDisplayWidth('中a'), 3);
  assert.equal(estimateDisplayWidth('，。'), 4, '全角标点同样占两格');
  assert.equal(estimateDisplayWidth(''), 0);
  assert.equal(estimateDisplayWidth(null), 0);
});

test('行数估算：按每行宽度向上取整，并被 maxLinesPerCaption 截断', () => {
  const columns = DEFAULT_CONTEXT_OPTIONS.columnsPerLine;
  assert.equal(estimateLineCount('短', DEFAULT_CONTEXT_OPTIONS), 1);
  assert.equal(estimateLineCount('a'.repeat(columns), DEFAULT_CONTEXT_OPTIONS), 1, '正好一行不进位');
  assert.equal(estimateLineCount('a'.repeat(columns + 1), DEFAULT_CONTEXT_OPTIONS), 2);
  assert.equal(
    estimateLineCount('a'.repeat(columns * 9), DEFAULT_CONTEXT_OPTIONS),
    DEFAULT_CONTEXT_OPTIONS.maxLinesPerCaption,
    '超长句被截断为 maxLinesPerCaption 行，与 CSS line-clamp 一致'
  );
});

test('空文本仍算 1 行，避免 0 行让补足逻辑无限循环', () => {
  assert.equal(estimateLineCount('', DEFAULT_CONTEXT_OPTIONS), 1);
  assert.equal(estimateLineCount(null, DEFAULT_CONTEXT_OPTIONS), 1);
});

test('items 的 lines 与 totalLines 一致，页面可直接据此渲染', () => {
  const captions = [cue(1, 0, 5, '短'), cue(2, 10, 15, '長'.repeat(60)), cue(3, 20, 25, '短')];
  const result = selectSubtitleContext({ captions, timeSeconds: 12 });
  const sum = result.items.reduce((total, item) => total + item.lines, 0);
  assert.equal(result.totalLines, sum);
  const long = result.items.find((item) => item.caption.id === 'caption-2');
  assert.equal(long.lines, DEFAULT_CONTEXT_OPTIONS.maxLinesPerCaption);
  assert.equal(long.truncated, true, '被截断的条目要告诉页面，用于加省略提示');
});

test('自定义 options 生效，且不修改传入的 captions 数组', () => {
  const captions = shortCues(20);
  const frozen = captions.slice();
  const result = selectSubtitleContext({
    captions,
    timeSeconds: 105,
    options: { above: 1, initialBelow: 1, minTotalLines: 4, minRows: 3 }
  });
  const center = result.items.findIndex((item) => item.isCenter);
  assert.equal(center, 1, '上方 1 条');
  assert.equal(result.totalLines, 4);
  assert.deepEqual(captions, frozen, '选段函数不得原地改动输入');
});

test('items 引用原字幕对象，不复制文本，避免页面拿到过期副本', () => {
  const captions = longCues(6);
  const result = selectSubtitleContext({ captions, timeSeconds: 25 });
  assert.equal(result.items[0].caption, captions[result.items[0].index]);
});

/**
 * 视口不变量（COURSE-06）：
 * 行数估算依赖栏宽，栏宽随视口变化，所以"估算 7 行"在窄屏栈式布局下会退化成 6 行实测。
 * 行数无法靠常量保证，但行数下限可以：每条字幕至少渲染 1 行，
 * 所以补齐到至少 7 条，就在任何视口下都至少 7 行。
 */
test('补齐到至少 7 条字幕，使"至少 7 行"与视口无关', () => {
  const captions = Array.from({ length: 40 }, (_, i) => ({
    start: i * 3, end: i * 3 + 2, text: '短'
  }));
  const r = selectSubtitleContext({ captions, timeSeconds: 60 });
  assert.ok(r.items.length >= 7, `全短句时也要补到 7 条，实际 ${r.items.length} 条`);
  assert.ok(r.totalLines >= 7);
});

test('长句已满 7 行时也仍然补齐到 7 条', () => {
  const long = '一'.repeat(200);
  const captions = Array.from({ length: 40 }, (_, i) => ({
    start: i * 3, end: i * 3 + 2, text: long
  }));
  const r = selectSubtitleContext({ captions, timeSeconds: 60 });
  assert.ok(r.items.length >= 7, `实际 ${r.items.length} 条`);
});

test('字幕总数不足 7 条时给出全部，不虚构', () => {
  const captions = [
    { start: 0, end: 2, text: 'a' }, { start: 3, end: 5, text: 'b' },
    { start: 6, end: 8, text: 'c' }
  ];
  const r = selectSubtitleContext({ captions, timeSeconds: 4 });
  assert.equal(r.items.length, 3);
  assert.equal(r.belowExhausted, true);
});
