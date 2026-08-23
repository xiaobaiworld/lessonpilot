import React, { useEffect, useState } from 'react';

export interface SuccessToastProps {
  message: string;
  duration?: number;
  onClose?: () => void;
}

export const SuccessToast: React.FC<SuccessToastProps> = ({ message, duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-md p-4 flex items-center gap-3">
      <span className="text-green-600">✓</span>
      <p className="text-green-800">{message}</p>
    </div>
  );
};
