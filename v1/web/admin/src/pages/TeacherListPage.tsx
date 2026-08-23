import React, { useEffect, useState } from 'react';
import { LoadingSpinner, ErrorBanner, useApiRequest } from '@v1/web/shared';
import { useAdminStore } from './store';
import { AdminAPI } from './api';
import { Teacher } from './store';

interface TeacherListPageProps {
  api: AdminAPI;
  onLogout: () => void;
  onCreateTeacher: () => void;
}

export const TeacherListPage: React.FC<TeacherListPageProps> = ({
  api,
  onLogout,
  onCreateTeacher,
}) => {
  const { session, teachers, setTeachers } = useAdminStore();
  const { loading, error, execute } = useApiRequest<Teacher[]>();

  useEffect(() => {
    if (session) {
      execute(() => api.getTeachers(session.token)).then((data) => {
        if (data) setTeachers(data);
      });
    }
  }, [session, api, setTeachers, execute]);

  if (!session) {
    return <div>未登录</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">教师账号管理</h1>
          <div className="space-x-2">
            <button
              onClick={onCreateTeacher}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              创建教师
            </button>
            <button
              onClick={onLogout}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            >
              退出
            </button>
          </div>
        </div>
      </div>

      {/* 内容 */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && <ErrorBanner error={error} />}

        {loading ? (
          <LoadingSpinner message="加载教师列表..." />
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    登录名
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    显示名称
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    已发布课程
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm">{teacher.login_name}</td>
                    <td className="px-6 py-3 text-sm">{teacher.display_name}</td>
                    <td className="px-6 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          teacher.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {teacher.status === 'active' ? '活跃' : '停用'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">{teacher.published_course_count}</td>
                    <td className="px-6 py-3 text-sm space-x-2">
                      <button className="text-blue-600 hover:underline">重置密码</button>
                      <button className="text-red-600 hover:underline">
                        {teacher.status === 'active' ? '停用' : '恢复'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {teachers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                暂无教师记录
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
