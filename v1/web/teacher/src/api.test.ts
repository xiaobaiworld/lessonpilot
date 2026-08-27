import { afterEach, describe, expect, it, vi } from 'vitest';
import { APIClient } from '@v1/web/shared';
import { TeacherAPI } from './api';

describe('TeacherAPI authentication paths', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the role-isolated v1 teacher auth path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        teacher: {
          id: 'teacher-1',
          login_name: 'teacher-01',
          display_name: '测试教师',
          status: 'active',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new TeacherAPI(new APIClient('http://127.0.0.1:8001')).login(
      'teacher-01',
      'password'
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8001/api/v1/teacher/auth/login',
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('uploads a subtitle to the repair endpoint before draft save', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        repaired: true,
        changes: ['第 2 条字幕的开始时间已调整为上一条字幕的结束时间'],
        subtitle: {
          schemaVersion: 1,
          filename: '相信自己，自信地说英语.srt',
          format: 'srt',
          content: 'fixed',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['subtitle'], '相信自己，自信地说英语.srt', { type: 'text/plain' });

    await expect(
      new TeacherAPI(new APIClient('http://127.0.0.1:8001')).repairSubtitle(file)
    ).resolves.toMatchObject({ repaired: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8001/api/v1/teacher/subtitles/repair',
      expect.objectContaining({ method: 'POST', credentials: 'include', body: expect.any(FormData) })
    );
  });

  it('saves the subtitle document together with the complete draft aggregate', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        schema_version: 1,
        revision: 2,
        config: { nodes: [], assets: [], subtitle: null },
        lesson_id: 'lesson-1',
        node_count: 0,
        updated_at: '2026-08-26T00:00:00Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const subtitle = {
      schemaVersion: 1 as const,
      filename: 'lesson.srt',
      format: 'srt' as const,
      content: '1\n00:00:01,000 --> 00:00:02,000\nHello\n',
    };
    await new TeacherAPI(new APIClient('http://127.0.0.1:8001')).saveDraft(
      'lesson-1',
      [],
      1,
      [],
      subtitle
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8001/api/v1/teacher/lessons/lesson-1/draft',
      expect.objectContaining({
        body: JSON.stringify({
          schema_version: 1,
          revision: 1,
          config: { nodes: [], assets: [], subtitle },
        }),
      })
    );
  });

  it('读取课程列表时保留课程总览指标', async () => {
    const item = {
      id: 'course-1',
      title: '课程一',
      description: null,
      status: 'active',
      revision: 1,
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
      metrics: {
        lesson_count: 3,
        draft_lesson_count: 1,
        draft_node_count: 2,
        published_node_count: 8,
        access_code_count: 4,
        redeemed_count: 6,
        student_submission_count: null,
        release_number: 2,
        published_at: '2026-08-26T00:00:00Z',
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [item] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new TeacherAPI(new APIClient('http://127.0.0.1:8001')).listCourses()
    ).resolves.toEqual([item]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8001/api/v1/teacher/courses',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('为课程总览生成按 course_id 绑定的授权码', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        access_code: 'KM-COURSE-0001',
        id: 'grant-1',
        display_tail: '0001',
        status: 'active',
        created_at: '2026-08-27T00:00:00Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new TeacherAPI(new APIClient('http://127.0.0.1:8001')).createAccessCode('course-1')
    ).resolves.toMatchObject({ access_code: 'KM-COURSE-0001' });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      grants: [{ course_id: 'course-1', scope: 'course' }],
    });
  });

  it('管理课程版本草稿和授权码', async () => {
    const responses = [
      {
        status: 201,
        body: {
          source_course_id: 'course-1',
          source_release_id: 'release-1',
          mode: 'modify',
          source_retained: false,
          replayed: false,
          course: { id: 'course-draft', title: '课程草稿' },
        },
      },
      {
        status: 200,
        body: { items: [{ id: 'code-1', access_code: 'KM-AAAAA-BBBBB-CCCCC' }] },
      },
      {
        status: 201,
        body: {
          items: [
            { id: 'code-2', access_code: 'KM-DDDDD-EEEEE-FFFFF' },
            { id: 'code-3', access_code: 'KM-GGGGG-HHHHH-IIIII' },
            { id: 'code-4', access_code: 'KM-JJJJJ-KKKKK-LLLLL' },
          ],
        },
      },
      {
        status: 200,
        body: { id: 'code-1', access_code: 'KM-AAAAA-BBBBB-CCCCC', status: 'terminated' },
      },
    ];
    const fetchMock = vi.fn().mockImplementation(async () => {
      const response = responses.shift();
      return {
        ok: true,
        status: response?.status ?? 200,
        json: async () => response?.body,
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = new TeacherAPI(new APIClient('http://127.0.0.1:8001'));

    await expect(api.createVersionDraft('course-1', 'modify')).resolves.toMatchObject({
      course: { id: 'course-draft' },
    });
    await expect(api.listAccessCodes('course-1')).resolves.toHaveLength(1);
    await expect(api.createAccessCodeBatch('course-1', 3)).resolves.toHaveLength(3);
    await expect(api.terminateAccessCode('code-1')).resolves.toMatchObject({
      status: 'terminated',
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://127.0.0.1:8001/api/v1/teacher/courses/course-1/version-drafts'
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
      mode: 'modify',
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'http://127.0.0.1:8001/api/v1/teacher/access-codes?course_id=course-1'
    );
    expect(JSON.parse(String(fetchMock.mock.calls[2][1].body))).toMatchObject({
      count: 3,
      grants: [{ course_id: 'course-1', scope: 'course' }],
    });
    expect(fetchMock.mock.calls[3][0]).toBe(
      'http://127.0.0.1:8001/api/v1/teacher/access-codes/code-1/terminate'
    );
  });
});
