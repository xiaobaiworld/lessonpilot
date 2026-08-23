/**
 * 播放器路径验收。
 *
 * B 站不向自动化浏览器下发 <video>，所以「到点暂停 → 作答 → 恢复播放」
 * 这条路径无法在真实 B 站页面上自动验。这里用请求拦截把
 * https://www.bilibili.com/video/BV... 的响应换成本地夹具：
 *
 * - 内容脚本仍按真实 manifest 规则注入（Chrome 按 URL 匹配，不看内容）；
 * - 页面有真实 <video> 元素和与 B 站一致的容器结构；
 * - service worker、chrome.storage、Shadow DOM 全是真的。
 *
 * 没覆盖的只有 B 站自己那套 DOM，而选择器本来就是从它那里取的。
 *
 *   node tests/manual/v1/verify-player.mjs <授权码>
 */

import playwright from '/Users/bai/node_modules/playwright-core/index.js';
const { chromium } = playwright;
import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';

const HARNESS_PORT = 4198;

const EXTENSION = resolve(import.meta.dirname, '../../../v1/extension/dist/local');
const HARNESS = readFileSync(join(import.meta.dirname, 'player-harness.html'), 'utf8');
const ACCESS_CODE = process.argv[2];

if (!ACCESS_CODE) {
  console.error('用法: node verify-player.mjs <授权码>');
  process.exit(2);
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

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
}

/**
 * 轮询等窗口出现。
 *
 * 每次 evaluate 都让页面保持活跃，抵消 Chrome 对不活跃标签页的节流；
 * 顺带打印播放进度，等待过程可观察。
 */
async function waitForWindow(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastReported = -1;

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      shown: !!document.querySelector('#knownmap-learning-window')?.shadowRoot
        ?.querySelector('.km-panel'),
      at: document.getElementById('main')?.currentTime ?? 0,
    }));
    if (state.shown) return true;

    const whole = Math.floor(state.at / 10) * 10;
    if (whole > lastReported) {
      lastReported = whole;
      console.log(`      播放至 ${state.at.toFixed(0)}s`);
    }
    await page.waitForTimeout(2000);
  }
  return false;
}

/** 读 Shadow DOM 里的学习窗口 */
const panel = (page, expr) =>
  page.evaluate((e) => {
    const root = document.querySelector('#knownmap-learning-window')?.shadowRoot;
    if (!root) return null;
    // eslint-disable-next-line no-new-func
    return new Function('root', `return ${e}`)(root);
  }, expr);

