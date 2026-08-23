import { defineConfig } from 'vite';
import { writeFileSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TARGETS, TargetName, buildManifest } from './manifest/targets';

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

export default defineConfig({
  root: __dirname,
  define: {
    // 字面量替换，产物里看不到变量名
    __API_ORIGIN__: JSON.stringify(target.apiOrigin),
  },
  build: {
    outDir,
    emptyOutDir: true,
    // MV3 的 service worker 与 content script 不能是多 chunk，各自打成一个文件
    rollupOptions: {
      input: {
        'background/service-worker': resolve(__dirname, 'background/service-worker.ts'),
        'content/index': resolve(__dirname, 'content/index.ts'),
        'popup/index': resolve(__dirname, 'popup/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        // 不做 code splitting：content script 无法 import chunk
        inlineDynamicImports: false,
        manualChunks: () => undefined,
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
        mkdirSync(resolve(outDir, 'content'), { recursive: true });
        mkdirSync(resolve(outDir, 'popup'), { recursive: true });

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
      },
    },
  ],
});
