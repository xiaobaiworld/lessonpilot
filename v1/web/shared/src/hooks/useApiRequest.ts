/**
 * useApiRequest: 通用 API 请求 hook
 *
 * 管理 loading / error / data 三态，并把错误统一成 APIError。
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { APIError, ErrorHandler } from '../api';

export interface UseApiRequestState<T> {
  data: T | null;
  loading: boolean;
  error: APIError | null;
}

export interface UseApiRequestOptions {
  onSuccess?: () => void;
  onError?: (error: APIError) => void;
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

  /*
   * 回调放进 ref。
   *
   * 调用方通常写 useApiRequest({ onError: ... })，每次渲染都是新对象；
   * 如果让 execute 依赖 options，execute 的身份就会每帧变化，而调用方
   * 又普遍把 execute 放进 useEffect 依赖数组 —— 于是 effect 每帧重跑、
   * setState 每帧触发，React 报 "Maximum update depth exceeded"。
   *
   * 用 ref 承接回调后，execute 的依赖为空，身份在组件生命周期内稳定，
   * 同时回调始终读到最新值。
   */
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  /*
   * 卸载后不再 setState，避免请求返回时写入已销毁的组件。
   *
   * 必须在 effect 体里重新置 true：React 18 StrictMode 开发期会故意
   * mount → unmount → remount，只在清理里置 false 会让 ref 永久停在
   * false，之后所有 setState 被跳过，界面卡在 loading。
   */
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T | void> => {
    setState({ data: null, loading: true, error: null });

    try {
      const result = await fn();
      if (!mountedRef.current) return result;
      setState({ data: result, loading: false, error: null });
      optionsRef.current.onSuccess?.();
      return result;
    } catch (err) {
      const error =
        err instanceof APIError
          ? err
          : new APIError('UnknownError', undefined, undefined, (err as Error)?.message);
      if (!mountedRef.current) return;
      setState({ data: null, loading: false, error });
      optionsRef.current.onError?.(error);
    }
  }, []);

  const retry = useCallback(
    async (fn: () => Promise<T>): Promise<T | void> => {
      if (!state.error || !ErrorHandler.isRetryable(state.error)) return;
      return execute(fn);
    },
    [state.error, execute]
  );

  return { ...state, execute, reset, retry };
}
