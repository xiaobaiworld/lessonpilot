import React from 'react';
import { APIError } from '../api/types';
import { ErrorHandler } from '../api/errors';

export interface ErrorBannerProps {
  error: APIError | Error | null;
  onDismiss?: () => void;
}

/** 错误提示。用原样式表的 .field-error */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  if (!error) return null;

  return (
    <p className="field-error" role="alert">
      {ErrorHandler.getDisplayMessage(error)}
      {onDismiss && (
        <>
          {' '}
          <button className="text-button" type="button" onClick={onDismiss}>
            关闭
          </button>
        </>
      )}
    </p>
  );
};
