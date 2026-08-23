import React, { useState } from 'react';
import { createAPIClient } from '@v1/web/shared';
import { useAdminStore } from './store';
import { AdminAPI } from './api';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { TeacherListPage } from './pages/TeacherListPage';
import { CreateTeacherPage } from './pages/CreateTeacherPage';

type Page = 'login' | 'list' | 'create';

function apiBaseUrl(): string {
  const { origin } = window.location;
  // 本地开发时后端在 8000；生产同源，由 Nginx 代理 /api
  return origin.includes('localhost') || origin.includes('127.0.0.1')
    ? 'http://localhost:8000'
    : origin;
}

const api = new AdminAPI(createAPIClient(apiBaseUrl()));

export const AdminApp: React.FC = () => {
  const { session, logout, setTemporaryPassword } = useAdminStore();
  const [page, setPage] = useState<Page>('list');

  const handleLogout = () => {
    logout();
    setPage('list');
  };

  // 未登录一律回登录页，不依赖 effect 同步，避免多渲染一帧
  if (!session) {
    return <AdminLoginPage api={api} onLoginSuccess={() => setPage('list')} />;
  }

  if (page === 'create') {
    return (
      <CreateTeacherPage
        api={api}
        onBack={() => {
          setTemporaryPassword(null);
          setPage('list');
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <TeacherListPage
      api={api}
      onLogout={handleLogout}
      onCreateTeacher={() => setPage('create')}
      onResetPassword={() => {
        // TODO(3F): 重置密码沿用创建页的一次性凭据面板，待后端联通后接入
      }}
    />
  );
};
