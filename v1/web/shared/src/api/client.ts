import { APIError } from './types';

/**
 * FastAPI 的 422 明细是 [{ loc, msg }]，只显示 msg 的话老师不知道该改哪个字段。
 * loc 形如 ["body","config","nodes",0,"choice","evaluation","explanation"]，
 * 取里面的数字下标和最后一个字段名，拼成「第 1 个节点的 explanation：文本不能为空」。
 */
function validationMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail;
  if (!Array.isArray(detail) || detail.length === 0) return undefined;

  return detail
    .slice(0, 3)
    .map((item) => {
      const loc: unknown[] = Array.isArray(item?.loc) ? item.loc : [];
      const index = loc.find((p) => typeof p === 'number');
      const field = [...loc].reverse().find((p) => typeof p === 'string');
      const where =
        index === undefined ? '' : `第 ${(index as number) + 1} 个节点`;
      const what = field ? `${where ? '的 ' : ''}${field}` : '';
      const prefix = where + what;
      return prefix ? `${prefix}：${item.msg}` : String(item.msg);
    })
    .join('；');
}

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
          data?.error?.code,
          data?.error?.message ?? validationMessage(data?.detail)
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
        aborted ? '请求超时' : undefined
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
