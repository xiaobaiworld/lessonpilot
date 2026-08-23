/**
 * 错误处理测试
 */

import { describe, it, expect } from 'vitest';
import { APIError, ErrorHandler } from './errors';
import { ErrorType } from './types';

describe('ErrorHandler', () => {
  describe('分类', () => {
    it('应该正确分类 APIError', () => {
      const error = new APIError('ClientError', 400);
      expect(ErrorHandler.classify(error)).toBe('ClientError');
    });

    it('应该分类 TypeError 为 NetworkError', () => {
      const error = new TypeError('fetch failed');
      expect(ErrorHandler.classify(error)).toBe('NetworkError');
    });

    it('应该分类其他错误为 UnknownError', () => {
      const error = new Error('unknown');
      expect(ErrorHandler.classify(error)).toBe('UnknownError');
    });
  });

  describe('显示消息', () => {
    it('ClientError 应该返回请求参数错误', () => {
      const error = new APIError('ClientError', 400);
      expect(ErrorHandler.getDisplayMessage(error)).toBe('请求参数错误');
    });

    it('ServerError 应该返回服务器错误提示', () => {
      const error = new APIError('ServerError', 500);
      expect(ErrorHandler.getDisplayMessage(error)).toBe('服务器出错，请稍后重试');
    });

    it('NetworkError 应该返回网络错误提示', () => {
      const error = new APIError('NetworkError');
      expect(ErrorHandler.getDisplayMessage(error)).toBe('网络连接失败，请检查网络');
    });
  });

  describe('重试判定', () => {
    it('ServerError 应该是可重试的', () => {
      const error = new APIError('ServerError', 500);
      expect(ErrorHandler.isRetryable(error)).toBe(true);
    });

    it('NetworkError 应该是可重试的', () => {
      const error = new APIError('NetworkError');
      expect(ErrorHandler.isRetryable(error)).toBe(true);
    });

    it('ClientError 不应该是可重试的', () => {
      const error = new APIError('ClientError', 400);
      expect(ErrorHandler.isRetryable(error)).toBe(false);
    });
  });

  describe('认证错误判定', () => {
    it('401 应该被识别为认证错误', () => {
      const error = new APIError('ClientError', 401);
      expect(ErrorHandler.isAuthError(error)).toBe(true);
    });

    it('403 应该被识别为认证错误', () => {
      const error = new APIError('ClientError', 403);
      expect(ErrorHandler.isAuthError(error)).toBe(true);
    });

    it('400 不应该被识别为认证错误', () => {
      const error = new APIError('ClientError', 400);
      expect(ErrorHandler.isAuthError(error)).toBe(false);
    });
  });
});
