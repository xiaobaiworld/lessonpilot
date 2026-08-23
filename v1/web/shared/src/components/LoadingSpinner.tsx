import React from 'react';

export interface LoadingSpinnerProps {
  message?: string;
}

/** 加载态。用原样式表的 .table-state 外观，保持视觉一致 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = '正在加载',
}) => (
  <p className="table-state" role="status">
    {message}…
  </p>
);
