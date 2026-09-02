/** @vitest-environment happy-dom */

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessCodesPage, beijingLocalToUtc, formatDateTime } from './AccessCodesPage';
import type { CourseDetail, ManagedAccessCode, Teacher, TeacherAPI } from '../api';

const teacher: Teacher = {
  id: 'teacher-1',
  login_name: 'teacher-01',
  display_name: '测试教师',
  status: 'active',
};

const course: CourseDetail = {
  id: 'course-1',
  version_family_id: 'family-1',
  source_course_id: null,
  source_release_id: null,
  version_number: 2,
  title: '互动课程一',
  description: '课程简介',
  status: 'active',
  revision: 1,
  created_at: '2026-08-27T00:00:00Z',
  updated_at: '2026-08-27T00:00:00Z',
  lessons: [],
};

const code = (overrides: Partial<ManagedAccessCode> = {}): ManagedAccessCode => ({
  id: 'code-1',
  access_code: 'KM-AAAAA-BBBBB-CCCCC',
  display_tail: 'CCCCC',
  status: 'active',
  recipient_label: null,
  recipient_note: null,
  redeem_from: null,
  redeem_until: null,
  created_at: '2026-08-27T00:00:00Z',
  redemption_count: 2,
  first_redeemed_at: '2026-08-27T10:00:00Z',
  last_redeemed_at: '2026-08-27T12:00:00Z',
  grants: [{ course_id: 'course-1', scope: 'course', lesson_ids: [], node_ids: [] }],
  ...overrides,
});

describe('AccessCodesPage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('按北京时间显示并把输入转换为 UTC 传输', () => {
    expect(formatDateTime('2026-08-27T04:00:00.000Z')).toContain('12:00');
    expect(beijingLocalToUtc('2026-08-27T12:00')).toBe('2026-08-27T04:00:00.000Z');
  });

  it('lists codes, batch-generates codes, and terminates an active code', async () => {
    const createAccessCodeBatch = vi.fn().mockResolvedValue([
      code({ id: 'code-2', access_code: 'KM-DDDDD-EEEEE-FFFFF', redemption_count: 0 }),
      code({ id: 'code-3', access_code: 'KM-GGGGG-HHHHH-IIIII', redemption_count: 0 }),
      code({ id: 'code-4', access_code: 'KM-JJJJJ-KKKKK-LLLLL', redemption_count: 0 }),
    ]);
    const terminateAccessCode = vi.fn().mockResolvedValue(code({ status: 'terminated' }));
    const api = {
      getCourse: vi.fn().mockResolvedValue(course),
      listAccessCodes: vi.fn().mockResolvedValue([code()]),
      createAccessCodeBatch,
      terminateAccessCode,
    } as unknown as TeacherAPI;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    await act(async () => {
      root.render(
        React.createElement(AccessCodesPage, {
          api,
          teacher,
          courseId: 'course-1',
          onBack: vi.fn(),
          onSignedOut: vi.fn(),
        })
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain('授权码管理');
    expect(container.textContent).toContain('KM-AAAAA-BBBBB-CCCCC');
    expect(container.textContent).toContain('已领取 2 台设备');

    const countInput = container.querySelector<HTMLInputElement>('input[name="count"]');
    expect(countInput).not.toBeNull();
    await act(async () => {
      if (countInput) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        setter?.call(countInput, '3');
        countInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await Promise.resolve();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.access-code-create-footer button')?.click();
      await Promise.resolve();
    });
    expect(createAccessCodeBatch).toHaveBeenCalledWith('course-1', 3);
    expect(container.textContent).toContain('KM-DDDDD-EEEEE-FFFFF');
    expect(container.textContent).toContain('KM-JJJJJ-KKKKK-LLLLL');

    await act(async () => {
      const originalRow = Array.from(container.querySelectorAll('tr')).find((row) =>
        row.textContent?.includes('KM-AAAAA-BBBBB-CCCCC')
      );
      originalRow
        ?.querySelector<HTMLButtonElement>('[data-label="操作"] button')
        ?.click();
      await Promise.resolve();
    });
    expect(terminateAccessCode).toHaveBeenCalledWith('code-1');
  });
});
