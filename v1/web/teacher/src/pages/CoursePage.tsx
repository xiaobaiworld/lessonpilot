import React, { useCallback, useEffect, useState } from 'react';
import {
  Topbar,
  SectionHead,
  CredentialDialog,
  AuthField,
  errorMessage,
} from '@v1/web/shared';
import { TeacherAPI, Teacher, CourseDetail, BilibiliVideoRef } from '../api';

interface Props {
  api: TeacherAPI;
  teacher: Teacher;
  courseId: string;
  onBack: () => void;
  onSignedOut: () => void;
  onEditLesson: (lessonId: string, lessonTitle: string) => void;
}

export const CoursePage: React.FC<Props> = ({
  api,
  teacher,
  courseId,
  onBack,
  onSignedOut,
  onEditLesson,
}) => {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [addingLesson, setAddingLesson] = useState(false);
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


  const addLesson = async (title: string, videoRef: BilibiliVideoRef) => {
    setBusy(true);
    setError(null);
    try {
      await api.createLesson(courseId, title, videoRef);
      setAddingLesson(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
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

  const exportCourse = async () => {
    setBusy(true);
    setError(null);
    try {
      const file = await api.exportCourseFile(courseId);
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${course?.title || '课程'}-teacher-course.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice('课程文件已生成，包含已保存的字幕和节点。');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // 按 sort_order 显式排序，不依赖后端返回顺序
  const lessons = course
    ? [...course.lessons].sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // 授权码还在屏上时不再发下一个：它不可再次获取，覆盖掉就丢了
  const locked = busy || accessCode !== null;

  return (
    <div className="app-shell">
      <Topbar
        subtitle="互动课程工具"
        account={teacher.login_name}
        onLogout={onSignedOut}
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
                onClick={() => setAddingLesson(true)}
                disabled={locked}
              >
                添加课节
              </button>
              <button className="light-button" type="button" onClick={exportCourse} disabled={locked}>
                导出课程文件
              </button>
              <button
                className="light-button"
                type="button"
                onClick={makeCode}
                disabled={locked || lessons.length === 0}
              >
                生成授权码
              </button>
              <button
                className="dark-button"
                type="button"
                onClick={publish}
                disabled={locked || lessons.length === 0}
              >
                {busy ? '处理中…' : '发布课程'}
              </button>
            </SectionHead>

            {lessons.length === 0 ? (
              <p className="table-state">
                这门课程还没有课节，先添加一个 B 站视频
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
                      <th>
                        <span className="visually-hidden">操作</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((lesson) => (
                      <tr key={lesson.id}>
                        <td className="num">{lesson.sort_order}</td>
                        <td>{lesson.title}</td>
                        <td>
                          {lesson.video_ref.video_id} · 第 {lesson.video_ref.page} P
                          {lesson.video_ref.cid ? ` · CID ${lesson.video_ref.cid}` : ''}
                        </td>
                        <td>{lesson.has_draft ? '有' : '—'}</td>
                        <td>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => onEditLesson(lesson.id, lesson.title)}
                          >
                            编辑节点
                          </button>
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

      {addingLesson && (
        <AddLessonDialog
          busy={busy}
          onCancel={() => setAddingLesson(false)}
          onSubmit={addLesson}
        />
      )}

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

/** 只接受直接 B 站视频页或裸 BVID，并规范化课程匹配字段。 */
export function parseBilibiliVideoRef(input: string): BilibiliVideoRef | null {
  const value = input.trim();
  if (/^BV[a-zA-Z0-9]{10}$/.test(value)) {
    return { platform: 'bilibili', video_id: value, page: 1, cid: null };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (!['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(url.hostname)) return null;
  const match = url.pathname.match(/^\/video\/(BV[a-zA-Z0-9]{10})(?:\/|$)/i);
  if (!match) return null;
  const rawPage = url.searchParams.get('p');
  if (rawPage !== null && !/^\d+$/.test(rawPage)) return null;
  const page = rawPage === null ? 1 : Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1) return null;
  const cid = url.searchParams.get('cid');
  if (cid !== null && !/^\d+$/.test(cid)) return null;
  return { platform: 'bilibili', video_id: match[1], page, cid };
}

const AddLessonDialog: React.FC<{
  busy: boolean;
  onCancel: () => void;
  onSubmit: (title: string, videoRef: BilibiliVideoRef) => void;
}> = ({ busy, onCancel, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [video, setVideo] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoRef = parseBilibiliVideoRef(video);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <h2>添加课节</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!videoRef) {
              setVideoError('请输入直接 B 站视频链接或合法 BV 号。');
              return;
            }
            setVideoError(null);
            onSubmit(title, videoRef);
          }}
        >
          <AuthField
            id="lesson-title"
            label="课节名称"
            value={title}
            onChange={setTitle}
            autoComplete="off"
            disabled={busy}
          />
          <label className="field-group" htmlFor="lesson-video">
            <span>B 站视频链接或 BV 号</span>
            <input
              id="lesson-video"
              type="text"
              value={video}
              onChange={(e) => setVideo(e.target.value)}
              placeholder="https://www.bilibili.com/video/BV1Ac41187Lm"
              autoComplete="off"
              disabled={busy}
              required
            />
            <small>
              {videoError ?? (videoRef
                ? `将使用 ${videoRef.video_id} · 第 ${videoRef.page} P`
                : '粘贴直接 B 站视频链接或裸 BV 号')}
            </small>
          </label>
          <div className="modal-actions">
            <button
              className="light-button"
              type="button"
              onClick={onCancel}
              disabled={busy}
            >
              取消
            </button>
            <button className="dark-button" type="submit" disabled={busy}>
              {busy ? '添加中…' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
