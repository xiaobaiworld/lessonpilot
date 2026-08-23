/** 错误分类。只保留 client.ts 实际会产生的三种。 */
export type ErrorType = 'ClientError' | 'ServerError' | 'NetworkError' | 'UnknownError';

export class APIError extends Error {
  constructor(
    public readonly type: ErrorType,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
    message?: string
  ) {
    super(message || type);
    this.name = 'APIError';
  }
}
