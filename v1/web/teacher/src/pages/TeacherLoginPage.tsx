import React, { useState } from 'react';
import { AuthPanel, AuthField, PasswordField, errorMessage } from '@v1/web/shared';
import { TeacherAPI, Teacher } from '../api';

interface Props {
  api: TeacherAPI;
  onSignedIn: (teacher: Teacher) => void;
}

export const TeacherLoginPage: React.FC<Props> = ({ api, onSignedIn }) => {
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
      setError(errorMessage(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="KnownMap 互动课程工具"
      title="登录互动课程工具"
      onSubmit={submit}
      error={error}
    >
      <AuthField
        id="login-name"
        label="用户名"
        value={loginName}
        onChange={setLoginName}
        autoComplete="username"
        disabled={busy}
      />
      <PasswordField
        id="login-password"
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
