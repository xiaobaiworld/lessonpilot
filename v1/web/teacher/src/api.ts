import { APIClient } from '@v1/web/shared';

/**
 * 与后端 schema 对齐：
 * backend/app/schemas/{auth,course,lesson,access_code}.py
 * 会话走 HttpOnly Cookie，前端不持有 token。
 */

export interface Teacher {
  id: string;
  login_name: string;
  display_name: string;
  status: string;
}

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  /** 后端字段是 sort_order，不是 sequence */
  sort_order: number;
  video_ref: { platform: 'bilibili'; videoId: string };
  has_draft: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CourseDetail extends CourseSummary {
  lessons: Lesson[];
}

/** 发布返回的是课程包本身 */
export interface CoursePackage {
  schemaVersion: 2;
  courseId: string;
  title: string;
  lessons: { lessonId: string; title: string; nodes: unknown[] }[];
  updatedAt: string;
}

export interface AccessCode {
  access_code: string;
  course_id: string;
  course_title: string;
  code_type: 'short_term' | 'long_term';
  created_at: string;
  expires_at: string | null;
}

export class TeacherAPI {
  constructor(private http: APIClient) {}

  async login(loginName: string, password: string): Promise<Teacher> {
    const res = await this.http.post<{ teacher: Teacher }>('/api/v1/auth/login', {
      login_name: loginName,
      password,
    });
    return res.teacher;
  }

  async me(): Promise<Teacher> {
    const res = await this.http.get<{ teacher: Teacher }>('/api/v1/auth/me');
    return res.teacher;
  }

  logout(): Promise<{ logged_out: boolean }> {
    return this.http.post('/api/v1/auth/logout');
  }

  async listCourses(): Promise<CourseSummary[]> {
    const res = await this.http.get<{ items: CourseSummary[] }>(
      '/api/v1/teacher/courses'
    );
    return res.items;
  }

  getCourse(courseId: string): Promise<CourseDetail> {
    return this.http.get<CourseDetail>(`/api/v1/teacher/courses/${courseId}`);
  }

  createCourse(title: string, description?: string): Promise<CourseSummary> {
    return this.http.post<CourseSummary>('/api/v1/teacher/courses', {
      title,
      description: description || null,
    });
  }

  publish(courseId: string): Promise<CoursePackage> {
    return this.http.post<CoursePackage>(
      `/api/v1/teacher/courses/${courseId}/publish`
    );
  }

  createAccessCode(
    courseId: string,
    codeType: 'short_term' | 'long_term' = 'long_term'
  ): Promise<AccessCode> {
    return this.http.post<AccessCode>(
      `/api/v1/teacher/courses/${courseId}/access-codes`,
      { code_type: codeType }
    );
  }
}
