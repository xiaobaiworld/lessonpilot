import React, { useEffect } from 'react';
import {
  Topbar,
  PageHead,
  EmptyState,
  LoadingSpinner,
  ErrorBanner,
  useApiRequest,
} from '@v1/web/shared';
import { useTeacherStore, Course } from '../store';
import { TeacherAPI } from '../api';

interface TeacherHomePageProps {
  api: TeacherAPI;
  onSelectCourse: (courseId: string) => void;
  onCreateCourse: () => void;
  onLogout: () => void;
}

const STATUS_TEXT: Record<Course['status'], string> = {
  draft: '草稿',
  active: '已发布',
  archived: '已归档',
};

export const TeacherHomePage: React.FC<TeacherHomePageProps> = ({
  api,
  onSelectCourse,
  onCreateCourse,
  onLogout,
}) => {
  const { session, courses, setCourses } = useTeacherStore();
  const { loading, error, execute } = useApiRequest<Course[]>();

  useEffect(() => {
    if (!session) return;
    execute(() => api.getCourses(session.token)).then((data) => {
      if (data) setCourses(data);
    });
  }, [session, api, setCourses, execute]);

  if (!session) return null;

  return (
    <div className="app-shell">
      <Topbar
        subtitle="互动课程工具"
        account={session.loginName}
        onLogout={onLogout}
      />

      <main className="view workspace-home">
        <PageHead
          eyebrow="KnownMap 互动课程工具"
          title={
            <>
              把你的录播课
              <br />
              变成<em>会提问的课程</em>
            </>
          }
          lead="选择一门课程继续编辑，或新建一门课程导入 B 站视频与字幕。"
          note={
            courses.length > 0
              ? `当前共 ${courses.length} 门课程`
              : undefined
          }
        />

        {error && <ErrorBanner error={error} />}

        {loading && <LoadingSpinner message="正在读取课程" />}

        {!loading && courses.length === 0 && (
          <EmptyState message="还没有课程">
            <button className="dark-button" type="button" onClick={onCreateCourse}>
              新建第一门课程
            </button>
          </EmptyState>
        )}

        {!loading && courses.length > 0 && (
          <>
            <div className="section-head">
              <div>
                <h2>我的课程</h2>
              </div>
              <div className="head-actions">
                <button className="dark-button" type="button" onClick={onCreateCourse}>
                  新建课程
                </button>
              </div>
            </div>

            <div className="course-list">
              {courses.map((course) => (
                <button
                  key={course.id}
                  className="course-card"
                  type="button"
                  onClick={() => onSelectCourse(course.id)}
                >
                  <span className="course-thumb">
                    <span aria-hidden="true">▶</span>
                    <b>{course.lessons.length} 课节</b>
                  </span>
                  <span className="course-card-copy">
                    <small>{STATUS_TEXT[course.status]}</small>
                    <strong>{course.title}</strong>
                    <span>
                      {course.published_count > 0
                        ? `已发布 ${course.published_count} 个版本`
                        : '尚未发布'}
                    </span>
                  </span>
                  <span className="course-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};
