import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Topbar,
  SectionHead,
  CredentialDialog,
  AuthField,
  errorMessage,
} from '@v1/web/shared';
import {
  AdminAPI,
  Admin,
  AdminCourse,
  Teacher,
  TrialApplication,
  TrialFollowupStatus,
  CoursePackagePreview,
} from '../api';

interface Props {
  api: AdminAPI;
  admin: Admin;
  onSignedOut: () => void;
  onOpenPasswordChange: () => void;
}

/** 待展示的一次性密码，附带它属于谁 */
interface Credential {
  who: string;
  password: string;
}

export const TeacherListPage: React.FC<Props> = ({
  api,
  admin,
  onSignedOut,
  onOpenPasswordChange,
}) => {
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applications, setApplications] = useState<TrialApplication[] | null>(null);
  const [applicationBusy, setApplicationBusy] = useState<string | null>(null);

  /*
   * 请求代次：慢的旧请求返回时不能覆盖新数据。
   * 旧页面用 interactionCoordinator 做同一件事（tests/admin-page.test.js）。
   */
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    setError(null);
    try {
      const list = await api.listTeachers();
      if (mine === generation.current) setTeachers(list);
    } catch (err) {
      if (mine !== generation.current) return;
      setError(errorMessage(err));
      setTeachers([]);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const loadApplications = useCallback(async () => {
    try {
      setApplications(await api.listTrialApplications());
    } catch (err) {
      setError(errorMessage(err));
      setApplications([]);
    }
  }, [api]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const signOut = async () => {
    generation.current++; // 丢弃在途响应
    try {
      await api.logout();
    } finally {
      onSignedOut();
    }
  };

  /*
   * 临时密码还在屏上时禁止下一次创建或重置。
   * 那个密码不可再次获取，覆盖掉就永久丢了。
   */
  const locked = busy || credential !== null;

  const create = async (loginName: string, displayName: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createTeacher(loginName, displayName);
      setCredential({
        who: res.teacher.login_name,
        password: res.temporary_password,
      });
      setCreating(false);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (teacher: Teacher) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.resetPassword(teacher.id);
      setCredential({ who: teacher.login_name, password: res.temporary_password });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const updateApplicationStatus = async (
    application: TrialApplication,
    status: TrialFollowupStatus
  ) => {
    setApplicationBusy(application.id);
    setError(null);
    try {
      await api.updateTrialFollowup(application.followupId, status);
      await loadApplications();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setApplicationBusy(null);
    }
  };

  return (
    <div className="app-shell">
      <Topbar subtitle="管理后台" account={admin.display_name} onLogout={signOut} />
      <div className="admin-account-actions">
        <button className="text-button" type="button" onClick={onOpenPasswordChange}>
          修改管理员密码
        </button>
      </div>

      <main className="view workspace-home">
        <SectionHead
          title="教师账号"
          count={teachers?.length ? `共 ${teachers.length} 位` : undefined}
        >
          <button
            className="dark-button"
            type="button"
            onClick={() => setCreating(true)}
            disabled={locked}
          >
            新建教师
          </button>
        </SectionHead>

        {error && <p className="field-error">{error}</p>}

        {teachers === null && <p className="table-state">正在读取教师列表…</p>}

        {teachers?.length === 0 && <p className="table-state">还没有教师账号</p>}

        {teachers && teachers.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>登录名</th>
                  <th>教师名称</th>
                  <th>状态</th>
                  <th>已发布课程</th>
                  <th>
                    <span className="visually-hidden">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td>{t.login_name}</td>
                    <td>{t.display_name}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          t.status === 'active' ? 'is-active' : 'is-muted'
                        }`}
                      >
                        {t.status === 'active' ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="num">{t.published_course_count}</td>
                    <td>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => reset(t)}
                        disabled={locked}
                      >
                        重置密码
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <CoursePackageSection api={api} teachers={teachers} locked={locked} />

        <TrialApplicationsSection
          applications={applications}
          busyId={applicationBusy}
          onStatusChange={updateApplicationStatus}
        />
      </main>

      {creating && (
        <CreateTeacherDialog
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={create}
        />
      )}

      {credential && (
        <CredentialDialog
          title={`${credential.who} 的初始密码`}
          secret={credential.password}
          onClose={() => setCredential(null)}
        />
      )}
    </div>
  );
};

interface CoursePackageProps {
  api: AdminAPI;
  teachers: Teacher[] | null;
  locked: boolean;
}

const CoursePackageSection: React.FC<CoursePackageProps> = ({ api, teachers, locked }) => {
  const [teacherId, setTeacherId] = useState('');
  const [courses, setCourses] = useState<AdminCourse[] | null>(null);
  const [courseId, setCourseId] = useState('');
  const [versionKey, setVersionKey] = useState('draft');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<CoursePackagePreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!teacherId && teachers?.length) setTeacherId(teachers[0].id);
  }, [teacherId, teachers]);

  const load = useCallback(async () => {
    if (!teacherId) {
      setCourses(null);
      return;
    }
    setLoading(true);
    setMessage(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    try {
      const result = await api.listTeacherCourses(teacherId);
      setCourses(result.items);
      setCourseId(result.items[0]?.id ?? '');
      setVersionKey('draft');
    } catch (err) {
      setMessage(errorMessage(err));
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [api, teacherId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCourse = courses?.find((course) => course.id === courseId);
  const selectedVersion = versionKey === 'draft' ? null : versionKey.slice('release:'.length);

  const download = async () => {
    if (!teacherId || !selectedCourse) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await api.exportCoursePackage(
        teacherId,
        selectedCourse.id,
        selectedVersion ? 'release' : 'draft',
        selectedVersion ?? undefined
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedCourse.title}.kmcourse`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('课程包已开始下载');
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const previewFile = async (file: File) => {
    if (!teacherId) return;
    setBusy(true);
    setMessage(null);
    setPreview(null);
    try {
      setPreview(await api.previewCoursePackage(teacherId, file));
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const importFile = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !teacherId || !preview) return;
    const ok = window.confirm(
      `将课程包“${preview.summary.title}”导入为目标教师的新草稿，包含 ${preview.summary.asset_count} 个节点资源。不会覆盖、发布或生成授权。继续吗？`
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.importCoursePackage(teacherId, file);
      setMessage(`已导入新课程：${result.course.title}`);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="course-package-section">
      <SectionHead title="课程包管理" count="管理员受控操作" />
      <p className="section-note">
        选择目标教师后导出或导入课程包。B 站主视频只保留引用；节点图片、音频和辅助视频会随包保存。
      </p>
      <div className="course-package-controls">
        <label>
          目标教师
          <select
            value={teacherId}
            disabled={locked || !teachers?.length || busy}
            onChange={(event) => setTeacherId(event.target.value)}
          >
            {!teachers?.length && <option value="">暂无教师</option>}
            {teachers?.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.display_name}（{teacher.login_name}）
              </option>
            ))}
          </select>
        </label>
        <label>
          导出课程
          <select
            disabled={locked || loading || busy || !courses?.length}
            value={selectedCourse?.id ?? ''}
            onChange={(event) => {
              setCourseId(event.target.value);
              setVersionKey('draft');
            }}
          >
            {!courses?.length && <option value="">暂无课程</option>}
            {courses?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}（{course.lesson_count} 节）
              </option>
            ))}
          </select>
        </label>
        <label>
          导出版本
          <select
            disabled={locked || loading || busy || !selectedCourse}
            value={versionKey}
            onChange={(event) => setVersionKey(event.target.value)}
          >
            <option value="draft">当前已保存草稿</option>
            {selectedCourse?.releases.map((release) => (
              <option key={release.id} value={`release:${release.id}`}>
                已发布版本 #{release.release_number}
              </option>
            ))}
          </select>
        </label>
        <button
          className="dark-button"
          type="button"
          disabled={locked || busy || loading || !selectedCourse}
          onClick={download}
        >
          导出课程包
        </button>
      </div>

      <div className="course-package-import">
        <label>
          导入 `.kmcourse`
          <input
            ref={fileRef}
            type="file"
            accept=".kmcourse,application/zip"
            disabled={locked || busy || !teacherId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void previewFile(file);
            }}
          />
        </label>
        {preview && (
          <div className="course-package-preview">
            <strong>{preview.summary.title}</strong>
            <span>
              {preview.summary.lesson_count} 节课，{preview.summary.node_count} 个节点，
              {preview.summary.asset_count} 个节点资源
            </span>
            <button
              className="dark-button"
              type="button"
              disabled={locked || busy}
              onClick={() => void importFile()}
            >
              确认导入为新草稿
            </button>
          </div>
        )}
      </div>
      {loading && <p className="table-state">正在读取课程摘要…</p>}
      {message && <p className="section-note">{message}</p>}
    </section>
  );
};

