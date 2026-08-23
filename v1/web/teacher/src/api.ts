/**
 * 教师应用 API 服务
 */

import { APIClient } from '@v1/web/shared';
import { TeacherSession, Course, Lesson } from './store';

export interface TeacherLoginResponse {
  token: string;
  teacher_id: string;
  login_name: string;
  expires_at: number;
}

export interface CourseDetailResponse {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
  lessons: Array<{
    id: string;
    sequence: number;
    title: string;
    node_count: number;
  }>;
  published_count: number;
}

export class TeacherAPI {
  constructor(private client: APIClient) {}

  async login(loginName: string, password: string): Promise<TeacherSession> {
    const response = await this.client.post<TeacherLoginResponse>(
      '/api/v1/teacher/auth/login',
      { login_name: loginName, password }
    );

    return {
      token: response.token,
      teacherId: response.teacher_id,
      loginName: response.login_name,
      expiresAt: response.expires_at,
    };
  }

  async logout(token: string): Promise<void> {
    await this.client.post(
      '/api/v1/teacher/auth/logout',
      {},
      { Authorization: `Bearer ${token}` }
    );
  }

  async getCourses(token: string): Promise<Course[]> {
    const response = await this.client.get<{ courses: CourseDetailResponse[] }>(
      '/api/v1/teacher/courses',
      { Authorization: `Bearer ${token}` }
    );

    return response.courses.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      published_count: c.published_count,
      lessons: c.lessons,
    }));
  }

  async getCourse(token: string, courseId: string): Promise<Course> {
    const response = await this.client.get<CourseDetailResponse>(
      `/api/v1/teacher/courses/${courseId}`,
      { Authorization: `Bearer ${token}` }
    );

    return {
      id: response.id,
      title: response.title,
      status: response.status,
      published_count: response.published_count,
      lessons: response.lessons,
    };
  }

  async createCourse(
    token: string,
    title: string
  ): Promise<Course> {
    const response = await this.client.post<CourseDetailResponse>(
      '/api/v1/teacher/courses',
      { title },
      { Authorization: `Bearer ${token}` }
    );

    return {
      id: response.id,
      title: response.title,
      status: response.status,
      published_count: response.published_count,
      lessons: response.lessons,
    };
  }

  async updateCourse(
    token: string,
    courseId: string,
    updates: { title?: string; status?: string }
  ): Promise<Course> {
    const response = await this.client.put<CourseDetailResponse>(
      `/api/v1/teacher/courses/${courseId}`,
      updates,
      { Authorization: `Bearer ${token}` }
    );

    return {
      id: response.id,
      title: response.title,
      status: response.status,
      published_count: response.published_count,
      lessons: response.lessons,
    };
  }

  async deleteCourse(token: string, courseId: string): Promise<void> {
    await this.client.delete(
      `/api/v1/teacher/courses/${courseId}`,
      { Authorization: `Bearer ${token}` }
    );
  }
}
