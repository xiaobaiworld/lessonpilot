import React, { useState } from 'react';
import { createAPIClient } from '@v1/web/shared';
import { useTeacherStore } from './store';
import { TeacherAPI } from './api';
import { TeacherLoginPage } from './pages/TeacherLoginPage';
import { TeacherHomePage } from './pages/TeacherHomePage';
import { CourseDetailPage } from './pages/CourseDetailPage';

type Page = 'login' | 'home' | 'course' | 'editor';

interface RouteState {
  page: Page;
  courseId?: string;
  lessonId?: string;
}

export const TeacherApp: React.FC = () => {
  const { session, logout, setSelectedCourseId } = useTeacherStore();
  const [route, setRoute] = useState<RouteState>({ page: 'login' });

  const getApiBaseUrl = (): string => {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return 'http://localhost:8000';
    }
    return origin;
  };

  const apiClient = createAPIClient(getApiBaseUrl());
  const api = new TeacherAPI(apiClient);

  const handleLoginSuccess = () => {
    setRoute({ page: 'home' });
  };

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setRoute({ page: 'course', courseId });
  };

  const handleCreateCourse = () => {
    // TODO: Implement create course page
  };

  const handleEditLesson = (lessonId: string) => {
    // TODO: Implement lesson editor
  };

  const handleLogout = () => {
    logout();
    setRoute({ page: 'login' });
  };

  const handleBack = () => {
    setRoute({ page: 'home' });
  };

  if (!session && route.page !== 'login') {
    setRoute({ page: 'login' });
  }

  switch (route.page) {
    case 'login':
      return <TeacherLoginPage api={api} onLoginSuccess={handleLoginSuccess} />;

    case 'home':
      return (
        <TeacherHomePage
          api={api}
          onSelectCourse={handleSelectCourse}
          onCreateCourse={handleCreateCourse}
          onLogout={handleLogout}
        />
      );

    case 'course':
      return (
        route.courseId && (
          <CourseDetailPage
            api={api}
            courseId={route.courseId}
            onEditLesson={handleEditLesson}
            onBack={handleBack}
          />
        )
      );

    default:
      return null;
  }
};
