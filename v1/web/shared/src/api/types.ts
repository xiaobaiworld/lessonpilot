/** 错误分类。只保留 client.ts 实际会产生的四种。 */
export type ErrorType = 'ClientError' | 'ServerError' | 'NetworkError' | 'UnknownError';

export class APIError extends Error {
  constructor(
    public readonly type: ErrorType,
    public readonly statusCode?: number,
    /** 后端的业务错误码，如 DRAFT_NOT_FOUND。用来区分"正常的空"和"真的错" */
    public readonly code?: string,
    message?: string
  ) {
    super(message || type);
    this.name = 'APIError';
  }
}
