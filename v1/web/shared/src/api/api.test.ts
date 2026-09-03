import { describe, it, expect, vi, afterEach } from 'vitest';
import { APIClient } from './client';
import { APIError } from './types';
import { errorMessage } from './errors';

const stub = (init: ResponseInit, body: unknown = {}) =>
  vi.fn().mockResolvedValue(
    new Response(init.status === 204 ? null : JSON.stringify(body), init)
  );

afterEach(() => vi.unstubAllGlobals());

describe('APIClient', () => {
  it('带上 Cookie，因为会话是 HttpOnly 的', async () => {
    const f = stub({ status: 200 }, { ok: true });
    vi.stubGlobal('fetch', f);

    await new APIClient('http://x').get('/a');

    expect(f.mock.calls[0][1].credentials).toBe('include');
  });

  it('4xx 归为 ClientError 并带上后端的 detail', async () => {
    vi.stubGlobal('fetch', stub({ status: 400 }, { detail: '登录名已存在' }));

    const err = await new APIClient('http://x')
      .post('/a', {})
      .catch((e) => e as APIError);

    expect(err).toBeInstanceOf(APIError);
    expect((err as APIError).type).toBe('ClientError');
    expect((err as APIError).message).toBe('登录名已存在');
  });

  it('5xx 归为 ServerError', async () => {
    vi.stubGlobal('fetch', stub({ status: 500 }));

    const err = await new APIClient('http://x').get('/a').catch((e) => e as APIError);

    expect((err as APIError).type).toBe('ServerError');
  });

  it('网络失败归为 NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));

    const err = await new APIClient('http://x').get('/a').catch((e) => e as APIError);

    expect((err as APIError).type).toBe('NetworkError');
  });

  it('204 不尝试解析 JSON', async () => {
    vi.stubGlobal('fetch', stub({ status: 204 }));

    await expect(new APIClient('http://x').delete('/a')).resolves.toBeUndefined();
  });

  it('支持课程包二进制下载和 multipart 二进制响应', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('package-bytes', { status: 200 }))
      .mockResolvedValueOnce(new Response('package-bytes', { status: 200 }));
    vi.stubGlobal('fetch', f);

    const client = new APIClient('http://x');
    const downloaded = await client.getBlob('/package');
    expect(await downloaded.text()).toBe('package-bytes');
    const form = new FormData();
    form.append('file', new Blob(['package-bytes']), 'course.kmcourse');
    const imported = await client.postFormBlob('/package/import', form);
    expect(await imported.text()).toBe('package-bytes');
    expect(f.mock.calls[1][1].body).toBe(form);
  });

  it('超时归为 NetworkError 且文案可读', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, o: RequestInit) =>
        new Promise((_res, rej) =>
          o.signal?.addEventListener('abort', () =>
            rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          )
        )
      )
    );

    const err = await new APIClient('http://x', 10)
      .get('/a')
      .catch((e) => e as APIError);

    expect((err as APIError).type).toBe('NetworkError');
    expect((err as APIError).message).toBe('请求超时');
  });
});

describe('errorMessage', () => {
  it('优先用后端给的业务提示', () => {
    expect(errorMessage(new APIError('ClientError', 409, undefined, '登录名已存在'))).toBe(
      '登录名已存在'
    );
  });

  it('没有提示时给通用文案，不暴露内部类型名', () => {
    expect(errorMessage(new APIError('ClientError', 400))).toBe('请求被拒绝，请检查输入');
  });

  it('每种错误都有中文文案', () => {
    expect(errorMessage(new APIError('ServerError', 500))).toBe('服务出错，请稍后重试');
    expect(errorMessage(new APIError('NetworkError'))).toBe('无法连接服务，请检查网络');
    expect(errorMessage(new Error('boom'))).toBe('发生未知错误，请重试');
  });
});
