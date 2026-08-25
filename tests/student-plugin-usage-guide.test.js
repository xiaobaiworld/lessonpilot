// 定位：验证学生插件使用说明页的导航、安装步骤、截图与可访问性边界。
// 入口参数：v1/site 的销售页、学生说明页和说明截图。
// 返回参数：Node test 通过/失败结果。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const salesPath = path.join(root, 'v1/site/index.html');
const guidePath = path.join(root, 'v1/site/student-guide.html');

function visibleText(source) {
  return source
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('销售页把直接下载改为学生使用步骤入口', () => {
  const sales = fs.readFileSync(salesPath, 'utf8');
  const tool = sales.match(/<div class="cta-tool plugin-download">([\s\S]*?)<\/div>/);

  assert.ok(tool, '销售页缺少学生工具入口');
  assert.match(tool[1], /href="\/student-guide\.html"/);
  assert.match(tool[1], />学生使用步骤</);
  assert.doesNotMatch(tool[1], /knownmapplugin\.zip/,
    '销售页入口应先解释安装步骤，不再直接下载 ZIP');
  assert.doesNotMatch(tool[1], />学生插件下载</);
});

test('说明页覆盖下载、解压和 Chrome 手动安装完整流程', () => {
  assert.equal(fs.existsSync(guidePath), true, '缺少 v1/site/student-guide.html');
  const page = fs.readFileSync(guidePath, 'utf8');
  const visible = visibleText(page);

  for (const copy of [
    '学生使用步骤',
    '1. 下载插件',
    '2. 解压插件',
    '3. 打开扩展程序管理页',
    '4. 开启开发者模式',
    '5. 加载已解压的扩展程序',
    'PC Chrome'
  ]) {
    assert.ok(visible.includes(copy), `说明页缺少「${copy}」`);
  }

  assert.match(page, /href="\/downloads\/student-plugin\/knownmapplugin\.zip"/);
  assert.match(page, /download="knownmapplugin\.zip"/);
  assert.match(visible, /chrome:\/\/extensions/);
  assert.match(visible, /不要移动或删除这个文件夹/);
});

test('说明页可以返回销售页且不要求登录', () => {
  const page = fs.readFileSync(guidePath, 'utf8');
  const visible = visibleText(page);

  assert.match(page, /href="\/"[^>]*>[^<]*返回销售页/);
  assert.match(visible, /不需要登录/);
  assert.doesNotMatch(visible, /手机安装|移动端安装|支持手机/);
});

test('关键步骤使用匿名 PNG 截图并提供替代文本', () => {
  const page = fs.readFileSync(guidePath, 'utf8');
  const screenshots = [
    {
      file: 'step-download-and-unzip.png',
      alt: '下载完成后解压 KnownMap 插件压缩包'
    },
    {
      file: 'step-open-extensions.png',
      alt: '在 Chrome 扩展程序管理页开启开发者模式'
    },
    {
      file: 'step-load-unpacked.png',
      alt: '点击加载已解压的扩展程序并选择插件文件夹'
    }
  ];

  for (const screenshot of screenshots) {
    const relative = `assets/student-guide/${screenshot.file}`;
    assert.match(page, new RegExp(`src="${relative.replaceAll('.', '\\.')}`));
    assert.match(page, new RegExp(`alt="${screenshot.alt}"`));
    assert.equal(
      fs.existsSync(path.join(root, 'v1/site', relative)),
      true,
      `缺少截图 ${relative}`
    );
  }
});

test('说明页继承销售页视觉变量并提供窄屏与键盘状态', () => {
  const page = fs.readFileSync(guidePath, 'utf8');

  for (const token of ['--paper:#f4f0e6', '--ink:#16251f', '--brand:#1d5c43', '--dark:#103b2b']) {
    assert.ok(page.includes(token), `缺少销售页视觉变量 ${token}`);
  }
  assert.match(page, /@media\s*\(max-width:\s*720px\)/);
  assert.match(page, /:focus-visible/);
  assert.match(page, /<meta name="viewport"/);
});
