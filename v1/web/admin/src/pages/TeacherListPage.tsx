import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Topbar,
  SectionHead,
  CredentialDialog,
  AuthField,
  errorMessage,
} from '@v1/web/shared';
import { AdminAPI, Admin, Teacher } from '../api';

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
