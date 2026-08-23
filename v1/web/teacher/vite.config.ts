import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  plugins: [react()],
  server: {
    port: 5174,
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
