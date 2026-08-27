import React, { lazy, Suspense, useEffect, useState } from 'react';
import { APIClient } from '@v1/web/shared';
import { TeacherAPI, Teacher } from './api';
import { TeacherLoginPage } from './pages/TeacherLoginPage';

// 登录是默认入口，不应为了显示登录表单下载课程编辑器和字幕工具。
// 页面文件保持命名导出，动态导入只把它们放进认证后的异步 chunk。
const CoursesPage = lazy(() =>
  import('./pages/CoursesPage').then(({ CoursesPage }) => ({ default: CoursesPage }))
);
const CoursePage = lazy(() =>
  import('./pages/CoursePage').then(({ CoursePage }) => ({ default: CoursePage }))
);
const LessonPage = lazy(() =>
  import('./pages/LessonPage').then(({ LessonPage }) => ({ default: LessonPage }))
);

// 本地开发后端在 8000；生产同源，由 Nginx 代理 /api。
// 本机页面可能从 localhost 或 127.0.0.1 打开，API 也要使用相同主机，
// 否则登录 Cookie 会落到另一个 host，后续请求会变成未登录。
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const apiOrigin = localHosts.has(location.hostname)
  ? `${location.protocol}//${location.hostname}:8000`
  : location.origin;

const api = new TeacherAPI(new APIClient(apiOrigin));

/**
 * 位置放在 URL 上，刷新和浏览器前进/后退都能落回原处。
 * lesson 的标题也带上，免得只为显示一个标题再请求一次课程。
 */
interface Route {
  course?: string;
  lesson?: string;
  lessonTitle?: string;
}

function readRoute(): Route {
  const q = new URLSearchParams(location.search);
  return {
    course: q.get('course') ?? undefined,
    lesson: q.get('lesson') ?? undefined,
    lessonTitle: q.get('title') ?? undefined,
  };
}

function pushRoute(route: Route) {
  const q = new URLSearchParams();
  if (route.course) q.set('course', route.course);
  if (route.lesson) q.set('lesson', route.lesson);
  if (route.lessonTitle) q.set('title', route.lessonTitle);
  const search = q.toString();
  history.pushState(null, '', search ? `?${search}` : location.pathname);
}

export const TeacherApp: React.FC = () => {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    api
      .me()
      .then(setTeacher)
      .catch(() => setTeacher(null));
  }, []);

  useEffect(() => {
    const sync = () => setRoute(readRoute());
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);
  }, []);

  const go = (next: Route) => {
    pushRoute(next);
    setRoute(next);
  };

  const signOut = async () => {
    try {
      await api.logout();
    } finally {
      history.replaceState(null, '', location.pathname);
      setRoute({});
      setTeacher(null);
    }
  };

  if (!teacher) {
    // 会话恢复只决定是否切换到工作台，不阻塞默认登录表单的首屏显示。
    return <TeacherLoginPage api={api} onSignedIn={setTeacher} />;
  }

  let page: React.ReactNode;

  if (route.course && route.lesson) {
    page = (
      <LessonPage
        api={api}
        teacher={teacher}
        courseId={route.course}
        lessonId={route.lesson}
        lessonTitle={route.lessonTitle ?? '课节'}
        onBack={() => go({ course: route.course })}
        onSelectLesson={(lesson, lessonTitle) =>
          go({ course: route.course, lesson, lessonTitle })
        }
        onSignedOut={signOut}
      />
    );
  } else if (route.course) {
    page = (
      <CoursePage
        api={api}
        teacher={teacher}
        courseId={route.course}
        onBack={() => go({})}
        onSignedOut={signOut}
        onEditLesson={(lesson, lessonTitle) =>
          go({ course: route.course, lesson, lessonTitle })
        }
      />
    );
  } else {
    page = (
      <CoursesPage
        api={api}
        teacher={teacher}
        onOpenCourse={(course) => go({ course })}
        onSignedOut={signOut}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <section className="auth-view" aria-busy="true">
          <div className="auth-panel">
            <p>工作台加载中…</p>
          </div>
        </section>
      }
    >
      {page}
    </Suspense>
  );
};
