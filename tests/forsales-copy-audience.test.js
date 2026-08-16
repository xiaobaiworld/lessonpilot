/**
 * 销售页文案受众护栏：forsales.html 是给老师看的，不是给我们自己看的。
 * 运行：node --test tests/forsales-copy-audience.test.js
 *
 * 这个页面反复出现过同一类问题：开发阶段编号、鼠标操作手册、版面说明、
 * 替设计辩解的话，混进了老师能看见的文案里。它们不影响功能，所以功能测试
 * 全绿也发现不了，只能靠文案本身的断言拦住。
 *
 * 只检查「可见文案」：先剥掉 style / script / svg / 注释和标签，
 * 剩下的才是老师真正会读到的字。
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

test('不出现内部阶段编号与实现名词', () => {
  // 「1B」「W0」是我们的排期编号；「插件」「本机」「工作台」是实现细节。
  for (const word of ['1A', '1B', '1C', 'W0', '本机插件', 'chrome', 'storage']) {
    assert.ok(
      !visibleCopy.includes(word),
      `可见文案出现内部词「${word}」，老师读不懂也不需要知道`
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
