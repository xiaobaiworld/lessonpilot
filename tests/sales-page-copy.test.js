// 定位: 验证销售页文案、试用入口和产品承诺边界。
// 入口参数: 销售页 HTML、试用入口模块与页面数据脚本。
// 返回参数: Node test 通过/失败结果。
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
const { TRIAL_INTAKE, isBilibiliUrl } = require('../v1/site/trial-intake.js');

const page = fs.readFileSync('v1/site/index.html', 'utf8');

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

test('身份统一为 KnownMap 开发者，不用未定义的「我们」', () => {
  // 「KnownMap 开发者」和「KnownMap 的开发者」都算：锁的是身份，不是措辞。
  assert.match(visible, /KnownMap 的?开发者/);
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

test('销售页只提供独立申请页入口，不嵌入本地试用表单', () => {
  const links = page.match(/href="(https?:[^"]*)"/g) || [];
  for (const link of links) {
    assert.ok(
      !/example\.com|TODO|占位|placeholder|#$/.test(link),
      `占位链接会变成死链：${link}`
    );
  }
  assert.match(page, /href="\/trial-application\.html"/);
  assert.doesNotMatch(page, /data-trial-intake-form/);
  assert.doesNotMatch(page, /src="trial-intake\.js\?v=/);
  assert.match(page, /在线填写试用申请/);
  assert.equal(TRIAL_INTAKE.endpoint, '/api/v1/public/trial-applications');
  assert.equal(TRIAL_INTAKE.buttonLabel, '提交留言');
  assert.equal(isBilibiliUrl('https://www.bilibili.com/video/BVexample'), true);
  assert.ok(!page.includes('my.feishu.cn'));
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
    '让用心抵达，让理解更深。', 'KnownMap 的开发者',
    '真实、可运行的智能互动课', '愿意上传到 B 站',
    '协助你准备相关资源', '免费使用的学生端工具', '亲自使用工作台'
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

/**
 * 首屏对比模块的承诺边界（2026-08-16 确认）。
 * 这一块最容易越界：它是全页最有说服力的位置，
 * 一句「按学生水平自动出题」就把当前不存在的能力说成了现成的。
 */
test('对比模块不承诺个性化生成能力', () => {
  for (const word of [
    '因人而异', '按学生水平', '自动生成题目', '动态生成',
    '个性化推荐', '智能出题', '自适应'
  ]) {
    assert.ok(!allCopy.includes(word), `「${word}」是当前不存在的能力（D-005：固定互动、老师预设反馈）`);
  }
  // 反馈必须写成老师预先设计的，不是系统判断的。
  assert.match(visible, /老师预先设计的反馈/);
});

test('不使用无法验证的绝对化表述', () => {
  for (const word of [
    '独一无二', '全网首创', '防盗版', '无法复制', '唯一',
    '业界第一', '最好的'
  ]) {
    assert.ok(!allCopy.includes(word), `「${word}」无法验证`);
  }
});

test('对比模块的互动方式与契约的四种节点一致', () => {
  const start = page.indexOf('class="hero-proof"');
  const end = page.indexOf('</aside>', start);
  const block = page.slice(start, end).replace(/<[^>]+>/g, ' ');
  // 「重点标注、选择、填空和问答」对应 attention/choice/blank/free_text 四种。
  for (const k of ['重点标注', '选择', '填空', '问答']) {
    assert.ok(block.includes(k), `对比模块缺少互动方式「${k}」`);
  }
  assert.ok(!block.includes('语音'), '老师语音已在 D-005 放弃');
  assert.ok(!block.includes('AI'), 'D-005：问答题不调用 AI');
});

test('对比模块不再拿完成率和学习数据当主要价值', () => {
  const start = page.indexOf('class="hero-proof"');
  const end = page.indexOf('</aside>', start);
  const block = page.slice(start, end);
  for (const word of ['完成率', '学习数据', '播放量']) {
    assert.ok(!block.includes(word), `「${word}」已不是这个模块的主要价值`);
  }
});

/**
 * 同一种节点只能有一个显示名（2026-08-16 确认统一为契约名「重点标注」）。
 * 页面上出现两个名字时，老师会以为是两种不同的互动。
 */
test('节点显示名全页统一，不出现同义别名', () => {
  for (const alias of ['重点提示', '重点内容', '重点说明', '老师补充']) {
    assert.ok(!allCopy.includes(alias), `「${alias}」是「重点标注」的别名，全页只用一个名字`);
  }
  assert.ok(allCopy.includes('重点标注'));
});
