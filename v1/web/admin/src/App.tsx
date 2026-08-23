import React, { useState, useEffect } from 'react';
import { createAPIClient } from '@v1/web/shared';
import { useAdminStore } from './store';
import { AdminAPI } from './api';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { TeacherListPage } from './pages/TeacherListPage';
import { CreateTeacherPage } from './pages/CreateTeacherPage';

type Page = 'login' | 'list' | 'create';

export const AdminApp: React.FC = () => {
  const { session, logout } = useAdminStore();
  const [currentPage, setCurrentPage] = useState<Page>('login');

  // 获取 API 基础 URL（支持本地和生产）
  const getApiBaseUrl = (): string => {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return 'http://localhost:8000';
    }
    return origin;
  };

  const apiClient = createAPIClient(getApiBaseUrl());
  const api = new AdminAPI(apiClient);

  // 根据 session 状态决定显示页面
  useEffect(() => {
    if (!session) {
      setCurrentPage('login');
    } else if (currentPage === 'login') {
      setCurrentPage('list');
    }
  }, [session, currentPage]);

  const handleLogout = () => {
    logout();
    setCurrentPage('login');
  };

  switch (currentPage) {
    case 'login':
      return (
        <AdminLoginPage
          api={api}
          onLoginSuccess={() => setCurrentPage('list')}
        />
      );

    case 'list':
      return (
        <TeacherListPage
          api={api}
          onLogout={handleLogout}
          onCreateTeacher={() => setCurrentPage('create')}
        />
      );

    case 'create':
      return (
        <CreateTeacherPage
          api={api}
          onBack={() => setCurrentPage('list')}
          onSuccess={() => setCurrentPage('list')}
        />
      );

    default:
      return null;
  }
};
