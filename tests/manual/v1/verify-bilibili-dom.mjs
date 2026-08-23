/**
 * 真实 B 站 DOM 与选择器的匹配检查。
 *
 * B 站不向自动化浏览器下发 <video>，所以播放器行为在夹具里验（verify-player）。
 * 但选择器依赖的容器在真实页面上是可查的，而那正是 B 站改版时会断的地方。
 *
 * 这个检查回答一个问题：宿主适配的选择器链里，还有几条能在今天的 B 站上命中。
 * 全部落空就意味着改版后插件绑不到播放器，而学生那边只会表现为「什么都没发生」。
 *
 *   node tests/manual/v1/verify-bilibili-dom.mjs
 */

import playwright from '/Users/bai/node_modules/playwright-core/index.js';
const { chromium } = playwright;
import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** 从适配器源码里读选择器，避免这里抄一份然后各自漂移 */
function selectorsFromAdapter() {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../../v1/extension/host/bilibili/index.ts'),
    'utf8'
  );
  const block = source.slice(
    source.indexOf('const PLAYER_SELECTORS = ['),
    source.indexOf('];', source.indexOf('const PLAYER_SELECTORS = ['))
  );
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function findChromium() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  for (const dir of readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))) {
    const binary = join(cache, dir, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium');
    if (existsSync(binary)) return binary;
  }
  throw new Error('未找到 Chromium');
}

const VIDEO_ID = process.argv[2] ?? 'BV1Ac41187Lm';

async function main() {
  const selectors = selectorsFromAdapter();
  console.log(`适配器的选择器链（${selectors.length} 条）：`);
  for (const s of selectors) console.log(`  ${s}`);

  const profile = mkdtempSync(join(tmpdir(), 'knownmap-dom-'));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: findChromium(),
    headless: true,
  });

  try {
    const page = await context.newPage();
    await page.goto(`https://www.bilibili.com/video/${VIDEO_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // 播放器容器是异步挂载的，给它时间
    await page.waitForTimeout(8000);

    const loaded = await page.title();
    if (!/bilibili/i.test(loaded)) {
      console.error(`\n页面未正常加载（标题「${loaded}」），无法判断选择器。`);
      process.exit(1);
    }

    /*
     * 检查容器而非 `<selector> video`：B 站不给自动化浏览器创建 <video>，
     * 但容器在。容器存在就意味着真实用户的浏览器把 video 建进去时，
     * 这条选择器能命中。
     */
    const results = await page.evaluate(
      (list) =>
        list.map((selector) => {
          const container = selector.replace(/ video$/, '');
          return { selector, container, matched: !!document.querySelector(container) };
        }),
      selectors
    );

    console.log('\n在今天的 B 站页面上：');
    for (const r of results) {
      console.log(`  ${r.matched ? '✓' : '✗'} ${r.container}`);
    }

    const alive = results.filter((r) => r.matched);
    const dead = results.filter((r) => !r.matched);

    console.log(`\n命中 ${alive.length}/${results.length} 条。`);

    if (alive.length === 0) {
      console.error(
        '全部落空：B 站改版后插件绑不到播放器，学生那边表现为「什么都没发生」。\n' +
          '需要更新 v1/extension/host/bilibili/index.ts 的选择器链。'
      );
      process.exit(1);
    }

    if (dead.length > 0) {
      console.log(
        `其中 ${dead.length} 条已失效（${dead.map((d) => d.container).join('、')}），` +
          '由后备选择器兜住。\n失效的可以清理，但保留也无害——多一条后备比少一条安全。'
      );
    }

    // 最大面积回退还需要页面上真有 video 元素才能生效，如实报告
    const videoCount = await page.evaluate(() => document.querySelectorAll('video').length);
    console.log(
      `\n页面上的 <video> 数量：${videoCount}` +
        (videoCount === 0 ? '（B 站不向自动化浏览器下发，属预期）' : '')
    );
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('检查中断：', error.message);
  process.exit(1);
});
