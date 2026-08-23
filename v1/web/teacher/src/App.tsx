import React, { useEffect, useState } from 'react';
import { APIClient } from '@v1/web/shared';
import { TeacherAPI, Teacher } from './api';
import { TeacherLoginPage } from './pages/TeacherLoginPage';
import { CoursesPage } from './pages/CoursesPage';
import { CoursePage } from './pages/CoursePage';

// 本地开发后端在 8000；生产同源，由 Nginx 代理 /api
const apiOrigin = /localhost|127\.0\.0\.1/.test(location.origin)
  ? 'http://localhost:8000'
  : location.origin;

const api = new TeacherAPI(new APIClient(apiOrigin));

/** 当前打开的课程放在 URL 上，刷新不会丢 */
function courseIdFromUrl(): string | null {
  return new URLSearchParams(location.search).get('course');
}

export const TeacherApp: React.FC = () => {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [checking, setChecking] = useState(true);
  const [courseId, setCourseId] = useState<string | null>(courseIdFromUrl);

  useEffect(() => {
    api
      .me()
      .then(setTeacher)
      .catch(() => setTeacher(null))
      .finally(() => setChecking(false));
  }, []);

  // 浏览器前进/后退
  useEffect(() => {
    const sync = () => setCourseId(courseIdFromUrl());
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);
  }, []);

  const openCourse = (id: string) => {
    history.pushState(null, '', `?course=${id}`);
    setCourseId(id);
  };

  const backToCourses = () => {
    history.pushState(null, '', location.pathname);
    setCourseId(null);
  };

  const signOut = () => {
    history.replaceState(null, '', location.pathname);
    setCourseId(null);
    setTeacher(null);
  };

  if (checking) return null;

  if (!teacher) {
    return <TeacherLoginPage api={api} onSignedIn={setTeacher} />;
  }

  if (courseId) {
    return (
      <CoursePage
        api={api}
        teacher={teacher}
        courseId={courseId}
        onBack={backToCourses}
        onSignedOut={signOut}
      />
    );
  }

  return (
    <CoursesPage
      api={api}
      teacher={teacher}
      onOpenCourse={openCourse}
      onSignedOut={signOut}
    />
  );
};
