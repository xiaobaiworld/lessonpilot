import React, { useState } from 'react';
import {
  AuthPanel,
  AuthField,
  PasswordField,
  ErrorHandler,
} from '@v1/web/shared';
import { useAdminStore } from '../store';
import { AdminAPI } from '../api';

interface AdminLoginPageProps {
  api: AdminAPI;
  onLoginSuccess: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  api,
  onLoginSuccess,
}) => {
  const { setSession } = useAdminStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await api.login(email, password);
      setSession(session);
      onLoginSuccess();
    } catch (err) {
      // 登录失败不区分账号不存在或密码错误，与后端抗枚举策略一致
      setError(ErrorHandler.getDisplayMessage(err));
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="KnownMap 管理后台"
      title="超级管理员登录"
      onSubmit={handleLogin}
      error={error}
    >
      <AuthField
        id="admin-email"
        label="邮箱"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="username"
        disabled={loading}
      />
      <PasswordField
        id="admin-password"
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
