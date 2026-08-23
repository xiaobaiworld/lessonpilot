/**
 * v1 Web 应用 HTTP 客户端
 * 职责：
 * - 请求 ID 注入和追踪
 * - 超时和重试机制
 * - 错误分类
 * - 响应拦截
 */

import { APIError, APIResponse, ErrorType, RequestContext } from './types';

export interface ClientConfig {
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function classifyError(status: number): ErrorType {
  if (status >= 400 && status < 500) return 'ClientError';
  if (status >= 500) return 'ServerError';
  return 'UnknownError';
}

export class APIClient {
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: ClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  private createContext(): RequestContext {
    return {
      requestId: generateRequestId(),
      timestamp: Date.now(),
    };
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    context: RequestContext,
    retryCount: number = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'X-Request-ID': context.requestId,
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      // 5xx 错误且未超过重试次数，重试
      if (response.status >= 500 && retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return this.fetchWithRetry(url, options, context, retryCount + 1);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new APIError('NetworkError', undefined, undefined, 'Request timeout');
      }

      // 网络错误，重试
      if (retryCount < this.maxRetries && !(error instanceof APIError)) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return this.fetchWithRetry(url, options, context, retryCount + 1);
      }

      throw error;
    }
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: { body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const context = this.createContext();
    const url = `${this.baseURL}${path}`;

    const response = await this.fetchWithRetry(
      url,
      {
        method,
        headers: options.headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
      context
    );

    if (!response.ok) {
      const errorType = classifyError(response.status);
      let errorData;

      try {
        errorData = await response.json();
      } catch {
        // 无法解析响应体，使用默认错误
      }

      throw new APIError(
        errorType,
        response.status,
        errorData?.error?.details,
        errorData?.error?.message
      );
    }

    try {
      const data = await response.json();
      return data;
    } catch {
      throw new APIError('ServerError', 500, undefined, 'Invalid JSON response');
    }
  }

  async get<T = unknown>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, { headers });
  }

  async post<T = unknown>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('POST', path, { body, headers });
  }

  async put<T = unknown>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('PUT', path, { body, headers });
  }

  async delete<T = unknown>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', path, { headers });
  }
}

// 工厂函数
export function createAPIClient(baseURL: string): APIClient {
  return new APIClient({ baseURL });
}
