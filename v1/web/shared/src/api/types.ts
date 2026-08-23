/**
 * v1 Web 应用共用类型定义
 * 不包含 role-specific 权限决定
 */

export interface RequestContext {
  requestId: string;
  timestamp: number;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ErrorType =
  | 'ClientError'      // 4xx
  | 'ServerError'      // 5xx
  | 'NetworkError'     // Connection, timeout
  | 'ValidationError'  // Input validation
  | 'UnknownError';

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
