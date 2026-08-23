import React, { useState } from 'react';
import { ErrorBanner, LoadingSpinner, SuccessToast, ErrorHandler } from '@v1/web/shared';
import { useAdminStore } from './store';
import { AdminAPI } from './api';

interface AdminLoginPageProps {
  api: AdminAPI;
  onLoginSuccess: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ api, onLoginSuccess }) => {
  const { setSession } = useAdminStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await api.login(email, password);
      setSession(session);
      setSuccess(true);
      setTimeout(onLoginSuccess, 1500);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('登录失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-center mb-6">超级管理员登录</h1>

        {error && (
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? <LoadingSpinner size="sm" /> : '登录'}
          </button>
        </form>

        {success && (
          <SuccessToast message="登录成功！" onClose={() => setSuccess(false)} />
        )}
      </div>
    </div>
  );
};
