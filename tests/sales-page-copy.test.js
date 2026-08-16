/**
 * 销售页文案与试用入口验收（WEB-05、WEB-06、D-012）。
 * 运行：node --test tests/sales-page-copy.test.js
 *
 * 依据 doc/plans/stage-1b-sales-page-revision.md 第 7 节的自动化检查清单。
 * 这些是承诺边界，不是措辞偏好：写超了就是对老师失信，
 * 而失信的地方在功能测试里全都是绿的。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync('teacher-web/forsales.html', 'utf8');

/** 剥掉 style/script/svg/注释和标签后，老师真正读到的静态文字。 */
const visible = (() => {
  let s = page;
  s = s.replace(/<style[\s\S]*?<\/style>/g, '');
  s = s.replace(/<script[\s\S]*?<\/script>/g, '');
  s = s.replace(/<svg[\s\S]*?<\/svg>/g, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  return s.replace(/<[^>]+>/g, ' ');
})();

/** 脚本里的中文字面量：toast 这类点了才出现的文案。 */
const runtime = (() => {
  const script = (page.match(/<script>[\s\S]*?<\/script>/g) || []).join('\n');
  return (script.match(/'[^']*[一-龥][^']*'/g) || []).join('\n');
})();

const allCopy = `${visible}\n${runtime}`;

test('身份统一为 LessonPilot 开发者，不用未定义的「我们」', () => {
  // 「LessonPilot 开发者」和「LessonPilot 的开发者」都算：锁的是身份，不是措辞。
  assert.match(visible, /LessonPilot 的?开发者/);
  // 「发给我们」是 D-012 点名要去掉的表达：接收人没有定义。
  assert.ok(!allCopy.includes('发给我们'), 'D-012 点名禁止「发给我们」');
  assert.ok(!allCopy.includes('我们会联系你'), '接收人必须是开发者本人');
});

test('主 CTA 是回复当前私信，且唯一', () => {
  assert.match(visible, /回复我，试一节真实课/);
  // 必须写清是哪个渠道的私信，不能只说「联系我」。
  assert.match(visible, /B 站私信/);
  assert.match(visible, /微信/);
  const primary = page.match(/class="cta-primary"/g) || [];
  assert.equal(primary.length, 1, '主 CTA 必须唯一，否则老师不知道该做哪个动作');
});

test('复制话术只是复制，不冒充已提交', () => {
  assert.match(visible, /复制试用话术/);
  assert.ok(!allCopy.includes('提交成功'), '复制不等于提交');
  assert.ok(!allCopy.includes('申请已发送'));
  // 成功和失败两条提示都要说清粘贴到哪里。
  const toasts = runtime.match(/'[^']*复制[^']*'/g) || [];
  assert.ok(toasts.length >= 2, '成功与失败各需一条提示');
  for (const t of toasts) {
    assert.match(t, /私信|微信/, `提示「${t}」没说粘贴到哪里`);
  }
});

test('试用承诺是可运行的真实课程，不是静态展示', () => {
  assert.match(visible, /真实、可运行的智能互动课程试用/);
  assert.ok(!visible.includes('互动改造示例'), '旧的弱承诺已被 D-012 取代');
});

test('目标老师条件写清楚，不要求已在 B 站发布', () => {
  assert.match(visible, /不需要已经在 B 站发布/);
  assert.match(visible, /准备上传到 B 站/);
  assert.match(visible, /字幕/, '字幕可由开发者协助准备');
  assert.match(visible, /PC Chrome/);
});

test('插件说明只陈述可验证事实，不制造安全恐惧也不夸大', () => {
  assert.match(visible, /免费/);
  assert.match(visible, /未匹配/, '未匹配课程时不启动互动');
  for (const word of [
    '绝对安全', '安全认证', '安全审计', '不会读取任何',
    '所有视频都自动', '经过认证'
  ]) {
    assert.ok(!allCopy.includes(word), `禁止文案「${word}」：当前没有这个证据`);
  }
});

test('四种正式节点，不出现第五种（D-005）', () => {
  for (const kind of ['重点标注', '选择题', '填空题', '问答题']) {
    assert.ok(allCopy.includes(kind), `缺少正式节点「${kind}」`);
  }
  assert.ok(!allCopy.includes('老师补充'), 'D-005 只有四种节点，「老师补充」不是其中之一');
});

test('学习结果标为示例且尚未完成开发', () => {
  assert.match(visible, /未来可以看到的学习结果/);
  assert.match(visible, /示例数据，当前尚未完成开发/);
  // 「下一次该讲什么」是正式报告能力，当前没有。
  assert.ok(!visible.includes('下一次该讲什么'), '这是正式报告能力，当前不具备');
});

test('不把插件、报告或多学生数据写成已上线能力', () => {
  for (const word of ['已上线', '立即生成', '自动生成课程', '一键生成']) {
    assert.ok(!allCopy.includes(word), `「${word}」超出当前能力`);
  }
});

test('没有飞书 URL 时不留死链接（计划第 24、102 行）', () => {
  const links = page.match(/href="(https?:[^"]*)"/g) || [];
  for (const link of links) {
    assert.ok(
      !/example\.com|TODO|占位|placeholder|#$/.test(link),
      `占位链接会变成死链：${link}`
    );
  }
  // 表单入口要么带真实飞书 URL，要么整块不出现。
  const mentionsForm = /飞书|填写 1 分钟试用信息/.test(visible);
  const hasFeishuUrl = /href="https:\/\/[^"]*(feishu|larksuite)[^"]*"/.test(page);
  assert.ok(
    !mentionsForm || hasFeishuUrl,
    '提到了表单但没有真实飞书 URL；按计划第 24 行应先不显示表单入口'
  );
});

