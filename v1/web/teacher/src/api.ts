import { APIClient, AssetRecord, PortableNode, PresentationHints, SubtitleDocument } from '@v1/web/shared';

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
  version_family_id?: string;
  source_course_id?: string | null;
  source_release_id?: string | null;
  version_number?: number;
  title: string;
  description: string | null;
  status: string;
  revision?: number;
  created_at: string;
  updated_at: string;
}

export interface CourseMetrics {
  lesson_count: number;
  draft_lesson_count: number;
  draft_node_count: number;
  published_node_count: number;
  access_code_count: number;
  redeemed_count: number;
  student_submission_count: number | null;
  release_number: number | null;
  published_at: string | null;
}

export interface CourseListItem extends CourseSummary {
  metrics: CourseMetrics;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  /** 后端字段是 sort_order，不是 sequence */
  sort_order: number;
  video_ref: BilibiliVideoRef;
  has_draft: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BilibiliVideoRef {
  platform: 'bilibili';
  video_id: string;
  page: number;
  cid: string | null;
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
  config: { nodes: ScriptNode[]; assets: AssetRecord[]; subtitle: SubtitleDocument | null };
  lesson_id: string;
  node_count: number;
  updated_at: string;
}

export interface NodePresentationPublic {
  lessonId: string;
  nodeId: string;
  revision: number;
  presentationHints: PresentationHints;
}

export interface SubtitleRepairResult {
  valid: true;
  repaired: boolean;
  changes: string[];
  subtitle: SubtitleDocument;
}

export interface TeacherCourseFile {
  schemaVersion: 1;
  fileType: 'teacher-course';
  source: {
    type: 'draft' | 'release';
    courseId: string;
    releaseId: string | null;
    releaseNumber: number | null;
  };
  course: {
    title: string;
    description: string | null;
    lessons: Array<Record<string, unknown>>;
  };
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

export interface VersionDraftResult {
  source_course_id: string;
  source_release_id: string;
  mode: 'modify' | 'add';
  source_retained: boolean;
  replayed: boolean;
  course: CourseSummary;
}

export interface ManagedAccessCode {
  id: string;
  access_code: string;
  display_tail: string;
  status: string;
  recipient_label: string | null;
  recipient_note: string | null;
  redeem_from: string | null;
  redeem_until: string | null;
  created_at: string;
  redemption_count: number;
  first_redeemed_at: string | null;
  last_redeemed_at: string | null;
  status_events?: Array<{
    action: string;
    result: string;
    reason_code: string | null;
    occurred_at: string;
  }>;
  grants: Array<{
    course_id: string;
    scope: string;
    lesson_ids: string[];
    node_ids: string[];
  }>;
}

export interface AccessCodeGrantInput {
  course_id: string;
  scope: 'course' | 'lessons' | 'nodes';
  lesson_ids?: string[];
  node_ids?: string[];
  valid_from?: string | null;
  valid_until?: string | null;
}

export interface AccessCodeCreateOptions {
  grants?: AccessCodeGrantInput[];
  redeem_from?: string | null;
  redeem_until?: string | null;
  recipient_label?: string | null;
  recipient_note?: string | null;
}

export type AccessCodeBatchAction = 'freeze' | 'restore' | 'terminate';

export class TeacherAPI {
  constructor(private http: APIClient) {}

  uploadAsset(file: File): Promise<AssetRecord> {
    const form = new FormData();
    form.append('file', file);
    return this.http.postForm<AssetRecord>('/api/v1/teacher/assets/upload', form);
  }

  importAssetUrl(url: string): Promise<AssetRecord> {
    return this.http.post<AssetRecord>('/api/v1/teacher/assets/import-url', { url });
  }

  assetUrl(assetId: string): string {
    return this.http.url(`/api/v1/teacher/assets/${encodeURIComponent(assetId)}`);
  }

  repairSubtitle(file: File): Promise<SubtitleRepairResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.postForm<SubtitleRepairResult>('/api/v1/teacher/subtitles/repair', form);
  }

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

  async listCourses(): Promise<CourseListItem[]> {
    const res = await this.http.get<{ items: CourseListItem[] }>(
      '/api/v1/teacher/courses'
    );
    return res.items;
  }

  getCourse(courseId: string): Promise<CourseDetail> {
    return this.http.get<CourseDetail>(`/api/v1/teacher/courses/${courseId}`);
  }

  archiveCourse(courseId: string): Promise<CourseSummary> {
    return this.http.post<CourseSummary>(`/api/v1/teacher/courses/${courseId}/archive`);
  }

