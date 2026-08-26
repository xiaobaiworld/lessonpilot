import { APIClient, AssetRecord, PortableNode } from '@v1/web/shared';

/**
 * 与后端 schema 对齐：
 * v1/backend/app/modules 下各模块的 schemas.py
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
  video_ref: { platform: 'bilibili'; video_id: string };
  has_draft: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CourseDetail extends CourseSummary {
  lessons: Lesson[];
}

/**
 * 互动节点。四种 family/interaction 组合由后端 schema 固定：
 * attention/notice、practice/choice、practice/blank、practice/free_text
 */
export type NodeKind = 'notice' | 'choice' | 'blank' | 'free_text';
export type ScriptNode = PortableNode;

export interface ScriptDraft {
  schema_version: number;
  revision: number;
  config: { nodes: ScriptNode[]; assets: AssetRecord[] };
  lesson_id: string;
  node_count: number;
  updated_at: string;
}

/** 发布返回的是课程包本身 */
export interface CourseRelease {
  id: string;
  course_id: string;
  release_number: number;
  lessons: { lesson_id: string; title: string }[];
}

export interface AccessCode {
  access_code: string;
  id: string;
  display_tail: string;
  status: string;
  created_at: string;
}

export class TeacherAPI {
  constructor(private http: APIClient) {}

  async login(loginName: string, password: string): Promise<Teacher> {
    const res = await this.http.post<{ teacher: Teacher }>('/api/v1/teacher/auth/login', {
      login_name: loginName,
      password,
    });
    return res.teacher;
  }

  async me(): Promise<Teacher> {
    const res = await this.http.get<{ teacher: Teacher }>('/api/v1/teacher/auth/me');
    return res.teacher;
  }

  logout(): Promise<{ logged_out: boolean }> {
    return this.http.post('/api/v1/teacher/auth/logout');
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

  /** BVID 形如 BV1Ac41187Lm，后端按 ^BV[a-zA-Z0-9]+$ 校验 */
  createLesson(courseId: string, title: string, bvid: string): Promise<Lesson> {
    return this.http.post<Lesson>(`/api/v1/teacher/courses/${courseId}/lessons`, {
      title,
      video_ref: { platform: 'bilibili', video_id: bvid },
    });
  }

  createCourse(title: string, description?: string): Promise<CourseSummary> {
    return this.http.post<CourseSummary>('/api/v1/teacher/courses', {
      title,
      description: description || null,
    });
  }

  /** 草稿不存在时后端返回空 nodes，不是 404 */
  getDraft(lessonId: string): Promise<ScriptDraft> {
    return this.http.get<ScriptDraft>(`/api/v1/teacher/lessons/${lessonId}/draft`);
  }

  /** 整份覆盖保存。后端做原子校验，任一节点不合法就整份拒绝 */
  saveDraft(
    lessonId: string,
    nodes: ScriptNode[],
    revision: number | null,
    assets: AssetRecord[] = []
  ): Promise<ScriptDraft> {
    return this.http.put<ScriptDraft>(`/api/v1/teacher/lessons/${lessonId}/draft`, {
      schema_version: 1,
      revision,
      config: { nodes, assets },
    });
  }

  async testPreview(lessonId: string): Promise<void> {
    const preview = await this.http.post<{ id: string }>(
      `/api/v1/teacher/lessons/${lessonId}/preview-sessions`,
      {}
    );
    // ponytail: 开发阶段按测试回合确认；接真实播放器后由插件回传 succeeded。
    await this.http.post(`/api/v1/teacher/preview-sessions/${preview.id}/end`, {
      succeeded: true,
    });
  }

  attestRights(courseId: string): Promise<{ id: string }> {
    return this.http.post(`/api/v1/teacher/courses/${courseId}/rights-attestation`, {
      statement_version: '1',
      accepted: true,
    });
  }

  publish(courseId: string): Promise<CourseRelease> {
    return this.http.post<CourseRelease>(`/api/v1/teacher/courses/${courseId}/releases`, {
      idempotency_key: crypto.randomUUID(),
    });
  }

  createAccessCode(courseId: string): Promise<AccessCode> {
    return this.http.post<AccessCode>('/api/v1/teacher/access-codes', {
      idempotency_key: crypto.randomUUID(),
      grants: [{ course_id: courseId, scope: 'course' }],
    });
  }
}
