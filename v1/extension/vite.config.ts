import { defineConfig } from 'vite';
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  cpSync,
  existsSync,
} from 'node:fs';
import { resolve } from 'node:path';
import {
  TARGETS,
  TargetName,
  buildManifest,
  BUILD_ARTIFACTS,
} from './manifest/targets';
import { buildEntryPlan } from './build-options';

/**
 * MV3 打包。
 *
 * 目标由 KNOWNMAP_TARGET 选择，默认 local。manifest 与 API 地址都在这里
 * 按目标生成，产物里没有运行时开关（4F）。
 */
const targetName = (process.env.KNOWNMAP_TARGET ?? 'local') as TargetName;
const target = TARGETS[targetName];
if (!target) {
  throw new Error(`未知构建目标 ${targetName}，可选：${Object.keys(TARGETS).join(' / ')}`);
}

const outDir = resolve(__dirname, `dist/${targetName}`);
const teacherUrl = `${target.teacherOrigin.replace(/\/$/, '')}/teacher/`;
const contentOnly = process.env.KNOWNMAP_CONTENT_BUILD === '1';
const entryPlan = buildEntryPlan(contentOnly, __dirname);

export default defineConfig({
  root: __dirname,
  define: {
    // 字面量替换，产物里看不到变量名
    __API_ORIGIN__: JSON.stringify(target.apiOrigin),
    __TEACHER_URL__: JSON.stringify(teacherUrl),
    __STUDENT_PLUGIN_DOWNLOAD_URL__: JSON.stringify(target.studentPluginDownloadUrl),
  },
  build: {
    outDir,
    emptyOutDir: entryPlan.emptyOutDir,
    // MV3 的 service worker 与 content script 不能是多 chunk，各自打成一个文件
    rollupOptions: {
      input: {
        ...entryPlan.input,
      },
      output: {
        entryFileNames: '[name].js',
        // 内容脚本单独构建时必须内联，service worker 与 HTML 入口可以分包。
        inlineDynamicImports: entryPlan.inlineDynamicImports,
        ...(contentOnly ? {} : { manualChunks: () => undefined }),
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
      preserveEntrySignatures: 'strict',
    },
  },
  plugins: [
    {
      name: 'knownmap-mv3-assets',
      closeBundle() {
        if (contentOnly) return;
        mkdirSync(resolve(outDir, 'content'), { recursive: true });
        mkdirSync(resolve(outDir, 'popup'), { recursive: true });
        mkdirSync(resolve(outDir, 'settings'), { recursive: true });
        mkdirSync(resolve(outDir, 'assets'), { recursive: true });
        cpSync(
          resolve(__dirname, 'assets/companion'),
          resolve(outDir, 'assets/companion'),
          { recursive: true }
        );
        copyFileSync(
          resolve(__dirname, '../web/shared/src/styles/tokens.css'),
          resolve(outDir, 'assets/tokens.css')
        );

        writeFileSync(
          resolve(outDir, 'manifest.json'),
          JSON.stringify(buildManifest(target), null, 2) + '\n'
        );
        copyFileSync(
          resolve(__dirname, 'content/window.css'),
          resolve(outDir, 'content/window.css')
        );
        /*
         * 原样拷贝会留下 src="./index.ts"，而产物是 index.js —— popup
         * 的脚本永远加载不到，页面白屏。构建成功不代表入口引用正确，
         * 这里把引用改成产物名。
         */
        const popupHtml = readFileSync(
          resolve(__dirname, 'popup/index.html'),
          'utf8'
        ).replace('./index.ts', './index.js');
        writeFileSync(resolve(outDir, 'popup/index.html'), popupHtml);
        copyFileSync(
          resolve(__dirname, 'popup/popup.css'),
          resolve(outDir, 'popup/popup.css')
        );
        const settingsHtml = readFileSync(
          resolve(__dirname, 'settings/index.html'),
          'utf8'
        ).replace('./index.ts', './index.js');
        writeFileSync(resolve(outDir, 'settings/index.html'), settingsHtml);
        copyFileSync(
          resolve(__dirname, 'settings/settings.css'),
          resolve(outDir, 'settings/settings.css')
        );
        for (const size of [16, 24, 48, 128]) {
          copyFileSync(
            resolve(__dirname, `assets/icon-${size}.png`),
            resolve(outDir, `assets/icon-${size}.png`)
          );
        }

        /*
         * 产物自检：manifest 与 HTML 引用的每个文件都必须真的存在。
         *
         * popup 曾因为 HTML 里还写着 ./index.ts 而永久白屏，构建照样成功。
         * 构建成功不代表引用解析得到，所以在这里当场核对。
         */
        const manifest = buildManifest(target) as {
          background: { service_worker: string };
          content_scripts: { js: string[]; css: string[] }[];
          action: {
            default_popup: string;
            default_icon: Record<string, string>;
          };
          icons: Record<string, string>;
        };

        const referenced = [
          manifest.background.service_worker,
          ...manifest.content_scripts.flatMap((s) => [...s.js, ...s.css]),
          manifest.action.default_popup,
          ...Object.values(manifest.action.default_icon),
          ...Object.values(manifest.icons),
          ...BUILD_ARTIFACTS.filter((path) => path.startsWith('assets/companion/')),
          // HTML 自己引用的资源
          ...[...popupHtml.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(
            (m) => `popup/${m[1]}`
          ),
          ...[...settingsHtml.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(
            (m) => `settings/${m[1]}`
          ),
        ];

        const missing = referenced.filter(
          (path) => !existsSync(resolve(outDir, path))
        );
        if (missing.length > 0) {
          throw new Error(
            `产物缺少被引用的文件：${missing.join('、')}。` +
            '构建成功不代表引用正确，请检查 manifest 与 HTML 的路径。'
          );
        }

        // 示例课程必须进入真正的 service worker 产物，而不是只存在于源码或 popup 文案。
        const backgroundBundle = readFileSync(
          resolve(outDir, manifest.background.service_worker),
          'utf8'
        );
        for (const marker of [
          '1dfaf2f0-f826-46e8-afdb-89e2d0468a22',
          'BV1WW4y1e7GL',
          'example-overview',
        ]) {
          if (!backgroundBundle.includes(marker)) {
            throw new Error(`示例课程没有进入 service worker 产物：${marker}`);
          }
        }
      },
    },
  ],
});
