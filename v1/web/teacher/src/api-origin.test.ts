import { describe, expect, it } from 'vitest';
import { getTeacherApiOrigin } from './api-origin';

describe('getTeacherApiOrigin', () => {
  it('本地开发时使用同源请求，让 Vite 代理保持 Cookie 主机一致', () => {
    expect(
      getTeacherApiOrigin({
        hostname: 'localhost',
        origin: 'http://localhost:5174',
      })
    ).toBe('');
  });

  it('生产环境使用当前页面的同源地址', () => {
    expect(
      getTeacherApiOrigin({
        hostname: 'teacher.example.com',
        origin: 'https://teacher.example.com',
      })
    ).toBe('https://teacher.example.com');
  });
});
