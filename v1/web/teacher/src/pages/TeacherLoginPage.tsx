import React, { useState } from 'react';
import { ErrorBanner, LoadingSpinner, SuccessToast } from '@v1/web/shared';
import { useTeacherStore } from '../store';
import { TeacherAPI } from '../api';

interface TeacherLoginPageProps {
  api: TeacherAPI;
  onLoginSuccess: () => void;
}

export const TeacherLoginPage: React.FC<TeacherLoginPageProps> = ({
  api,
  onLoginSuccess,
}) => {
  const { setSession } = useTeacherStore();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await api.login(loginName, password);
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
        <h1 className="text-2xl font-bold text-center mb-2">KnownMap</h1>
        <p className="text-center text-gray-600 mb-6 text-sm">互动课程工具</p>

        {error && (
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              登录名
            </label>
            <input
              type="text"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
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
