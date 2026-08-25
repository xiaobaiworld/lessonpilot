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
});
