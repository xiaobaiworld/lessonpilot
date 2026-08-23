import React from 'react';
import { APIError } from '../api/types';

export interface ErrorBannerProps {
  error: APIError | null;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss }) => {
  if (!error) return null;

  const message = error.message || '发生错误';

  return (
    <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-md p-4">
      <div>
        <p className="text-red-800 font-medium">{message}</p>
        {error.details && (
          <p className="text-red-700 text-sm mt-1">{JSON.stringify(error.details)}</p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-500 hover:text-red-700"
        >
          ✕
        </button>
      )}
    </div>
  );
};