async function main() {
  const harnessServer = createServer((request, response) => {
    // 任何 /video/BV... 都回同一份夹具
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(HARNESS);
  });
  await new Promise((ready) => harnessServer.listen(HARNESS_PORT, '127.0.0.1', ready));

  const profile = mkdtempSync(join(tmpdir(), 'knownmap-player-'));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: findChromium(),
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION}`,
      `--load-extension=${EXTENSION}`,
      // captureStream 需要，且避免真实设备权限提示
      '--use-fake-ui-for-media-stream',
    ],
  });

  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
    const extensionId = new URL(worker.url()).host;

    // 先兑换，课程要先在本机才有得跑
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await popup.waitForSelector('.redeem-input', { timeout: 10000 });
    await popup.fill('.redeem-input', ACCESS_CODE);
    await popup.click('.redeem button.primary');
    await popup.waitForSelector('.course', { timeout: 20000 });

    const lesson = await worker.evaluate(async () => {
      const { knownmapV1 } = await chrome.storage.local.get('knownmapV1');
      const course = Object.values(knownmapV1.installedCourses)[0];
      const first = course.lessons[0];
      return {
        videoId: first.videoId,
        seconds: first.nodes[0]?.trigger?.timeSeconds ?? 30,
        nodeCount: first.nodes.length,
      };
    });
    check('课程已在本机', lesson.nodeCount > 0, `${lesson.videoId} / ${lesson.nodeCount} 节点`);

    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));

    /*
     * 从本地 HTTP 服务提供夹具，路径伪装成 /video/BV...。
     *
     * 先试过用 playwright 的 route 拦截伪造 bilibili.com 的响应，但内容脚本
     * 不会注入到那种响应里——worker 一条消息都没收到。所以改为真实来源，
     * 由本机构建目标的 manifest 显式覆盖它（生产目标不含）。
     */
    await page.goto(`http://127.0.0.1:${HARNESS_PORT}/video/${lesson.videoId}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(() => document.querySelectorAll('video').length === 2, {
      timeout: 10000,
    });
    check('夹具提供真实播放器', true);

    /*
     * 夹具的视频真的在播，currentTime 随实时推进——内容脚本在隔离世界里
     * 读的是原生属性，主世界改不动它。所以这里等到节点时刻自然到达。
     * 超时按节点时刻加余量。
     */
    /*
     * 轮询等待，而不是一次 waitForFunction 长等。
     *
     * 不活跃的标签页会被 Chrome 节流，captureStream 的时间几乎停走，
     * 于是永远等不到节点时刻。周期性 evaluate 会让页面保持活跃 —— 这一点
     * 必须写成显式机制：靠别的调用「顺便」保活，改动一次就会变成偶发失败。
     */
    console.log(`  （等待播放到 ${lesson.seconds}s，每 2 秒轮询一次以避免标签页被节流）`);
    const appeared = await waitForWindow(page, (lesson.seconds + 30) * 1000);
    check('到点弹出学习窗口', appeared);

    if (!appeared) {
      check('后续播放器断言', false, '窗口未出现，无法继续');
    } else {
      check('适配器绑主播放器而非推荐位小视频',
        await page.evaluate(() => document.getElementById('main').paused));
      check('推荐位小视频未被暂停',
        await page.evaluate(() => !document.getElementById('decoy').paused));

      const title = await panel(page, "root.querySelector('.km-title')?.textContent");
      check('窗口显示节点标题', !!title, title ?? '');

      check('样式经 Shadow DOM 隔离未污染页面',
        (await page.evaluate(() => document.querySelectorAll('.km-panel').length)) === 0);

      // 作答 → 反馈 → 关窗
      await page.evaluate(() => {
        document
          .querySelector('#knownmap-learning-window')
          .shadowRoot.querySelector('.km-actions .km-primary')
          .click();
      });
      await page.waitForTimeout(600);
      const outcome = await panel(page, "root.querySelector('.km-title')?.textContent");
      check('作答后进入反馈态', outcome !== title, outcome ?? '');

      await page.evaluate(() => {
        document
          .querySelector('#knownmap-learning-window')
          .shadowRoot.querySelector('.km-actions .km-primary')
          .click();
      });
      await page.waitForTimeout(1200);

      check('关窗后恢复播放',
        await page.evaluate(() => !document.getElementById('main').paused));
      check('关窗后窗口已移除',
        (await page.evaluate(
          () => !document.querySelector('#knownmap-learning-window')?.shadowRoot
            ?.querySelector('.km-panel')
        )) === true);

      const recorded = await worker.evaluate(async () => {
        const { knownmapV1 } = await chrome.storage.local.get('knownmapV1');
        const byCourse = Object.values(knownmapV1.localLearningState)[0] ?? {};
        const first = Object.values(byCourse)[0];
        return { done: first?.done?.length ?? 0, position: first?.lastPositionSeconds ?? 0 };
      });
      check('作答写入本机', recorded.done > 0, `${recorded.done} 个节点`);
      check('播放位置写入本机', recorded.position > 0, `${recorded.position}s`);

      /*
       * 全屏。
       *
       * 全屏期间只有全屏元素的子树参与渲染，挂在 body 上的窗口有尺寸却
       * 不可见——学生只会看到画面冻住。用命中测试判断真实可见性，
       * 光看 getBoundingClientRect 是看不出来的。
       */
      await page.click('#fullscreen');
      await page.waitForTimeout(800);
      check('进入真实全屏',
        (await page.evaluate(() => !!document.fullscreenElement)) === true);

      // 让第二个节点到点
      const secondAppeared = await waitForWindow(page, 60000);
      check('全屏中节点仍触发', secondAppeared);

      if (secondAppeared) {
        const reachable = await page.evaluate(() => {
          const host = document.querySelector('#knownmap-learning-window');
          const panel = host?.shadowRoot?.querySelector('.km-panel');
          if (!panel) return { visible: false, reason: '无面板' };
          const r = panel.getBoundingClientRect();
          // 命中测试：全屏下不可见的元素，中心点会命中全屏元素而不是它自己
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return {
            visible: hit === host || host?.contains(hit),
            inFullscreenSubtree: document.fullscreenElement?.contains(host) ?? false,
          };
        });
        check('全屏中窗口真实可见（命中测试）', reachable.visible);
        check('窗口已挂进全屏元素子树', reachable.inFullscreenSubtree);

        await page.evaluate(() => {
          document
            .querySelector('#knownmap-learning-window')
            .shadowRoot.querySelector('.km-actions .km-primary')
            .click();
        });
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          document
            .querySelector('#knownmap-learning-window')
            .shadowRoot.querySelector('.km-actions .km-primary')
            ?.click();
        });
        await page.waitForTimeout(1000);
        check('全屏中作答后恢复播放',
          await page.evaluate(() => !document.getElementById('main').paused));
      }

      // 退出全屏后窗口要能挪回 body
      await page.evaluate(() => document.exitFullscreen());
      await page.waitForTimeout(600);
      check('退出全屏未留下孤立窗口',
        (await page.evaluate(() => {
          const host = document.querySelector('#knownmap-learning-window');
          return !host || host.parentNode === document.body;
        })) === true);

      // 刷新后不重复弹：等过节点时刻仍无窗口才算通过
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('video').length === 2, {
        timeout: 10000,
      });
      // 同样要保活，否则「没弹」可能只是因为时间没走到
      const reappeared = await waitForWindow(page, (lesson.seconds + 12) * 1000);
      check('刷新后已作答节点不再弹', !reappeared);
      check('刷新后播放确实越过了节点时刻',
        (await page.evaluate(() => document.getElementById('main').currentTime)) >
          lesson.seconds);

      // SPA 切到不匹配的视频，旧 UI 不残留
      await page.evaluate(() => history.pushState(null, '', '/video/BV1zz411z7zz'));
      await page.waitForTimeout(3000);
      check('SPA 切走后旧窗口不残留',
        (await page.evaluate(
          () => document.querySelectorAll('#knownmap-learning-window').length
        )) === 0);
    }

    const ours = errors.filter((e) => /knownmap/i.test(e));
    check('页面无 KnownMap 报错', ours.length === 0, ours[0] ?? '');
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
    await new Promise((closed) => harnessServer.close(closed));
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n通过 ${results.length - failed.length}，失败 ${failed.length}`);
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `：${f.detail}` : ''}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('验收中断：', error.message);
  process.exit(1);
});