  createLesson(courseId: string, title: string, videoRef: BilibiliVideoRef): Promise<Lesson> {
    return this.http.post<Lesson>(`/api/v1/teacher/courses/${courseId}/lessons`, {
      title,
      video_ref: videoRef,
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
    assets: AssetRecord[] = [],
    subtitle: SubtitleDocument | null = null
  ): Promise<ScriptDraft> {
    return this.http.put<ScriptDraft>(`/api/v1/teacher/lessons/${lessonId}/draft`, {
      schema_version: 1,
      revision,
      config: { nodes, assets, subtitle },
    });
  }

  updateNodePresentation(
    lessonId: string,
    nodeId: string,
    revision: number,
    presentationHints: PresentationHints,
  ): Promise<NodePresentationPublic> {
    return this.http.put<NodePresentationPublic>(
      `/api/v1/teacher/lessons/${lessonId}/draft/nodes/${nodeId}/presentation`,
      { revision, presentationHints },
    );
  }

  exportCourseFile(courseId: string, releaseId?: string): Promise<TeacherCourseFile> {
    const query = releaseId ? `?source=release&release_id=${encodeURIComponent(releaseId)}` : '';
    return this.http.get<TeacherCourseFile>(`/api/v1/teacher/courses/${courseId}/course-file${query}`);
  }

  previewCourseFile(file: TeacherCourseFile): Promise<{ valid: boolean; summary: Record<string, unknown> }> {
    return this.http.post<{ valid: boolean; summary: Record<string, unknown> }>(
      '/api/v1/teacher/course-files/import/preview',
      { file }
    );
  }

  importCourseFile(file: TeacherCourseFile): Promise<{ course: { id: string; title: string } }> {
    return this.http.post<{ course: { id: string; title: string } }>(
      '/api/v1/teacher/course-files/import',
      { file, confirm: true }
    );
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

  publish(courseId: string): Promise<CourseRelease> {
    return this.http.post<CourseRelease>(`/api/v1/teacher/courses/${courseId}/releases`, {
      idempotency_key: crypto.randomUUID(),
    });
  }

  createAccessCode(courseId: string, options: AccessCodeCreateOptions = {}): Promise<AccessCode> {
    return this.http.post<AccessCode>('/api/v1/teacher/access-codes', {
      idempotency_key: crypto.randomUUID(),
      grants: options.grants ?? [{ course_id: courseId, scope: 'course' }],
      redeem_from: options.redeem_from ?? null,
      redeem_until: options.redeem_until ?? null,
      recipient_label: options.recipient_label ?? null,
      recipient_note: options.recipient_note ?? null,
    });
  }

  createVersionDraft(
    courseId: string,
    mode: 'modify' | 'add'
  ): Promise<VersionDraftResult> {
    return this.http.post<VersionDraftResult>(
      `/api/v1/teacher/courses/${courseId}/version-drafts`,
      { mode, idempotency_key: crypto.randomUUID() }
    );
  }

  async listAccessCodes(courseId: string): Promise<ManagedAccessCode[]> {
    const res = await this.http.get<{ items: ManagedAccessCode[] }>(
      `/api/v1/teacher/access-codes?course_id=${encodeURIComponent(courseId)}`
    );
    return res.items;
  }

  async getAccessCode(accessCodeId: string): Promise<ManagedAccessCode> {
    return this.http.get<ManagedAccessCode>(
      `/api/v1/teacher/access-codes/${encodeURIComponent(accessCodeId)}`
    );
  }

  async createAccessCodeBatch(
    courseId: string,
    count: number,
    options: AccessCodeCreateOptions = {}
  ): Promise<ManagedAccessCode[]> {
    const res = await this.http.post<{ items: ManagedAccessCode[] }>(
      '/api/v1/teacher/access-codes/batch',
      {
        idempotency_key: crypto.randomUUID(),
        count,
        grants: options.grants ?? [{ course_id: courseId, scope: 'course' }],
        redeem_from: options.redeem_from ?? null,
        redeem_until: options.redeem_until ?? null,
        recipient_label: options.recipient_label ?? null,
        recipient_note: options.recipient_note ?? null,
      }
    );
    return res.items;
  }

  async updateAccessCodeRecipient(
    accessCodeId: string,
    recipientLabel: string | null,
    recipientNote: string | null
  ): Promise<ManagedAccessCode> {
    return this.http.put<ManagedAccessCode>(
      `/api/v1/teacher/access-codes/${encodeURIComponent(accessCodeId)}/recipient`,
      { recipient_label: recipientLabel, recipient_note: recipientNote }
    );
  }

  freezeAccessCode(accessCodeId: string): Promise<ManagedAccessCode> {
    return this.http.post<ManagedAccessCode>(
      `/api/v1/teacher/access-codes/${encodeURIComponent(accessCodeId)}/freeze`
    );
  }

  restoreAccessCode(accessCodeId: string): Promise<ManagedAccessCode> {
    return this.http.post<ManagedAccessCode>(
      `/api/v1/teacher/access-codes/${encodeURIComponent(accessCodeId)}/restore`
    );
  }

  async batchAccessCodeAction(
    accessCodeIds: string[],
    action: AccessCodeBatchAction
  ): Promise<ManagedAccessCode[]> {
    const res = await this.http.post<{ items: ManagedAccessCode[] }>(
      '/api/v1/teacher/access-codes/batch-actions',
      {
        access_code_ids: accessCodeIds,
        action,
        idempotency_key: crypto.randomUUID(),
      }
    );
    return res.items;
  }

  terminateAccessCode(accessCodeId: string): Promise<ManagedAccessCode> {
    return this.http.post<ManagedAccessCode>(
      `/api/v1/teacher/access-codes/${encodeURIComponent(accessCodeId)}/terminate`
    );
  }
}
