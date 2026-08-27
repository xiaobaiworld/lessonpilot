import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Topbar, AuthField, CredentialDialog, errorMessage } from '@v1/web/shared';
import { TeacherAPI, Teacher, TeacherCourseFile, CourseListItem } from '../api';

interface Props {
  api: TeacherAPI;
  teacher: Teacher;
  onOpenCourse: (courseId: string) => void;
  onSignedOut: () => void;
}

export const CoursesPage: React.FC<Props> = ({
  api,
  teacher,
  onOpenCourse,
  onSignedOut,
}) => {
  const [courses, setCourses] = useState<CourseListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accessCode, setAccessCode] = useState<string | null>(null);
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

  const publishCourse = async (courseId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.publish(courseId);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const makeCode = async (courseId: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.createAccessCode(courseId);
      setAccessCode(result.access_code);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar
        subtitle="互动课程工具"
        account={teacher.login_name}
        onLogout={onSignedOut}
      />

      <main className="view workspace-home teacher-dashboard">
        <div className="dashboard-intro">
          <div>
            <p className="eyebrow">教师工作台</p>
            <h1>互动课程制作</h1>
            <p className="dashboard-lead">
              为视频课程增加互动能力，视频学习过程中加入互动环节，让学习更有趣，提升课程价值。
            </p>
          </div>
          <div className="dashboard-actions">
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
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}

        {courses === null && <p className="table-state">正在读取课程…</p>}

        {courses && courses.length > 0 && (
          <DashboardContent
            courses={courses}
            onOpenCourse={onOpenCourse}
            onPublishCourse={publishCourse}
            onGenerateAccessCode={makeCode}
            actionDisabled={busy || accessCode !== null}
          />
        )}

        {courses?.length === 0 && (
          <div className="dashboard-empty">
            <span className="dashboard-empty-mark" aria-hidden="true">＋</span>
            <strong>还没有课程</strong>
            <p>新建一门课程，开始添加课节和互动节点。</p>
            <button className="dark-button" type="button" onClick={() => setCreating(true)}>
              新建第一门课程
            </button>
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

const DashboardContent: React.FC<{
  courses: CourseListItem[];
  onOpenCourse: (courseId: string) => void;
  onPublishCourse: (courseId: string) => void;
  onGenerateAccessCode: (courseId: string) => void;
  actionDisabled: boolean;
}> = ({ courses, onOpenCourse, onPublishCourse, onGenerateAccessCode, actionDisabled }) => {
  const drafts = courses.filter(
    (course) => course.status !== 'archived' && course.metrics.release_number === null
  );
  const published = courses.filter(
    (course) => course.status !== 'archived' && course.metrics.release_number !== null
  );
  const archived = courses.filter((course) => course.status === 'archived');
  const redeemedTotal = published.reduce(
    (total, course) => total + course.metrics.redeemed_count,
    0
  );

  return (
    <>
      <div className="dashboard-stats" aria-label="课程概览">
        <DashboardStat label="全部课程" value={courses.length} />
        <DashboardStat label="制作中" value={drafts.length} tone="warm" />
        <DashboardStat label="已发布" value={published.length} tone="green" />
        <DashboardStat label="已领取设备" value={redeemedTotal} tone="soft" />
      </div>

      <CourseSection
        title="草稿"
        count={`${drafts.length} 门`}
        description="还在制作中的课程，继续完成课节和互动节点。"
      >
        {drafts.length > 0 ? (
          <div className="draft-course-grid">
            {drafts.map((course) => (
              <DraftCourseCard
                key={course.id}
                course={course}
                onOpenCourse={onOpenCourse}
                onPublishCourse={onPublishCourse}
                actionDisabled={actionDisabled}
              />
            ))}
          </div>
        ) : (
          <p className="section-empty">没有待完成的草稿。</p>
        )}
      </CourseSection>

      <CourseSection
        title="已发布"
        count={`${published.length} 门`}
        description="已交付课程的内容规模与授权使用情况。"
        className="published-section"
      >
        {published.length > 0 ? (
          <div className="published-course-list">
            {published.map((course) => (
              <PublishedCourseCard
                key={course.id}
                course={course}
                onOpenCourse={onOpenCourse}
                onGenerateAccessCode={onGenerateAccessCode}
                actionDisabled={actionDisabled}
              />
            ))}
          </div>
        ) : (
          <p className="section-empty">发布第一门课程后，它会出现在这里。</p>
        )}
      </CourseSection>

      {archived.length > 0 && (
        <CourseSection title="已归档" count={`${archived.length} 门`} className="archived-section">
          <div className="archived-course-list">
            {archived.map((course) => (
              <button
                key={course.id}
                className="archived-course"
                type="button"
                onClick={() => onOpenCourse(course.id)}
              >
                <span>
                  <strong>{course.title}</strong>
                  <small>{course.description || '暂无简介'}</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </CourseSection>
      )}
    </>
  );
};

const DashboardStat: React.FC<{ label: string; value: number; tone?: string }> = ({
  label,
  value,
  tone = '',
}) => (
  <div className={`dashboard-stat ${tone ? `is-${tone}` : ''}`}>
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

const CourseSection: React.FC<{
  title: string;
  count: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, count, description, className = '', children }) => (
  <section className={`course-section ${className}`}>
    <div className="course-section-head">
      <div>
        <div className="course-section-title">
          <h2>{title}</h2>
          <span>{count}</span>
        </div>
        {description && <p>{description}</p>}
      </div>
    </div>
    {children}
  </section>
);

const DraftCourseCard: React.FC<{
  course: CourseListItem;
  onOpenCourse: (courseId: string) => void;
  onPublishCourse: (courseId: string) => void;
  actionDisabled: boolean;
}> = ({ course, onOpenCourse, onPublishCourse, actionDisabled }) => (
  <article className="draft-course-card">
    <div className="course-card-topline">
      <span className="course-status is-draft"><i />草稿</span>
      <span className="course-updated">更新于 {formatDate(course.updated_at)}</span>
    </div>
    <button
      className="course-card-title-button"
      type="button"
      onClick={() => onOpenCourse(course.id)}
      aria-label={`修改课程：${course.title}`}
    >
      {course.title}
    </button>
    <p>{course.description || '还没有课程简介'}</p>
    <dl className="draft-course-meta">
      <div>
        <dt>课节</dt>
        <dd>{course.metrics.lesson_count}</dd>
      </div>
      <div>
        <dt>互动节点</dt>
        <dd>{course.metrics.draft_node_count}</dd>
      </div>
      <div>
        <dt>已保存课节</dt>
        <dd>{course.metrics.draft_lesson_count}/{course.metrics.lesson_count}</dd>
      </div>
    </dl>
    <div className="draft-course-actions">
      <button
        className="course-card-action"
        type="button"
        onClick={() => onOpenCourse(course.id)}
      >
        继续制作 <span aria-hidden="true">→</span>
      </button>
      <button
        className="dark-button"
        type="button"
        onClick={() => onPublishCourse(course.id)}
        disabled={actionDisabled || course.metrics.lesson_count === 0}
      >
        发布课程
      </button>
    </div>
  </article>
);

const PublishedCourseCard: React.FC<{
  course: CourseListItem;
  onOpenCourse: (courseId: string) => void;
  onGenerateAccessCode: (courseId: string) => void;
  actionDisabled: boolean;
}> = ({ course, onOpenCourse, onGenerateAccessCode, actionDisabled }) => {
  const { metrics } = course;
  const submissionCount = metrics.student_submission_count;
  const hasSubmissionCount = submissionCount != null;
  return (
    <article className="published-course-card">
      <div className="published-course-heading">
        <div>
          <div className="course-card-topline">
            <span className="course-status is-published"><i />已发布</span>
            <span className="release-label">第 {metrics.release_number} 版</span>
          </div>
          <h3>{course.title}</h3>
          <p>{course.description || '暂无课程简介'}</p>
        </div>
        <div className="published-course-actions">
          <button
            className="course-card-action"
            type="button"
            onClick={() => onOpenCourse(course.id)}
          >
            管理课程 <span aria-hidden="true">→</span>
          </button>
          <button
            className="light-button"
            type="button"
            onClick={() => onGenerateAccessCode(course.id)}
            disabled={actionDisabled}
          >
            生成授权码
          </button>
        </div>
      </div>
      <dl className="published-course-metrics">
        <Metric
          label="互动节点"
          value={metrics.published_node_count}
          note="已发布版本"
        />
        <Metric label="已发授权" value={metrics.access_code_count} note="授权码" />
        <Metric
          label="已领取"
          value={metrics.redeemed_count}
          note="个浏览器设备"
        />
        <Metric
          label="学生作答"
          value={submissionCount ?? '—'}
          note={hasSubmissionCount ? '已提交作业' : '当前未接入'}
          unavailable={!hasSubmissionCount}
        />
      </dl>
      <div className="published-course-footer">
        <span>最近发布于 {formatDate(metrics.published_at)}</span>
        <span className="course-data-note">学生回答保存在学生本机，当前不会上传</span>
      </div>
    </article>
  );
};

const Metric: React.FC<{
  label: string;
  value: number | string;
  note: string;
  unavailable?: boolean;
}> = ({ label, value, note, unavailable = false }) => (
  <div className={unavailable ? 'is-unavailable' : ''}>
    <dt>{label}</dt>
    <dd>{value}</dd>
    <small>{note}</small>
  </div>
);

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

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
