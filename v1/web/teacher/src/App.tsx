import React, { useState } from 'react';
import { createAPIClient } from '@v1/web/shared';
import { useTeacherStore } from './store';
import { TeacherAPI } from './api';
import { TeacherPublishAPI } from './api-publish';
import { TeacherLoginPage } from './pages/TeacherLoginPage';
import { TeacherHomePage } from './pages/TeacherHomePage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { PublishWorkflow } from './components/PublishWorkflow';

function apiBaseUrl(): string {
  const { origin } = window.location;
  // 本地开发时后端在 8000；生产同源，由 Nginx 代理 /api
  return origin.includes('localhost') || origin.includes('127.0.0.1')
    ? 'http://localhost:8000'
    : origin;
}

const client = createAPIClient(apiBaseUrl());
const api = new TeacherAPI(client);
const publishApi = new TeacherPublishAPI(client);

export const TeacherApp: React.FC = () => {
  const { session, logout, selectedCourseId, setSelectedCourseId } =
    useTeacherStore();
  const [publishing, setPublishing] = useState(false);

  const handleLogout = () => {
    logout();
    setPublishing(false);
  };

  if (!session) {
    return <TeacherLoginPage api={api} onLoginSuccess={() => undefined} />;
  }

  // 课程详情由 selectedCourseId 决定，不默认取第一门课程
  if (selectedCourseId) {
    return (
      <>
        <CourseDetailPage
          api={api}
          courseId={selectedCourseId}
          onBack={() => setSelectedCourseId(null)}
          onEditLesson={() => {
            // TODO(阶段 4): 课节编辑器接入 3D 的时间轴与节点模块
          }}
          onLogout={handleLogout}
          onPublish={() => setPublishing(true)}
        />
        {publishing && (
          <PublishWorkflow
            api={publishApi}
            courseId={selectedCourseId}
            onClose={() => setPublishing(false)}
          />
        )}
      </>
    );
  }

  return (
    <TeacherHomePage
      api={api}
      onSelectCourse={setSelectedCourseId}
      onCreateCourse={() => {
        // TODO(3F): 新建课程表单，待后端 POST /teacher/courses 联通
      }}
      onLogout={handleLogout}
    />
  );
};
