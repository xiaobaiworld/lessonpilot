import React, { useState } from 'react';
import { AuthPanel, AuthField, PasswordField, errorMessage } from '@v1/web/shared';
import { AdminAPI, Admin } from '../api';

interface Props {
  api: AdminAPI;
  onSignedIn: (admin: Admin) => void;
}

export const AdminLoginPage: React.FC<Props> = ({ api, onSignedIn }) => {
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await api.login(loginName, password));
    } catch (err) {
      // 不区分账号不存在与密码错误，与后端抗枚举策略一致
      setError(errorMessage(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="KnownMap 管理后台"
      title="超级管理员登录"
      onSubmit={submit}
      error={error}
    >
      <AuthField
        id="admin-login-name"
        label="用户名"
        value={loginName}
        onChange={setLoginName}
        autoComplete="username"
        disabled={busy}
      />
      <PasswordField
        id="admin-password"
        value={password}
        onChange={setPassword}
        disabled={busy}
      />
      <button className="dark-button" type="submit" disabled={busy}>
        {busy ? '登录中…' : '登录'}
      </button>
    </AuthPanel>
  );
};
