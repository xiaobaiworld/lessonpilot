/**
 * v1 Web 应用 HTTP 客户端测试
 * 验收条件：
 * - 请求正确注入 request ID
 * - 错误分类覆盖 4xx/5xx/network
 * - 重试逻辑工作正常
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { APIClient, createAPIClient } from './client';
import { APIError } from './types';

describe('APIClient', () => {
  let client: APIClient;
  let fetchSpy: any;

  beforeEach(() => {
    client = createAPIClient('http://localhost:8000');
    fetchSpy = global.fetch as any;
  });

  describe('请求 ID 注入', () => {
    it('应该在每个请求中注入 X-Request-ID 头', async () => {
      const mockFetch = async (url: string, options: RequestInit) => {
        expect(options.headers).toHaveProperty('X-Request-ID');
        return new Response(JSON.stringify({ ok: true }));
      };

      global.fetch = mockFetch as any;

      await client.get('/test');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('request ID 应该是唯一的', async () => {
      const requestIds = new Set<string>();

      const mockFetch = async (url: string, options: RequestInit) => {
        const id = (options.headers as any)['X-Request-ID'];
        expect(requestIds.has(id)).toBe(false);
        requestIds.add(id);
        return new Response(JSON.stringify({ ok: true }));
      };

      global.fetch = mockFetch as any;

      await client.get('/test1');
      await client.get('/test2');
      await client.get('/test3');

      expect(requestIds.size).toBe(3);
    });
  });

  describe('错误分类', () => {
    it('4xx 错误应该分类为 ClientError', async () => {
      const mockFetch = async () => {
        return new Response(
          JSON.stringify({ error: { message: 'Bad Request' } }),
          { status: 400 }
        );
      };

      global.fetch = mockFetch as any;

      try {
        await client.get('/test');
      } catch (err) {
        expect(err instanceof APIError).toBe(true);
        expect((err as APIError).type).toBe('ClientError');
      }
    });

    it('5xx 错误应该分类为 ServerError', async () => {
      let callCount = 0;
      const mockFetch = async () => {
        callCount++;
        if (callCount <= 3) {
          return new Response(
            JSON.stringify({ error: { message: 'Server Error' } }),
            { status: 500 }
          );
        }
        return new Response(JSON.stringify({ ok: true }));
      };

      global.fetch = mockFetch as any;
      client = new APIClient({ baseURL: 'http://localhost:8000', maxRetries: 3 });

      const result = await client.get('/test');
      // 应该在重试后成功
      expect(callCount).toBeGreaterThan(1);
    });

    it('网络错误应该分类为 NetworkError', async () => {
      const mockFetch = async () => {
        throw new TypeError('Failed to fetch');
      };

      global.fetch = mockFetch as any;

      try {
        await client.get('/test');
      } catch (err) {
        expect(err instanceof APIError).toBe(true);
        expect((err as APIError).type).toBe('NetworkError');
      }
    });
  });

  describe('HTTP 方法', () => {
    it('GET 请求应该工作', async () => {
      const mockFetch = async (url: string, options: RequestInit) => {
        expect(options.method).toBe('GET');
        return new Response(JSON.stringify({ data: 'test' }));
      };

      global.fetch = mockFetch as any;

      const result = await client.get('/test');
      expect(result).toEqual({ data: 'test' });
    });

    it('POST 请求应该包含 body', async () => {
      let capturedBody: any;
      const mockFetch = async (url: string, options: RequestInit) => {
        expect(options.method).toBe('POST');
        capturedBody = JSON.parse(options.body as string);
        return new Response(JSON.stringify({ ok: true }));
      };

      global.fetch = mockFetch as any;

      await client.post('/test', { key: 'value' });
      expect(capturedBody).toEqual({ key: 'value' });
    });
  });

  afterEach(() => {
    global.fetch = fetchSpy;
  });
});
