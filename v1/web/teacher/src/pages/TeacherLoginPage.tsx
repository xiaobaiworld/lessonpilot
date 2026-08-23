import React, { useState } from 'react';
import {
  AuthPanel,
  AuthField,
  PasswordField,
  ErrorHandler,
} from '@v1/web/shared';
import { useTeacherStore } from '../store';
import { TeacherAPI } from '../api';

interface TeacherLoginPageProps {
  api: TeacherAPI;
  onLoginSuccess: () => void;
}

export const TeacherLoginPage: React.FC<TeacherLoginPageProps> = ({
  api,
  onLoginSuccess,
}) => {
  const { setSession } = useTeacherStore();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await api.login(loginName, password);
      setSession(session);
      onLoginSuccess();
    } catch (err) {
      setError(ErrorHandler.getDisplayMessage(err));
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="KnownMap 互动课程工具"
      title="登录互动课程工具"
      onSubmit={handleLogin}
      error={error}
    >
      <AuthField
        id="login-name"
        label="用户名"
        value={loginName}
        onChange={setLoginName}
        autoComplete="username"
        disabled={loading}
      />
      <PasswordField
        id="login-password"
        value={password}
        onChange={setPassword}
        disabled={loading}
      />
      <button className="dark-button" type="submit" disabled={loading}>
        {loading ? '登录中…' : '登录'}
      </button>
    </AuthPanel>
  );
};
