import React, { useCallback, useEffect, useState } from 'react';
import {
  Topbar,
  SectionHead,
  CredentialDialog,
  errorMessage,
} from '@v1/web/shared';
import { TeacherAPI, Teacher, CourseDetail } from '../api';

interface Props {
  api: TeacherAPI;
  teacher: Teacher;
  courseId: string;
  onBack: () => void;
  onSignedOut: () => void;
}

export const CoursePage: React.FC<Props> = ({
  api,
  teacher,
  courseId,
  onBack,
  onSignedOut,
}) => {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCourse(await api.getCourse(courseId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [api, courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const signOut = async () => {
    try {
      await api.logout();
    } finally {
      onSignedOut();
    }
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const pkg = await api.publish(courseId);
      setNotice(`已发布 ${pkg.lessons.length} 个课节，学生可用授权码下载。`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const makeCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createAccessCode(courseId);
      setAccessCode(res.access_code);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // 按 sort_order 显式排序，不依赖后端返回顺序
  const lessons = course ? [...course.lessons].sort((a, b) => a.sort_order - b.sort_order) : [];

  return (
    <div className="app-shell">
      <Topbar
        subtitle="互动课程工具"
        account={teacher.display_name}
        onLogout={signOut}
      />

      <main className="view workspace-home">
        <button className="text-button back-link" type="button" onClick={onBack}>
          ← 返回我的课程
        </button>

        {error && <p className="field-error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}

        {!course && !error && <p className="table-state">正在读取课程…</p>}

        {course && (
          <>
            <SectionHead
              title={course.title}
              count={`${lessons.length} 个课节`}
            >
              <button
                className="light-button"
                type="button"
                onClick={makeCode}
                disabled={busy || lessons.length === 0}
              >
                创建授权码
              </button>
              <button
                className="dark-button"
                type="button"
                onClick={publish}
                disabled={busy || lessons.length === 0}
              >
                {busy ? '处理中…' : '发布课程'}
              </button>
            </SectionHead>

            {lessons.length === 0 ? (
              <p className="table-state">
                这门课程还没有课节。课节导入与节点编辑在阶段 4 接入。
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>顺序</th>
                      <th>课节名称</th>
                      <th>B 站视频</th>
                      <th>草稿</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((lesson) => (
                      <tr key={lesson.id}>
                        <td className="num">{lesson.sort_order}</td>
                        <td>{lesson.title}</td>
                        <td>{lesson.video_ref.videoId}</td>
                        <td>{lesson.has_draft ? '有' : '—'}</td>
                        <td>{lesson.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {accessCode && (
        <CredentialDialog
          title="发给学生的授权码"
          secret={accessCode}
          onClose={() => setAccessCode(null)}
        />
      )}
    </div>
  );
};
