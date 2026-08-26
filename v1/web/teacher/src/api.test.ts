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
});
