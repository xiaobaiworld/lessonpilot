/**
 * 管理员应用 API 服务
 * 调用后端管理员 API
 */

import { APIClient, APIError } from '@v1/web/shared';
import { AdminSession, Teacher } from './store';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  admin_id: string;
  email: string;
  expires_at: number;
}

export interface CreateTeacherResponse {
  teacher_id: string;
  login_name: string;
  temporary_password: string;
}

export interface ResetPasswordResponse {
  teacher_id: string;
  temporary_password: string;
}

export class AdminAPI {
  constructor(private client: APIClient) {}

  async login(email: string, password: string): Promise<AdminSession> {
    const response = await this.client.post<LoginResponse>('/api/v1/admin/auth/login', {
      email,
      password,
    });

    return {
      token: response.token,
      adminId: response.admin_id,
      email: response.email,
      expiresAt: response.expires_at,
    };
  }

  async getMe(token: string): Promise<{ admin_id: string; email: string }> {
    return this.client.get('/api/v1/admin/auth/me', {
      Authorization: `Bearer ${token}`,
    });
  }

  async logout(token: string): Promise<void> {
    await this.client.post(
      '/api/v1/admin/auth/logout',
      {},
      { Authorization: `Bearer ${token}` }
    );
  }

  async getTeachers(token: string): Promise<Teacher[]> {
    const response = await this.client.get<{ teachers: Teacher[] }>(
      '/api/v1/admin/teachers',
      { Authorization: `Bearer ${token}` }
    );
    return response.teachers;
  }

  async createTeacher(
    token: string,
    loginName: string,
    displayName: string
  ): Promise<CreateTeacherResponse> {
    return this.client.post<CreateTeacherResponse>(
      '/api/v1/admin/teachers',
      {
        login_name: loginName,
        display_name: displayName,
      },
      { Authorization: `Bearer ${token}` }
    );
  }

  async resetPassword(token: string, teacherId: string): Promise<ResetPasswordResponse> {
    return this.client.post<ResetPasswordResponse>(
      `/api/v1/admin/teachers/${teacherId}/reset-password`,
      {},
      { Authorization: `Bearer ${token}` }
    );
  }

  async suspendTeacher(token: string, teacherId: string): Promise<void> {
    await this.client.post(
      `/api/v1/admin/teachers/${teacherId}/suspend`,
      {},
      { Authorization: `Bearer ${token}` }
    );
  }

  async restoreTeacher(token: string, teacherId: string): Promise<void> {
    await this.client.post(
      `/api/v1/admin/teachers/${teacherId}/restore`,
      {},
      { Authorization: `Bearer ${token}` }
    );
  }
}
