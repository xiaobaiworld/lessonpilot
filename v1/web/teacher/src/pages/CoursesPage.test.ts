/** @vitest-environment happy-dom */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoursesPage } from './CoursesPage';
import type { CourseListItem, Teacher, TeacherAPI } from '../api';

const teacher: Teacher = {
  id: 'teacher-1',
  login_name: 'teacher-01',
  display_name: '测试教师',
  status: 'active',
};

const course = (overrides: Partial<CourseListItem>): CourseListItem => ({
  id: 'course-1',
  title: '互动课程一',
  description: '课程简介',
  status: 'active',
  created_at: '2026-08-27T00:00:00Z',
  updated_at: '2026-08-27T00:00:00Z',
  metrics: {
    lesson_count: 1,
    draft_lesson_count: 1,
    draft_node_count: 1,
    published_node_count: 1,
    access_code_count: 0,
    redeemed_count: 0,
    student_submission_count: null,
    release_number: null,
    published_at: null,
  },
  ...overrides,
});

describe('CoursesPage current course-level access flow', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('shows the revised copy, opens draft titles, publishes drafts, and opens access management', async () => {
    const draft = course({ id: 'course-draft' });
    const published = course({
      id: 'course-published',
      title: '已发布课程',
      version_number: 2,
      metrics: {
        ...draft.metrics,
        release_number: 1,
        published_at: '2026-08-27T00:00:00Z',
      },
    });
    const publish = vi.fn().mockResolvedValue({
      id: 'release-1',
      course_id: 'course-draft',
      release_number: 1,
      lessons: [{ lesson_id: 'lesson-1', title: '第一课' }],
    });
    const api = {
      listCourses: vi.fn().mockResolvedValue([draft, published]),
      publish,
    } as unknown as TeacherAPI;
    const onOpenCourse = vi.fn();
    const onOpenAccessCodes = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(CoursesPage, {
          api,
          teacher,
          onOpenCourse,
          onOpenAccessCodes,
          onSignedOut: vi.fn(),
        })
      );
      await Promise.resolve();
    });

    expect(container.querySelector('h1')?.textContent).toBe('互动课程制作');
    expect(container.textContent).toContain(
      '为视频课程增加互动能力，视频学习过程中加入互动环节，让学习更有趣，提升课程价值。'
    );

    const titleButton = container.querySelector<HTMLButtonElement>('.course-card-title-button');
    expect(titleButton?.textContent).toBe('互动课程一');
    await act(async () => titleButton?.click());
    expect(onOpenCourse).toHaveBeenCalledWith('course-draft');

    const publishButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '发布课程'
    );
    expect(publishButton).toBeDefined();
    await act(async () => {
      publishButton?.click();
      await Promise.resolve();
    });
    expect(publish).toHaveBeenCalledWith('course-draft');

    const accessButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '授权码管理'
    );
    expect(accessButton).toBeDefined();
    await act(async () => accessButton?.click());
    expect(onOpenAccessCodes).toHaveBeenCalledWith('course-published');
    expect(container.textContent).toContain('第 2 版');
  });

  it('confirms published version actions with their exact state semantics', async () => {
    const published = course({
      id: 'course-published',
      title: '已发布课程',
      metrics: {
        ...course({}).metrics,
        release_number: 2,
        published_at: '2026-08-27T00:00:00Z',
      },
    });
    const createVersionDraft = vi.fn()
      .mockResolvedValueOnce({ course: { id: 'modified-draft' } })
      .mockResolvedValueOnce({ course: { id: 'added-draft' } });
    const api = {
      listCourses: vi.fn().mockResolvedValue([published]),
      createVersionDraft,
    } as unknown as TeacherAPI;
    const onOpenCourse = vi.fn();
    const onOpenAccessCodes = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    await act(async () => {
      root.render(
        React.createElement(CoursesPage, {
          api,
          teacher,
          onOpenCourse,
          onOpenAccessCodes,
          onSignedOut: vi.fn(),
        })
      );
      await Promise.resolve();
    });

    const button = (label: string) =>
      Array.from(container.querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === label
      );

    await act(async () => {
      button('修改本版本')?.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('退回草稿区');
    expect(container.textContent).toContain('发布区不再保留这个版本');
    await act(async () => {
      button('确认修改本版本')?.click();
      await Promise.resolve();
    });
    expect(createVersionDraft).toHaveBeenNthCalledWith(1, 'course-published', 'modify');
    expect(onOpenCourse).toHaveBeenCalledWith('modified-draft');

    await act(async () => {
      button('增加版本')?.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('当前已发布版本继续保留');
    expect(container.textContent).toContain('复制一份到草稿区');
    await act(async () => {
      button('确认增加版本')?.click();
      await Promise.resolve();
    });
    expect(createVersionDraft).toHaveBeenNthCalledWith(2, 'course-published', 'add');
    expect(onOpenCourse).toHaveBeenCalledWith('added-draft');

    await act(async () => button('授权码管理')?.click());
    expect(onOpenAccessCodes).toHaveBeenCalledWith('course-published');
  });

  it('archives a draft from the dashboard instead of physically deleting it', async () => {
    const draft = course({ id: 'course-draft' });
    const archiveCourse = vi.fn().mockResolvedValue({ ...draft, status: 'archived' });
    const api = {
      listCourses: vi.fn()
        .mockResolvedValueOnce([draft])
        .mockResolvedValueOnce([{ ...draft, status: 'archived' }]),
      archiveCourse,
    } as unknown as TeacherAPI;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    await act(async () => {
      root.render(
        React.createElement(CoursesPage, {
          api,
          teacher,
          onOpenCourse: vi.fn(),
          onSignedOut: vi.fn(),
        })
      );
      await Promise.resolve();
    });

    const button = Array.from(container.querySelectorAll('button')).find(
      (item) => item.textContent?.trim() === '删除草稿'
    );
    await act(async () => {
      button?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(archiveCourse).toHaveBeenCalledWith('course-draft');
    expect(container.textContent).toContain('已归档');
    root.unmount();
  });
});
