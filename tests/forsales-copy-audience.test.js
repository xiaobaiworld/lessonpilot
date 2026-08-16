/**
 * 销售页文案受众护栏：forsales.html 是给老师看的，不是给我们自己看的。
 * 运行：node --test tests/forsales-copy-audience.test.js
 *
 * 这个页面反复出现过同一类问题：开发阶段编号、鼠标操作手册、版面说明、
 * 替设计辩解的话，混进了老师能看见的文案里。它们不影响功能，所以功能测试
 * 全绿也发现不了，只能靠文案本身的断言拦住。
 *
 * 检查两处文案，因为老师读到的字不只在标签之间：
 * 1. 静态可见文案——剥掉 style / script / svg / 注释和标签后剩下的部分；
 * 2. 运行时文案——脚本里的中文字面量。toast、confirm 提示这些是点了才出现的，
 *    剥掉 <script> 就看不见，而它们同样直接显示给老师。
 *    「1B 保存到本机插件」当初就是躲在 showToast 里逃过第一版护栏的。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const visibleCopy = (() => {
  let s = fs.readFileSync('teacher-web/forsales.html', 'utf8');
  s = s.replace(/<style[\s\S]*?<\/style>/g, '');
  s = s.replace(/<script[\s\S]*?<\/script>/g, '');
  s = s.replace(/<svg[\s\S]*?<\/svg>/g, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  return s.replace(/<[^>]+>/g, ' ');
})();

/** 脚本里的中文字面量：toast、confirm 这类点了才显示的文案。 */
const runtimeCopy = (() => {
  const page = fs.readFileSync('teacher-web/forsales.html', 'utf8');
  const script = (page.match(/<script>[\s\S]*?<\/script>/g) || []).join('\n');
  return (script.match(/'[^']*[\u4e00-\u9fa5][^']*'/g) || []).join('\n');
})();

/** 老师能读到的全部文案：静态的加运行时的。 */
const allCopy = `${visibleCopy}\n${runtimeCopy}`;

test('不出现内部阶段编号与实现名词', () => {
  // 「1B」「W0」是我们的排期编号；「插件」「本机」「工作台」是实现细节。
  for (const word of ['1A', '1B', '1C', 'W0', '本机插件', 'chrome', 'storage']) {
    assert.ok(
      !allCopy.includes(word),
      `文案出现内部词「${word}」，老师读不懂也不需要知道`
    );
  }
});

test('不把鼠标操作当卖点写', () => {
  for (const word of ['右键', '双击', '拖到', '拖拽', '属性表单', '点击后']) {
    assert.ok(
      !visibleCopy.includes(word),
      `可见文案出现操作说明「${word}」，销售页讲教学结果而不是鼠标动作`
    );
  }
});

test('不承诺页面上并不存在的交互', () => {
  const script = fs.readFileSync('teacher-web/forsales.html', 'utf8');
  const promisesDrag = /拖到|拖拽|拖动/.test(visibleCopy);
  const hasDrag = /dragstart|'drop'|dragover/.test(script);
  assert.ok(
    !promisesDrag || hasDrag,
    '文案写了拖拽但页面没有实现拖拽；要么实现，要么别写'
  );
});

test('不出现教人怎么读版面的元叙述', () => {
  for (const word of ['下面不是', '本页', '所有内容使用同一组', '如上', '如下图']) {
    assert.ok(
      !visibleCopy.includes(word),
      `可见文案出现版面说明「${word}」，老师要看的是课程效果`
    );
  }
});

test('不出现界面状态词', () => {
  // 静态演示页里的「正在编辑」「未保存」是界面状态，会被当成真实功能承诺。
  for (const word of ['正在编辑', '未保存', '加载中', '待实现', 'TODO']) {
    assert.ok(!visibleCopy.includes(word), `可见文案出现界面状态「${word}」`);
  }
});

test('示例数据仍然明确标注，不冒充真实交付结果', () => {
  assert.ok(visibleCopy.includes('示例数据'), '完成情况必须标为示例');
  assert.ok(visibleCopy.includes('示例课程'), '节点表单里的改动必须说明不影响真实课程');
});

test('不泄漏销售渠道，不提醒老师这是转发来的推销页', () => {
  for (const word of ['发送者', '发给你的人', '转发给你', '销售']) {
    assert.ok(
      !allCopy.includes(word),
      `文案出现渠道用语「${word}」，会让老师意识到自己在被推销`
    );
  }
});

/**
 * 这页靠链接分发给少数老师做演示，不走搜索流量；
 * 而且内嵌的示例字幕是第三方公开视频的全文转写，不希望被索引或存档。
 * workspace.html 早已是这个做法，这里把销售页也锁住。
 */
test('不被搜索引擎索引或存档', () => {
  const page = fs.readFileSync('teacher-web/forsales.html', 'utf8');
  const meta = page.match(/<meta name="robots" content="([^"]*)">/);
  assert.ok(meta, '缺少 robots meta；发布后会被收录');
  assert.match(meta[1], /noindex/);
  assert.match(meta[1], /noarchive/, '存档副本删不掉，必须一起禁');
});

/**
 * 学习结果那一块最容易被误读成「现在就有的报告功能」：
 * 数字很具体，而老师未必分得清这是已上线功能、未来形态，还是我们手工整理的演示。
 * 一个「示例数据」徽章不够——它出现在标题行，看数字的人不一定读到。
 * 所以说明必须在数字之前，并且表格自带 caption，
 * 让被单独截图裁走的表格也带着这句话。
 */
test('学习结果块在数字之前先说明这是产品形态示意', () => {
  const page = fs.readFileSync('teacher-web/forsales.html', 'utf8');
  const notice = page.indexOf('preview-notice');
  const numbers = page.indexOf('class="summary"');
  assert.ok(notice > -1, '缺少说明框');
  assert.ok(numbers > -1);
  assert.ok(notice < numbers, '说明必须排在数字前面，否则先被读到的是数字');
  assert.match(page, /示例数据，当前尚未完成开发/, '要说清当前没有这个功能（计划第 140 行）');
  assert.match(page, /由开发者手工整理/, '要说清数据是怎么来的，且身份是开发者而不是「我们」');
});

test('表格自带 caption，被单独截图也带着说明', () => {
  const page = fs.readFileSync('teacher-web/forsales.html', 'utf8');
  const caption = page.match(/<caption>([^<]*)<\/caption>/);
  assert.ok(caption, '完成情况表必须有 caption');
  assert.match(caption[1], /示例数据/);
});

test('提示不靠颜色单独承载含义', () => {
  const page = fs.readFileSync('teacher-web/forsales.html', 'utf8');
  const rule = page.match(/\.preview-notice\{([^}]*)\}/);
  assert.ok(rule, '缺少 .preview-notice 样式');
  // 金色只做边框；它在浅底上只有约 2.1:1，当文字色会不合格。
  assert.ok(
    !/color:var\(--gold\)/.test(page),
    '金色对比度不足 4.5:1，不能用作文字颜色'
  );
  assert.match(page, /\.preview-notice strong\{[^}]*color:var\(--ink\)/,
    '标题用深墨色，色弱读者和黑白打印都要读得到');
});
