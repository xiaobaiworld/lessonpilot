import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Topbar,
  SectionHead,
  CredentialDialog,
  AuthField,
  errorMessage,
} from '@v1/web/shared';
import { AdminAPI, Admin, Teacher, TrialApplication, TrialFollowupStatus } from '../api';

interface Props {
  api: AdminAPI;
  admin: Admin;
  onSignedOut: () => void;
}

/** 待展示的一次性密码，附带它属于谁 */
interface Credential {
  who: string;
  password: string;
}

export const TeacherListPage: React.FC<Props> = ({ api, admin, onSignedOut }) => {
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