/**
 * 品牌主张固定在首屏主标题上方（计划第 36 行）。
 * 它是固定文案，不是可随手改的装饰句，所以连位置一起锁：
 * 排到 h1 下面就不再是「主张」，而变成一句普通说明。
 */
test('品牌主张固定在主标题上方', () => {
  assert.match(visible, /让用心抵达，让理解更深。/);
  const brand = page.indexOf('让用心抵达，让理解更深。');
  const h1 = page.indexOf('<h1>');
  assert.ok(brand > -1 && h1 > -1);
  assert.ok(brand < h1, '品牌主张必须排在 h1 之前');
  // 受众由品牌主张和身份段承担，不再单独写一行 eyebrow。
  assert.ok(!visible.includes('给已经在卖录播课的英语老师'), '这行已按要求删除');
});

/**
 * 首屏要自成一体：只读第一屏的老师也该知道身份、承诺、目标视频和「不用自己搞定」。
 * 计划第 45-51 行的建议段落把这四件事都放在首屏，
 * 因为老师犹豫最强的时刻就是首屏，协助说明放到页尾就来不及了。
 */
test('首屏自成一体，含身份、承诺、目标视频与协助说明', () => {
  const start = page.indexOf('class="wrap hero"');
  const end = page.indexOf('class="hero-proof"');
  assert.ok(start > -1 && end > start);
  const hero = page.slice(start, end).replace(/<[^>]+>/g, ' ');
  for (const k of [
    '让用心抵达，让理解更深。', 'LessonPilot 的开发者',
    '真实、可运行的智能互动课', '愿意上传到 B 站',
    '协助你准备字幕', '免费使用的学生端工具', '亲自使用工作台'
  ]) {
    assert.ok(hero.includes(k), `首屏缺少「${k}」`);
  }
});

/**
 * 首屏叫「学生端工具」，试用说明里叫「插件」——同一个东西两个名字。
 * 老师要装的就是这个插件，而安全边界那一节的主语也是它，
 * 所以页面必须把两个说法明确挂上钩，否则老师读完不知道说的是同一件事。
 */
test('学生端工具与插件是同一件事，页面把两个说法挂上钩', () => {
  const usesTool = visible.includes('学生端工具');
  const usesPlugin = /插件/.test(visible);
  if (usesTool && usesPlugin) {
    assert.match(
      visible,
      /学生端工具是一个 Chrome 插件/,
      '两个称呼并存时必须有一句把它们对应起来'
    );
  }
});

/**
 * 全页统一用「你」，不混用「您」（2026-08-16 已确认）。
 * 同一页两种称呼在中文里很显眼，读起来像没校对过。
 */
test('称呼统一为「你」，不混用「您」', () => {
  assert.ok(!visible.includes('您'), '已确认全页统一为「你」');
});
