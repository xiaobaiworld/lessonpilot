import React, { useState } from 'react';
import { LoadingSpinner, ErrorBanner } from '@v1/web/shared';
import { useAdminStore } from './store';
import { AdminAPI } from './api';

interface CreateTeacherPageProps {
  api: AdminAPI;
  onBack: () => void;
  onSuccess: () => void;
}

export const CreateTeacherPage: React.FC<CreateTeacherPageProps> = ({
  api,
  onBack,
  onSuccess,
}) => {
  const { session, addTeacher, setTemporaryPassword } = useAdminStore();
  const [loginName, setLoginName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.createTeacher(session.token, loginName, displayName);

      // 显示临时密码
      setTemporaryPassword(response.temporary_password);

      // 添加到列表
      addTeacher({
        id: response.teacher_id,
        login_name: response.login_name,
        display_name: displayName,
        status: 'active',
        created_at: new Date().toISOString(),
        published_course_count: 0,
      });

      // 重置表单
      setLoginName('');
      setDisplayName('');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('创建失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="text-blue-600 hover:underline mb-6"
        >
          ← 返回
        </button>

        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold mb-6">创建新教师</h1>

          {error && <ErrorBanner error={error} onDismiss={() => setError(null)} />}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                登录名
              </label>
              <input
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                显示名称
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? <LoadingSpinner size="sm" /> : '创建'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
