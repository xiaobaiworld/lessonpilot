/**
 * 教师应用 - 发布与授权 API 扩展
 */

import { APIClient } from '@v1/web/shared';
import { Course } from './store';

export interface PublishResponse {
  release_id: string;
  release_number: number;
  lesson_count: number;
  published_at: string;
}

export interface DraftSaveResponse {
  revision: number;
  saved_at: string;
  digest: string;
}

export interface AccessCodeResponse {
  code: string;
  display_tail: string;
  expires_at: string;
  scope: string;
}

export class TeacherPublishAPI {
  constructor(private client: APIClient) {}

  /**
   * 保存草稿
   */
  async saveDraft(
    token: string,
    courseId: string,
    content: unknown,
    currentRevision: number
  ): Promise<DraftSaveResponse> {
    return this.client.post<DraftSaveResponse>(
      `/api/v1/teacher/courses/${courseId}/draft`,
      { content, revision: currentRevision },
      { Authorization: `Bearer ${token}` }
    );
  }

  /**
   * 发布课程（原子操作，全课程）
   */
  async publishCourse(
    token: string,
    courseId: string,
    intentId?: string
  ): Promise<PublishResponse> {
    return this.client.post<PublishResponse>(
      `/api/v1/teacher/courses/${courseId}/publish`,
      { publish_intent_id: intentId || `publish-${Date.now()}` },
      { Authorization: `Bearer ${token}` }
    );
  }

  /**
   * 生成授权码（支持多范围）
   */
  async createAccessCode(
    token: string,
    courseId: string,
    options: {
      scope: 'course' | 'lesson_range' | 'node_range';
      lessonIds?: string[];
      nodeIds?: string[];
      expiresAt?: string;
    }
  ): Promise<AccessCodeResponse> {
    return this.client.post<AccessCodeResponse>(
      `/api/v1/teacher/courses/${courseId}/access-codes`,
      options,
      { Authorization: `Bearer ${token}` }
    );
  }

  /**
   * 获取已生成的授权码
   */
  async getAccessCodes(
    token: string,
    courseId: string
  ): Promise<AccessCodeResponse[]> {
    const response = await this.client.get<{ codes: AccessCodeResponse[] }>(
      `/api/v1/teacher/courses/${courseId}/access-codes`,
      { Authorization: `Bearer ${token}` }
    );
    return response.codes;
  }
}
