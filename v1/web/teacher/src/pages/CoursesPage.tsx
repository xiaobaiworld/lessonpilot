import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Topbar, SectionHead, AuthField, errorMessage } from '@v1/web/shared';
import { TeacherAPI, Teacher, TeacherCourseFile, CourseSummary } from '../api';

interface Props {
  api: TeacherAPI;
  teacher: Teacher;
  onOpenCourse: (courseId: string) => void;
  onSignedOut: () => void;
}

const STATUS_TEXT: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

export const CoursesPage: React.FC<Props> = ({
  api,
  teacher,
  onOpenCourse,
  onSignedOut,
}) => {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCourses(await api.listCourses());
    } catch (err) {
      setError(errorMessage(err));
      setCourses([]);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);


  const create = async (title: string) => {
    setBusy(true);
    setError(null);
    try {
      const course = await api.createCourse(title);
      setCreating(false);
      onOpenCourse(course.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const value = JSON.parse(await file.text()) as TeacherCourseFile;
      const result = await api.previewCourseFile(value);
      const summary = result.summary;
      const confirmed = window.confirm(
        `将导入“${String(summary.title ?? value.course.title)}”，共 ${String(summary.lesson_count ?? '?')} 个课节。确认创建新课程草稿吗？`
      );
      if (!confirmed) return;
      const imported = await api.importCourseFile(value);
      onOpenCourse(imported.course.id);
    } catch (err) {
      setError(err instanceof SyntaxError ? '课程文件不是有效 JSON。' : errorMessage(err));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="app-shell">
      <Topbar
        subtitle="互动课程工具"
        account={teacher.display_name}
        onLogout={onSignedOut}
      />

      <main className="view workspace-home">
        <SectionHead
          title="我的课程"
          count={courses?.length ? `共 ${courses.length} 门` : undefined}
        >
          <button
            className="dark-button"
            type="button"
            onClick={() => setCreating(true)}
            disabled={busy}
          >
            新建课程
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
          <button
            className="light-button"
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            导入课程文件
          </button>
        </SectionHead>

        {error && <p className="field-error">{error}</p>}

        {courses === null && <p className="table-state">正在读取课程…</p>}

        {courses?.length === 0 && (
          <p className="table-state">还没有课程，先新建一门</p>
        )}

        {courses && courses.length > 0 && (
          <div className="course-list">
            {courses.map((course) => (
              <button
                key={course.id}
                className="course-card"
                type="button"
                onClick={() => onOpenCourse(course.id)}
              >
                <span className="course-thumb">
                  <span aria-hidden="true">▶</span>
                </span>
                <span className="course-card-copy">
                  <small>{STATUS_TEXT[course.status] ?? course.status}</small>
                  <strong>{course.title}</strong>
                  <span>{course.description || '暂无简介'}</span>
                </span>
                <span className="course-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      {creating && (
        <NewCourseDialog
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={create}
        />
      )}
    </div>
  );
};

const NewCourseDialog: React.FC<{
  busy: boolean;
  onCancel: () => void;
  onSubmit: (title: string) => void;
}> = ({ busy, onCancel, onSubmit }) => {
  const [title, setTitle] = useState('');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <h2>新建课程</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(title);
          }}
        >
          <AuthField
            id="course-title"
            label="课程名称"
            value={title}
            onChange={setTitle}
            autoComplete="off"
            disabled={busy}
          />
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
              {busy ? '创建中…' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
