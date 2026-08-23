/**
 * 阶段 7 真实 Chrome 验收。
 *
 * 加载真实 MV3 扩展到真实 Chromium，在真实 B 站页面上走完学生流程。
 * 这不是 mock：service worker、chrome.storage、content script 注入、
 * 播放器事件全部是真的。
 *
 * 前置：后端在 127.0.0.1:8000 运行，且有一个已发布课程的授权码。
 *
 *   node tests/manual/v1/verify-extension.mjs <授权码> [--headed]
 */

// playwright-core 是 CommonJS，只能默认导入
import playwright from '/Users/bai/node_modules/playwright-core/index.js';
const { chromium } = playwright;
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const EXTENSION = resolve(import.meta.dirname, '../../../v1/extension/dist/local');
const ACCESS_CODE = process.argv[2];
const HEADED = process.argv.includes('--headed');

if (!ACCESS_CODE) {
  console.error('用法: node verify-extension.mjs <授权码> [--headed]');
  process.exit(2);
}

/** 找本机的 Chromium。MV3 扩展需要完整浏览器，headless shell 不行 */
function findChromium() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  // 从新到旧找第一个真有可执行文件的：缓存里可能留着只下载了壳的版本
  const dirs = readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));

  for (const dir of dirs) {
    const binary = join(cache, dir, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium');
    if (existsSync(binary)) return binary;
  }
  // 退回系统 Chrome：MV3 扩展在正式版 Chrome 上一样能加载
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(chrome)) return chrome;
  throw new Error('未找到可用的 Chromium 或 Chrome');
}

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, skipped: false, detail });
  console.log(`${passed ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
}

/** 环境限制导致无法验证。不算通过，也不算失败 */
function skip(name, reason) {
  results.push({ name, passed: false, skipped: true, detail: reason });
  console.log(`⊘ ${name}  ${reason}`);
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'knownmap-profile-'));

  const context = await chromium.launchPersistentContext(profile, {
    executablePath: findChromium(),
    // MV3 扩展必须用持久上下文加载；新版 headless 支持扩展
    headless: !HEADED,
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
    ],
  });

  try {
    // service worker 起来才算扩展装上了
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    const extensionId = new URL(worker.url()).host;
    check('扩展已加载，service worker 运行', !!extensionId, extensionId);

    // ---- 兑换授权码 ----
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await popup.waitForSelector('.redeem-input', { timeout: 10000 });
    check('工具栏首页可打开', true);

    const emptyState = await popup.locator('.empty').count();
    check('初始为空课程库', emptyState === 1);

    await popup.fill('.redeem-input', ACCESS_CODE);
    await popup.click('.redeem button.primary');
    await popup.waitForSelector('.course', { timeout: 20000 });

    const courseTitle = await popup.locator('.course-title').first().textContent();
    check('授权码兑换成功，课程入库', !!courseTitle, courseTitle ?? '');

    const codeHint = await popup.locator('.course-code').first().textContent();
    check('课程库显示授权码尾段', /码尾/.test(codeHint ?? ''), codeHint ?? '');

    // 明文授权码不得落盘
    const stored = await worker.evaluate(async () => {
      const all = await chrome.storage.local.get(null);
      return JSON.stringify(all);
    });
    check('明文授权码未落盘', !stored.includes(ACCESS_CODE));
    check('存储根为 v1 结构', stored.includes('knownmapV1'));
    check('旧存储键未被创建', !stored.includes('studentCourseStore'));

    // ---- 取出课节的 BVID 与节点，供后续断言 ----
    const lesson = await worker.evaluate(async () => {
      const { knownmapV1 } = await chrome.storage.local.get('knownmapV1');
      const course = Object.values(knownmapV1.installedCourses)[0];
      const first = course.lessons[0];
      return {
        videoId: first.videoId,
        nodeCount: first.nodes.length,
        firstNodeSeconds: first.nodes[0]?.trigger?.timeSeconds,
      };
    });
    check('课节带 BVID 与节点', !!lesson.videoId && lesson.nodeCount > 0,
      `${lesson.videoId} / ${lesson.nodeCount} 节点 @ ${lesson.firstNodeSeconds}s`);

    // ---- 真实 B 站页面 ----
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    // 非视频页不得出现任何 KnownMap UI
    await page.goto('https://www.bilibili.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);
    check('非视频页无 KnownMap UI',
      (await page.locator('#knownmap-learning-window').count()) === 0);

    // 匹配的视频页
    await page.goto(`https://www.bilibili.com/video/${lesson.videoId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    /*
     * B 站不给自动化浏览器下发播放器：容器渲染出来了，<video> 始终不创建，
     * headed 与 headless 表现一致。这是平台侧的反自动化，不是我们的代码问题。
     *
     * 所以播放器相关的断言分两种记法：拿不到播放器时记为「跳过」而不是
     * 「失败」——把环境限制记成失败，会让真正的失败淹没在噪声里；但也不能
     * 记成通过，那等于谎报验证过。
     */
    const hasVideo = await page
      .waitForFunction(() => !!document.querySelector('video'), { timeout: 20000 })
      .then(() => true)
      .catch(() => false);

    const playerContainer = await page.evaluate(
      () => !!document.querySelector('.bpx-player-container, #bilibili-player')
    );
    check('内容脚本注入到匹配的视频页', playerContainer);

    if (!hasVideo) {
      skip('播放器相关断言', 'B 站不向自动化浏览器下发 <video>，需人工在日常 Chrome 中验');
    }

    if (hasVideo) {
      // 直接把播放位置推到第一个节点之后，不必等真播放
      const target = (lesson.firstNodeSeconds ?? 30) + 1;
      await page.evaluate((t) => {
        const v = document.querySelector('video');
        v.muted = true;
        v.currentTime = t;
        v.dispatchEvent(new Event('timeupdate'));
      }, target);

      const windowAppeared = await page
        .waitForFunction(
          () => {
            const host = document.querySelector('#knownmap-learning-window');
            return !!host?.shadowRoot?.querySelector('.km-panel');
          },
          { timeout: 15000 }
        )
        .then(() => true)
        .catch(() => false);
      check('到点弹出学习窗口', windowAppeared);

      if (windowAppeared) {
        const paused = await page.evaluate(() => document.querySelector('video').paused);
        check('弹窗时视频已暂停', paused);

        const title = await page.evaluate(() => {
          const root = document.querySelector('#knownmap-learning-window').shadowRoot;
          return root.querySelector('.km-title')?.textContent;
        });
        check('窗口显示节点内容', !!title, title ?? '');

        // 样式隔离：窗口在 Shadow DOM 里，页面上不该出现我们的类名
        const leaked = await page.evaluate(
          () => document.querySelectorAll('.km-panel').length
        );
        check('样式经 Shadow DOM 隔离，未污染 B 站页面', leaked === 0);

        // 作答并继续
        await page.evaluate(() => {
          const root = document.querySelector('#knownmap-learning-window').shadowRoot;
          root.querySelector('.km-actions .km-primary').click();
        });
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          const root = document.querySelector('#knownmap-learning-window').shadowRoot;
          root.querySelector('.km-actions .km-primary')?.click();
        });
        await page.waitForTimeout(1500);

        const resumed = await page.evaluate(
          () => !document.querySelector('video').paused
        );
        check('关窗后恢复播放', resumed);

        // 作答已写入本机
        const recorded = await worker.evaluate(async () => {
          const { knownmapV1 } = await chrome.storage.local.get('knownmapV1');
          const byCourse = Object.values(knownmapV1.localLearningState)[0] ?? {};
          const lesson = Object.values(byCourse)[0];
          return lesson?.done?.length ?? 0;
        });
        check('作答记录已写入本机', recorded > 0, `${recorded} 个节点`);

        // ---- 刷新后不重复弹 ----
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => !!document.querySelector('video'), {
          timeout: 30000,
        });
        await page.evaluate((t) => {
          const v = document.querySelector('video');
          v.muted = true;
          v.currentTime = t;
          v.dispatchEvent(new Event('timeupdate'));
        }, target);
        await page.waitForTimeout(4000);

        const reappeared = await page.evaluate(() => {
          const host = document.querySelector('#knownmap-learning-window');
          return !!host?.shadowRoot?.querySelector('.km-panel');
        });
        check('刷新后已作答节点不再弹', !reappeared);
      }

      // ---- 站内切到别的视频，旧 UI 不残留 ----
      await page.evaluate(() => {
        history.pushState(null, '', '/video/BV1zz411z7zz');
      });
      await page.waitForTimeout(3000);
      const stale = await page.evaluate(
        () => document.querySelectorAll('#knownmap-learning-window').length
      );
      check('SPA 切走后旧窗口不残留', stale === 0);
    }

    check('B 站页面无 KnownMap 相关报错',
      consoleErrors.filter((e) => /knownmap/i.test(e)).length === 0,
      consoleErrors.filter((e) => /knownmap/i.test(e))[0] ?? '');
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }

  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => !r.passed && !r.skipped);
  const passed = results.filter((r) => r.passed);

  console.log(`\n通过 ${passed.length}，失败 ${failed.length}，跳过 ${skipped.length}`);
  if (failed.length) {
    console.log('未通过：');
    for (const f of failed) console.log(`  - ${f.name}`);
  }
  if (skipped.length) {
    console.log('因环境限制跳过（需人工在日常 Chrome 中验证）：');
    for (const s of skipped) console.log(`  - ${s.name}：${s.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('验收中断：', error.message);
  process.exit(1);
});
