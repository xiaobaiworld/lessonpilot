import React, { useState } from 'react';
import {
  Topbar,
  SectionHead,
  AuthField,
  ErrorHandler,
} from '@v1/web/shared';
import { useAdminStore } from '../store';
import { AdminAPI } from '../api';

interface CreateTeacherPageProps {
  api: AdminAPI;
  onBack: () => void;
  onLogout: () => void;
}

export const CreateTeacherPage: React.FC<CreateTeacherPageProps> = ({
  api,
  onBack,
  onLogout,
}) => {
  const { session, addTeacher, temporaryPassword, setTemporaryPassword } =
    useAdminStore();
  const [loginName, setLoginName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdName, setCreatedName] = useState('');

  if (!session) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.createTeacher(session.token, loginName, displayName);
      setTemporaryPassword(res.temporary_password);
      setCreatedName(res.login_name);
      addTeacher({
        id: res.teacher_id,
        login_name: res.login_name,
        display_name: displayName,
        status: 'active',
        created_at: new Date().toISOString(),
        published_course_count: 0,
      });
      setLoginName('');
      setDisplayName('');
    } catch (err) {
      setError(ErrorHandler.getDisplayMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
    } catch {
      setError('浏览器拒绝了剪贴板访问，请手动选中复制');
    }
  };

  /** 关闭即清空。临时密码不可再次获取，所以要明确告知。 */
  const handleDismiss = () => {
    setTemporaryPassword(null);
    setCopied(false);
    setCreatedName('');
  };

  return (
    <div className="app-shell">
      <Topbar subtitle="管理后台" account={session.email} onLogout={onLogout} />

      <main className="view workspace-home">
        <button className="text-button back-link" type="button" onClick={onBack}>
          ← 返回教师列表
        </button>

        <SectionHead title="新建教师账号" />

        {/* 临时密码面板：出现时禁止再次创建，避免覆盖不可再取的凭据 */}
        {temporaryPassword ? (
          <div className="credential-panel">
            <p className="eyebrow">账号已创建</p>
            <h2>{createdName} 的初始密码</h2>
            <p className="credential-warning">
              这个密码只显示这一次，关闭后无法再次查看。请先复制并交给教师，
              教师首次登录后应自行修改。
            </p>
            <div className="credential-row">
              <input
                type="text"
                value={temporaryPassword}
                readOnly
                aria-label="初始密码"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button className="dark-button" type="button" onClick={handleCopy}>
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            {error && <p className="field-error">{error}</p>}
            <div className="credential-actions">
              <button className="light-button" type="button" onClick={handleDismiss}>
                我已保存，关闭
              </button>
            </div>
          </div>
        ) : (
          <div className="form-panel">
            <form onSubmit={handleCreate}>
              <AuthField
                id="new-login-name"
                label="登录名"
                value={loginName}
                onChange={setLoginName}
                autoComplete="off"
                disabled={loading}
              />
              <AuthField
                id="new-display-name"
                label="昵称"
                value={displayName}
                onChange={setDisplayName}
                autoComplete="off"
                disabled={loading}
              />
              {error && <p className="field-error">{error}</p>}
              <button className="dark-button" type="submit" disabled={loading}>
                {loading ? '创建中…' : '创建账号'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
