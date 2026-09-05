import React, { useEffect, useState } from 'react';
import { APIClient } from '@v1/web/shared';
import { AdminAPI, Admin } from './api';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPasswordPage } from './pages/AdminPasswordPage';
import { TeacherListPage } from './pages/TeacherListPage';

// 本地开发后端在 8000；生产同源，由 Nginx 代理 /api
const apiOrigin = /localhost|127\.0\.0\.1/.test(location.origin)
  ? 'http://localhost:8000'
  : location.origin;

const api = new AdminAPI(new APIClient(apiOrigin));

export const AdminApp: React.FC = () => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [checking, setChecking] = useState(true);
  const [showPasswordPage, setShowPasswordPage] = useState(false);

  // 刷新后用 Cookie 恢复会话，避免已登录却被弹回登录页
  useEffect(() => {
    api
      .me()
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;

  if (!admin) {
    return <AdminLoginPage api={api} onSignedIn={setAdmin} />;
  }

  if (showPasswordPage) {
    return (
      <AdminPasswordPage
        api={api}
        admin={admin}
        onBack={() => setShowPasswordPage(false)}
        onSignedOut={() => {
          setShowPasswordPage(false);
          setAdmin(null);
        }}
      />
    );
  }

  return (
    <TeacherListPage
      api={api}
      admin={admin}
      onSignedOut={() => setAdmin(null)}
      onOpenPasswordChange={() => setShowPasswordPage(true)}
    />
  );
};
