import { APIClient } from '@v1/web/shared';

/** 与 v1/backend/app/modules/identity/schemas.py 对齐 */

export interface Admin {
  id: string;
  login_name: string;
  display_name: string;
  status: string;
}

export interface Teacher {
  id: string;
  login_name: string;
  display_name: string;
  status: string;
  published_course_count: number;
  created_at: string;
  updated_at: string;
}

export interface TeacherMutation {
  teacher: Teacher;
  temporary_password: string;
}

export type TrialFollowupStatus = 'pending' | 'contacted' | 'closed';

export interface TrialApplication {
  id: string;
  name: string;
  contact: string;
  courseCategory: string;
  videoStatus: string;
  bilibiliUrl: string | null;
  teachingProblem: string;
  subtitleStatus: string;
  validationQuestion: string | null;
  source: string;
  submittedAt: string;
  followupId: string;
  status: TrialFollowupStatus;
}

const BASE = '/api/v1/admin';

/**
 * 会话走 HttpOnly Cookie，前端不持有也读不到 token，
 * 所以这些方法都不需要传凭据参数。
 */
export class AdminAPI {
  constructor(private http: APIClient) {}

  async login(loginName: string, password: string): Promise<Admin> {
    const res = await this.http.post<{ admin: Admin }>(`${BASE}/auth/login`, {
      login_name: loginName,
      password,
    });
    return res.admin;
  }

  /** 恢复会话；未登录时后端返回 401，由调用方转为登录页 */
  async me(): Promise<Admin> {
    const res = await this.http.get<{ admin: Admin }>(`${BASE}/auth/me`);
    return res.admin;
  }

  logout(): Promise<{ logged_out: boolean }> {
    return this.http.post(`${BASE}/auth/logout`);
  }

  /** 后端返回裸数组，不是 { teachers: [] } */
  listTeachers(): Promise<Teacher[]> {
    return this.http.get<Teacher[]>(`${BASE}/teachers`);
  }

  createTeacher(loginName: string, displayName: string): Promise<TeacherMutation> {
    return this.http.post<TeacherMutation>(`${BASE}/teachers`, {
      login_name: loginName,
      display_name: displayName,
    });
  }

  resetPassword(teacherId: string): Promise<TeacherMutation> {
    return this.http.post<TeacherMutation>(
      `${BASE}/teachers/${teacherId}/reset-password`
    );
  }

  listTrialApplications(): Promise<TrialApplication[]> {
    return this.http.get<TrialApplication[]>(`${BASE}/trial-applications`);
  }

  updateTrialFollowup(
    followupId: string,
    status: TrialFollowupStatus
  ): Promise<{ id: string; trial_application_id: string; status: TrialFollowupStatus }> {
    return this.http.patch(`${BASE}/trial-followups/${followupId}`, { status });
  }
}