interface TrialApplicationsProps {
  applications: TrialApplication[] | null;
  busyId: string | null;
  onStatusChange: (application: TrialApplication, status: TrialFollowupStatus) => void;
}

const FOLLOWUP_LABELS: Record<TrialFollowupStatus, string> = {
  pending: '待联系',
  contacted: '已联系',
  closed: '已关闭',
};

const formatSubmittedAt = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const TrialApplicationsSection: React.FC<TrialApplicationsProps> = ({
  applications,
  busyId,
  onStatusChange,
}) => (
  <section className="trial-applications">
    <SectionHead
      title="试用申请"
      count={applications ? `共 ${applications.length} 条` : undefined}
    />
    {applications === null && <p className="table-state">正在读取试用申请…</p>}
    {applications?.length === 0 && <p className="table-state">还没有试用申请</p>}
    {applications && applications.length > 0 && (
      <div className="table-wrap">
        <table className="trial-applications-table">
          <thead>
            <tr>
              <th>提交时间</th>
              <th>称呼 / 联系方式</th>
              <th>课程类别</th>
              <th>视频状态</th>
              <th>B 站链接</th>
              <th>字幕情况</th>
              <th>教学问题</th>
              <th>验证问题</th>
              <th>跟进状态</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id}>
                <td>{formatSubmittedAt(application.submittedAt)}</td>
                <td>
                  <strong>{application.name}</strong>
                  <span className="cell-subtext">{application.contact}</span>
                </td>
                <td>{application.courseCategory}</td>
                <td>{application.videoStatus}</td>
                <td>
                  {application.bilibiliUrl ? (
                    <a href={application.bilibiliUrl} target="_blank" rel="noreferrer">
                      查看链接
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{application.subtitleStatus}</td>
                <td className="cell-long-text">{application.teachingProblem}</td>
                <td className="cell-long-text">{application.validationQuestion || '—'}</td>
                <td>
                  <select
                    aria-label={`${application.name} 的跟进状态`}
                    value={application.status}
                    disabled={busyId === application.id}
                    onChange={(event) =>
                      onStatusChange(
                        application,
                        event.target.value as TrialFollowupStatus
                      )
                    }
                  >
                    {Object.entries(FOLLOWUP_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

interface DialogProps {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (loginName: string, displayName: string) => void;
}

/** 两个字段的表单，不值得单独占一页 */
const CreateTeacherDialog: React.FC<DialogProps> = ({ busy, onCancel, onSubmit }) => {
  const [loginName, setLoginName] = useState('');
  const [displayName, setDisplayName] = useState('');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <h2>新建教师账号</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(loginName, displayName);
          }}
        >
          <AuthField
            id="new-login-name"
            label="登录名"
            value={loginName}
            onChange={setLoginName}
            autoComplete="off"
            disabled={busy}
          />
          <AuthField
            id="new-display-name"
            label="教师名称"
            value={displayName}
            onChange={setDisplayName}
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
