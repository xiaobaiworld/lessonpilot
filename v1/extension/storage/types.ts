import type { PortableNode } from '../../web/shared/src/portableContent';
import {
  DEFAULT_STUDENT_SETTINGS,
  StudentSettings,
} from './settings';

/**
 * 本机存储根。
 *
 * 结构由 v1/contracts/schemas/extension-storage.schema.json 定义，
 * 那份 schema 是双端真源，改字段要先改它。
 */

export const STORAGE_ROOT_KEY = 'knownmapV1';

/**
 * 取值必须匹配 schema 里的 `^2\.\d+\.\d+$`。
 * 这是契约字段，不是内部版本号——改它等于要求所有已安装的插件隔离重建。
 */
export const STORAGE_SCHEMA_VERSION = '2.1.0';

/** 旧根，明确拒绝，不迁移（D-V1-012 要求干净初始化） */
export const LEGACY_KEYS = [
  'studentCourseStore',
  'currentCourse',
  'activePreviewSession',
] as const;

/** 本机身份。证明安装归属，不含任何可回溯到个人的信息 */
export interface LocalIdentity {
  clientId: string;
  proof: string;
  proofSalt: string;
  createdAt: string;
}

export interface AssetRecord {
  assetId: string;
  kind: 'image' | 'audio' | 'video';
  mimeType: string;
  byteSize: number;
  sha256: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  alt?: string;
  sourceType: 'uploaded' | 'licensed';
}

export interface InstalledLesson {
  lessonId: string;
  title: string;
  videoId: string;
  /** 旧本机课程可能没有此字段，CourseLibrary 读取时规范化为 1。 */
  page?: number;
  /** 旧本机课程可能没有此字段，CourseLibrary 读取时规范化为 null。 */
  cid?: string | null;
  nodes: PortableNode[];
}

export type CourseSource = 'example' | 'authorized';

/** 已安装课程。锁定到某一次发布，不随远端变化 */
export interface InstalledCourse {
  courseId: string;
  title: string;
  lessons: InstalledLesson[];
  /** 仅保存资源清单；二进制本体由后续后台资源缓存存入 IndexedDB。 */
  assets: AssetRecord[];
  /** 发布身份；旧本机课程读取时规范化为 null */
  releaseId?: string | null;
  releaseNumber?: number | null;
  /** 发布时刻，用来判断远端是否有更新 */
  publishedAt: string;
  installedAt: string;
  /** 示例课程或真实授权课程 */
  source: CourseSource;
  /** 示例课程只读，真实授权课程可由学生删除 */
  readOnly: boolean;
  /** 真实课程装它用的授权来源；示例课程使用固定内部标识 */
  sourceId: string;
}

/** 授权来源缓存。一个码可能授权多门课，兑换记录要留 */
export interface AuthorizationSource {
  sourceId: string;
  codeHint: string;
  redeemedAt: string;
  courseIds: string[];
  expiresAt: string | null;
}

/** 单个节点的作答记录。追加式，不覆盖历史尝试 */
export interface NodeAttempt {
  at: string;
  answer: string;
  correct: boolean | null;
}

export interface LessonProgress {
  /** 已完成的节点 id */
  done: string[];
  attempts: Record<string, NodeAttempt[]>;
  lastPositionSeconds: number;
  updatedAt: string;
}

/** 学习状态按 courseId + lessonId 隔离，一门课损坏不影响其它 */
export type LearningState = Record<string, Record<string, LessonProgress>>;

/** 隔离区。读到不认识或损坏的数据时挪到这里，不静默丢弃 */
export interface QuarantineEntry {
  at: string;
  reason: string;
  /** 原始内容截断保存，便于排查，不参与任何逻辑 */
  sample: string;
}

export interface StorageRoot {
  storage_schema_version: string;
  localIdentity: LocalIdentity | null;
  installedCourses: Record<string, InstalledCourse>;
  authorizationSourceCache: { sources: AuthorizationSource[] };
  localLearningState: LearningState;
  quarantine: { entries: QuarantineEntry[] };
  settings: StudentSettings;
}

export function emptyRoot(): StorageRoot {
  return {
    storage_schema_version: STORAGE_SCHEMA_VERSION,
    localIdentity: null,
    installedCourses: {},
    authorizationSourceCache: { sources: [] },
    localLearningState: {},
    quarantine: { entries: [] },
    settings: { ...DEFAULT_STUDENT_SETTINGS },
  };
}
