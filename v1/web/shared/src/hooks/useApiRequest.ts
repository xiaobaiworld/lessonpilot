/**
 * useApiRequest: 通用 API 请求 hook
 * 职责：
 * - 管理 loading、error、data 状态
 * - 自动重试逻辑
 * - 错误分类和显示
 */

import { useState, useCallback } from 'react';
import { APIError, ErrorHandler } from '../api';

export interface UseApiRequestState<T> {
  data: T | null;
  loading: boolean;
  error: APIError | null;
}

export interface UseApiRequestOptions {
  onSuccess?: () => void;
  onError?: (error: APIError) => void;
  autoRetry?: boolean;
}

export function useApiRequest<T = unknown>(
  options: UseApiRequestOptions = {}
): UseApiRequestState<T> & {
  execute: (fn: () => Promise<T>) => Promise<T | void>;
  reset: () => void;
  retry: (fn: () => Promise<T>) => Promise<T | void>;
} {
  const [state, setState] = useState<UseApiRequestState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T | void> => {
      setState({ data: null, loading: true, error: null });

      try {
        const result = await fn();
        setState({ data: result, loading: false, error: null });
        options.onSuccess?.();
        return result;
      } catch (err) {
        const error = err instanceof APIError ? err : new APIError('UnknownError');
        setState(prev => ({ ...prev, loading: false, error }));
        options.onError?.(error);
      }
    },
    [options]
  );

  const retry = useCallback(
    async (fn: () => Promise<T>): Promise<T | void> => {
      if (!state.error || !ErrorHandler.isRetryable(state.error)) {
        return;
      }
      return execute(fn);
    },
    [state.error, execute]
  );

  return { ...state, execute, reset, retry };
}
