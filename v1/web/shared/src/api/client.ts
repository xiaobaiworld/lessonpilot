/**
 * v1 Web 应用 HTTP 客户端
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

export class APIClient {
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: ClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const requestId = generateRequestId();

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...(headers || {}),
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await Promise.race([
        fetch(url, options),
        new Promise<Response>((_, reject) =>
          setTimeout(
            () => reject(new Error('Request timeout')),
            this.timeout
          )
        ),
      ]);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new APIError(
          response.status >= 500 ? 'ServerError' : 'ClientError',
          response.status,
          data
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError('NetworkError', undefined, {}, (error as Error).message);
    }
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, headers);
  }

  async post<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('POST', path, body, headers);
  }

  async put<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('PUT', path, body, headers);
  }

  async delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', path, undefined, headers);
  }
}

// 工厂函数
export function createAPIClient(baseURL: string): APIClient {
  return new APIClient({ baseURL });
}
