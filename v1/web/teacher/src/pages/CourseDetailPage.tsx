import React, { useEffect } from 'react';
import { LoadingSpinner, useApiRequest, ErrorBanner } from '@v1/web/shared';
import { useTeacherStore } from '../store';
import { TeacherAPI } from '../api';
import { Course } from '../store';

interface CourseDetailPageProps {
  api: TeacherAPI;
  courseId: string;
  onEditLesson: (lessonId: string) => void;
  onBack: () => void;
}

export const CourseDetailPage: React.FC<CourseDetailPageProps> = ({
  api,
  courseId,
  onEditLesson,
  onBack,
}) => {
  const { session, updateCourse } = useTeacherStore();
  const { loading, error, execute } = useApiRequest<Course>();

  useEffect(() => {
    if (session) {
      execute(() => api.getCourse(session.token, courseId)).then((data) => {
        if (data) updateCourse(data);
      });
    }
  }, [courseId, session, api, updateCourse, execute]);

  if (!session) {
    return <div>未登录</div>;
  }

  const store = useTeacherStore();
  const course = store.courses.find((c) => c.id === courseId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <button onClick={onBack} className="text-blue-600 hover:underline mb-4">
            ← 返回
          </button>
          <h1 className="text-2xl font-bold">{course?.title}</h1>
        </div>
      </div>

      {/* 内容 */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && <ErrorBanner error={error} />}

        {loading ? (
          <LoadingSpinner message="加载课程详情..." />
        ) : (
          course && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium">顺序</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">课节名称</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">节点数</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {course.lessons.map((lesson) => (
                    <tr key={lesson.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm">{lesson.sequence}</td>
                      <td className="px-6 py-3 text-sm">{lesson.title}</td>
                      <td className="px-6 py-3 text-sm">{lesson.node_count}</td>
                      <td className="px-6 py-3 text-sm space-x-2">
                        <button
                          onClick={() => onEditLesson(lesson.id)}
                          className="text-blue-600 hover:underline"
                        >
                          编辑
                        </button>
                        <button className="text-gray-600 hover:underline">删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {course.lessons.length === 0 && (
                <div className="text-center py-8 text-gray-500">暂无课节</div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};
