import React, { useEffect } from 'react';
import { LoadingSpinner, useApiRequest, ErrorBanner } from '@v1/web/shared';
import { useTeacherStore } from '../store';
import { TeacherAPI } from '../api';
import { Course } from '../store';

interface TeacherHomePageProps {
  api: TeacherAPI;
  onSelectCourse: (courseId: string) => void;
  onCreateCourse: () => void;
  onLogout: () => void;
}

export const TeacherHomePage: React.FC<TeacherHomePageProps> = ({
  api,
  onSelectCourse,
  onCreateCourse,
  onLogout,
}) => {
  const { session, courses, setCourses } = useTeacherStore();
  const { loading, error, execute } = useApiRequest<Course[]>();

  useEffect(() => {
    if (session) {
      execute(() => api.getCourses(session.token)).then((data) => {
        if (data) setCourses(data);
      });
    }
  }, [session, api, setCourses, execute]);

  if (!session) {
    return <div>未登录</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">我的课程</h1>
          <div className="space-x-2">
            <button
              onClick={onCreateCourse}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              新建课程
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
          <LoadingSpinner message="加载课程..." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                onClick={() => onSelectCourse(course.id)}
                className="bg-white rounded-lg shadow hover:shadow-lg cursor-pointer transition p-6"
              >
                <h3 className="text-lg font-bold mb-2">{course.title}</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>课节数: {course.lessons.length}</p>
                  <p>状态: {course.status === 'draft' ? '草稿' : '已发布'}</p>
                  <p>已发布: {course.published_count} 版本</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && courses.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-4">还没有课程</p>
            <button
              onClick={onCreateCourse}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              创建第一个课程
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
