import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /*
     * 只跑 v1 自己的测试。
     * 仓库根的 tests/*.test.js 是旧系统的 node:test 套件，继续由
     * 根目录的 npm test（node --test）执行；两个 runner 不交叉。
     */
    include: ['web/**/*.test.ts', 'web/**/*.test.tsx', 'extension/**/*.test.ts', 'contracts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
