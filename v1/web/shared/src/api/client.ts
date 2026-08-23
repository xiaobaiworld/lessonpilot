import { APIError } from './types';

/**
 * HTTP 客户端。
 *
 * 只做四件事：拼 URL、带 Cookie、超时、把非 2xx 转成 APIError。
 * 不做自动重试 —— 教师端的操作都是有意识的单次动作（登录、发布、创建
 * 授权码），静默重试会让用户多等几秒且可能重复提交。
 */
export class APIClient {
  constructor(
    private baseURL: string,
    private timeoutMs = 15000
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseURL}${path}`, {
        method,
        signal: controller.signal,
        // 会话走 HttpOnly Cookie，不在前端持有 token
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new APIError(
          res.status >= 500 ? 'ServerError' : 'ClientError',
          res.status,
          data ?? undefined,
          data?.detail ?? data?.error?.message
        );
      }

      // 204 等无内容响应
      return res.status === 204 ? (undefined as T) : await res.json();
    } catch (err) {
      if (err instanceof APIError) throw err;
      const aborted = err instanceof Error && err.name === 'AbortError';
      throw new APIError(
        'NetworkError',
        undefined,
        undefined,
        aborted ? '请求超时' : (err as Error)?.message
      );
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body ?? {});
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body ?? {});
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}
