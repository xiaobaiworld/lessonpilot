import React, { useEffect } from 'react';
import {
  Topbar,
  SectionHead,
  EmptyState,
  LoadingSpinner,
  ErrorBanner,
  useApiRequest,
} from '@v1/web/shared';
import { useTeacherStore, Course } from '../store';
import { TeacherAPI } from '../api';

interface CourseDetailPageProps {
  api: TeacherAPI;
  courseId: string;
  onEditLesson: (lessonId: string) => void;
  onBack: () => void;
  onLogout: () => void;
  onPublish: () => void;
}

export const CourseDetailPage: React.FC<CourseDetailPageProps> = ({
  api,
  courseId,
  onEditLesson,
  onBack,
  onLogout,
  onPublish,
}) => {
  // 所有 hook 必须在任何 return 之前调用
  const { session, courses, updateCourse } = useTeacherStore();
  const { loading, error, execute } = useApiRequest<Course>();

  useEffect(() => {
    if (!session) return;
    execute(() => api.getCourse(session.token, courseId)).then((data) => {
      if (data) updateCourse(data);
    });
  }, [courseId, session, api, updateCourse, execute]);

  if (!session) return null;

  const course = courses.find((c) => c.id === courseId);
  // 课节按 sequence 显式排序，不依赖后端返回顺序
  const lessons = course ? [...course.lessons].sort((a, b) => a.sequence - b.sequence) : [];

  return (
    <div className="app-shell">
      <Topbar
        subtitle="互动课程工具"
        account={session.loginName}
        onLogout={onLogout}
      />

      <main className="view workspace-home">
        <button className="text-button back-link" type="button" onClick={onBack}>
          ← 返回我的课程
        </button>

        {error && <ErrorBanner error={error} />}

        {loading && !course && <LoadingSpinner message="正在读取课程" />}

        {course && (
          <>
            <SectionHead
              title={course.title}
              count={
                course.published_count > 0
                  ? `已发布 ${course.published_count} 个版本`
                  : '尚未发布'
              }
            >
              <button className="dark-button" type="button" onClick={onPublish}>
                发布课程
              </button>
            </SectionHead>

            {lessons.length === 0 ? (
              <EmptyState message="这门课程还没有课节" />
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>顺序</th>
                      <th>课节名称</th>
                      <th>互动节点</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((lesson) => (
                      <tr key={lesson.id}>
                        <td className="num">{lesson.sequence}</td>
                        <td>{lesson.title}</td>
                        <td>{lesson.node_count}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => onEditLesson(lesson.id)}
                            >
                              编辑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
