import React, { useState } from 'react';
import {
  AuthField,
  Topbar,
  errorMessage,
} from '@v1/web/shared';
import { AdminAPI, Admin } from '../api';

interface Props {
  api: AdminAPI;
  admin: Admin;
  onBack: () => void;
  onSignedOut: () => void;
}

export const AdminPasswordPage: React.FC<Props> = ({
  api,
  admin,
  onBack,
  onSignedOut,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    try {
      await api.logout();
    } finally {
      onSignedOut();
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword, confirmPassword);
      setChanged(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(errorMessage(err));
      setCurrentPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <Topbar subtitle="管理员账号" account={admin.display_name} onLogout={signOut} />
      <main className="view home-view admin-password-view">
        <div className="dashboard-head">
          <div>
            <p className="eyebrow">账号安全</p>
            <h1>修改密码</h1>
            <p className="lead">
              修改后，当前管理员的其他登录会话也会失效，需要使用新密码重新登录。
            </p>
          </div>
          {!changed && (
            <button className="light-button" type="button" onClick={onBack}>
              返回管理后台
            </button>
          )}
        </div>

        <section className="admin-password-panel" aria-labelledby="password-form-title">
          {changed ? (
            <>
              <h2 id="password-form-title">密码已修改</h2>
              <p>当前登录会话已失效，请重新登录以继续管理。</p>
              <button className="dark-button" type="button" onClick={onSignedOut}>
                重新登录
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <h2 id="password-form-title">设置新的管理员密码</h2>
              <p>请输入当前密码进行确认。密码只会以安全哈希形式保存在服务端。</p>
              <AuthField
                id="current-admin-password"
                label="当前密码"
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                disabled={busy}
              />
              <AuthField
                id="new-admin-password"
                label="新密码"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                disabled={busy}
              />
              <AuthField
                id="confirm-admin-password"
                label="确认新密码"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                disabled={busy}
              />
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="admin-password-actions">
                <button className="light-button" type="button" onClick={onBack} disabled={busy}>
                  取消
                </button>
                <button className="dark-button" type="submit" disabled={busy}>
                  {busy ? '保存中…' : '保存新密码'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};
