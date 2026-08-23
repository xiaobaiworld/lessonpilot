import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  /*
   * 资源用相对路径。默认的 base '/' 会生成 /assets/... 这类站点根绝对
   * 路径，而应用挂在 /admin/ 或 /teacher/ 下，发布出去就是白屏。
   * dev server 挂在根路径，所以这个问题本机测不出来。
   */
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // 子路径别名要排在前面，否则被前缀规则吞掉
      '@v1/web/shared/editor': path.resolve(__dirname, '../shared/src/editor'),
      '@v1/web/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
