/** @vitest-environment happy-dom */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoursePage } from './CoursePage';
import type { CourseDetail, Teacher, TeacherAPI } from '../api';

const teacher: Teacher = {
  id: 'teacher-1',
  login_name: 'teacher-01',
  display_name: '测试教师',
  status: 'active',
};

const course = (status: string): CourseDetail => ({
  id: 'course-1',
  version_family_id: 'family-1',
  source_course_id: null,
  source_release_id: null,
  version_number: 1,
  title: '互动课程一',
  description: '课程简介',
  status,
  revision: 1,
  created_at: '2026-08-27T00:00:00Z',
  updated_at: '2026-08-27T00:00:00Z',
  lessons: [
    {
      id: 'lesson-1',
      course_id: 'course-1',
      title: '第一课',
      sort_order: 1,
      video_ref: {
        platform: 'bilibili',
        video_id: 'BV1Ac41187Lm',
        page: 1,
        cid: null,
      },
      has_draft: false,
      status: 'active',
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    },
  ],
});

const renderCourse = async (status: string) => {
  const api = {
    getCourse: vi.fn().mockResolvedValue(course(status)),
    createAccessCode: vi.fn(),
  } as unknown as TeacherAPI;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      React.createElement(CoursePage, {
        api,
        teacher,
        courseId: 'course-1',
        onBack: vi.fn(),
        onSignedOut: vi.fn(),
        onEditLesson: vi.fn(),
      })
    );
    await Promise.resolve();
  });

  return { api, container, root };
};

describe('CoursePage access-code action visibility', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('does not show access-code generation for a draft course', async () => {
    const { container, root } = await renderCourse('draft');

    expect(
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === '生成授权码'
      )
    ).toBeUndefined();
    root.unmount();
  });

  it('shows access-code generation for a published course', async () => {
    const { container, root } = await renderCourse('active');

    expect(
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === '生成授权码'
      )
    ).toBeDefined();
    root.unmount();
  });
});
