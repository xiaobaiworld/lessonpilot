import React, { useEffect } from 'react';
import {
  Topbar,
  SectionHead,
  EmptyState,
  LoadingSpinner,
  ErrorBanner,
  useApiRequest,
} from '@v1/web/shared';
import { useAdminStore, Teacher } from '../store';
import { AdminAPI } from '../api';

interface TeacherListPageProps {
  api: AdminAPI;
  onLogout: () => void;
  onCreateTeacher: () => void;
  onResetPassword: (teacher: Teacher) => void;
}

export const TeacherListPage: React.FC<TeacherListPageProps> = ({
  api,
  onLogout,
  onCreateTeacher,
  onResetPassword,
}) => {
  const { session, teachers, setTeachers } = useAdminStore();
  const { loading, error, execute } = useApiRequest<Teacher[]>();

  useEffect(() => {
    if (!session) return;
    execute(() => api.getTeachers(session.token)).then((data) => {
      if (data) setTeachers(data);
    });
  }, [session, api, setTeachers, execute]);

  if (!session) return null;

  return (
    <div className="app-shell">
      <Topbar
        subtitle="管理后台"
        account={session.email}
        onLogout={onLogout}
      />

      <main className="view workspace-home">
        <SectionHead
          title="教师账号"
          count={teachers.length > 0 ? `共 ${teachers.length} 位教师` : undefined}
        >
          <button className="dark-button" type="button" onClick={onCreateTeacher}>
            新建教师
          </button>
        </SectionHead>

        {error && <ErrorBanner error={error} />}

        {loading && <LoadingSpinner message="正在读取教师列表" />}

        {!loading && teachers.length === 0 && (
          <EmptyState message="还没有教师账号">
            <button className="dark-button" type="button" onClick={onCreateTeacher}>
              创建第一个教师账号
            </button>
          </EmptyState>
        )}

        {!loading && teachers.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>登录名</th>
                  <th>昵称</th>
                  <th>状态</th>
                  <th>已发布课程</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher) => (
                  <tr key={teacher.id}>
                    <td>{teacher.login_name}</td>
                    <td>{teacher.display_name}</td>
                    <td>
                      <span
                        className={
                          teacher.status === 'active'
                            ? 'status-pill is-active'
                            : 'status-pill is-muted'
                        }
                      >
                        {teacher.status === 'active' ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="num">{teacher.published_course_count}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => onResetPassword(teacher)}
                        >
                          重置密码
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};
