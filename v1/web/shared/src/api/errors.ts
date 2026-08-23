/**
 * 错误分类和处理工具
 */

import { APIError, ErrorType } from './types';

export class ErrorHandler {
  static classify(error: unknown): ErrorType {
    if (error instanceof APIError) {
      return error.type;
    }

    if (error instanceof TypeError) {
      return 'NetworkError';
    }

    if (error instanceof Error && error.message === 'Request timeout') {
      return 'NetworkError';
    }

    return 'UnknownError';
  }

  static getDisplayMessage(error: unknown): string {
    if (error instanceof APIError) {
      switch (error.type) {
        case 'ClientError':
          return error.message || '请求参数错误';
        case 'ServerError':
          return '服务器出错，请稍后重试';
        case 'NetworkError':
          return '网络连接失败，请检查网络';
        case 'ValidationError':
          return '输入数据验证失败';
        default:
          return '发生未知错误';
      }
    }

    return '发生未知错误';
  }

  static isRetryable(error: unknown): boolean {
    if (!(error instanceof APIError)) {
      return false;
    }

    // 5xx 和网络错误可重试
    return error.type === 'ServerError' || error.type === 'NetworkError';
  }

  static isAuthError(error: unknown): boolean {
    if (!(error instanceof APIError)) {
      return false;
    }

    return error.statusCode === 401 || error.statusCode === 403;
  }
}
