import {
  STORAGE_ROOT_KEY,
  STORAGE_SCHEMA_VERSION,
  LEGACY_KEYS,
  StorageRoot,
  AssetRecord,
  InstalledCourse,
  AuthorizationSource,
  LearningState,
  LessonProgress,
  NodeAttempt,
  QuarantineEntry,
  UpgradeTask,
  UpgradeTaskStatus,
  emptyRoot,
} from './types';
import {
  isStudentSettings,
  normalizeStudentSettings,
} from './settings';
import type { PortableNode } from '../../web/shared/src/portableContent';

/** chrome.storage.local 的最小接口，便于在测试里替换 */
export interface StorageArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export class StorageFailure extends Error {
  constructor(public readonly operation: 'get' | 'set' | 'remove') {
    super(`storage ${operation} failed`);
    this.name = 'StorageFailure';
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const BVID = /^BV[0-9A-Za-z]{10}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const UPGRADE_TASK_STATUSES = new Set<UpgradeTaskStatus>([
  'queued',
  'downloading',
  'verifying',
  'ready_to_commit',
  'committed',
  'paused',
  'failed',
  'cancelled',
]);
const COLOR = /^#[0-9a-f]{3,8}$/i;
const MARKS = new Set(['strong', 'em', 'underline']);
const ASSET_MIME_PREFIX: Record<string, string> = {
  image: 'image/',
  audio: 'audio/',
  video: 'video/',
};

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function onlyKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key));
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isSafeHref(value: unknown): value is string {
  if (!nonBlank(value)) return false;
  try {
    const protocol = new URL(value, 'https://knownmap.invalid/').protocol;
    return ['http:', 'https:', 'mailto:'].includes(protocol);
  } catch {
    return false;
  }
}

function isAssetRecord(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (
    !onlyKeys(
      value,
      ['assetId', 'kind', 'mimeType', 'byteSize', 'sha256', 'sourceType'],
      ['width', 'height', 'durationSeconds', 'alt']
    )
  ) return false;
  const kind = String(value.kind);
  return (
    nonBlank(value.assetId) &&
    kind in ASSET_MIME_PREFIX &&
    nonBlank(value.mimeType) &&
    value.mimeType.startsWith(ASSET_MIME_PREFIX[kind]) &&
    Number.isInteger(value.byteSize) &&
    Number(value.byteSize) >= 0 &&
    typeof value.sha256 === 'string' &&
    SHA256.test(value.sha256) &&
    ['uploaded', 'licensed'].includes(String(value.sourceType)) &&
    (value.width === undefined || (typeof value.width === 'number' && Number.isInteger(value.width) && value.width >= 1)) &&
    (value.height === undefined || (typeof value.height === 'number' && Number.isInteger(value.height) && value.height >= 1)) &&
    (value.durationSeconds === undefined ||
      (typeof value.durationSeconds === 'number' &&
        Number.isFinite(value.durationSeconds) &&
        value.durationSeconds > 0)) &&
    (value.alt === undefined || typeof value.alt === 'string')
  );
}

function isUpgradeTask(value: unknown): value is UpgradeTask {
  if (
    !isPlainObject(value) ||
    !onlyKeys(
      value,
      [
        'taskKey',
        'courseId',
        'previousReleaseId',
        'targetReleaseId',
        'targetReleaseNumber',
        'createdAt',
        'updatedAt',
        'status',
        'currentAssetId',
        'completedAssetHashes',
        'retryCount',
        'lastError',
      ]
    )
  ) {
    return false;
  }
  const hashes = value.completedAssetHashes;
  return (
    nonBlank(value.taskKey) &&
    nonBlank(value.courseId) &&
    (value.previousReleaseId === null || nonBlank(value.previousReleaseId)) &&
    nonBlank(value.targetReleaseId) &&
    value.taskKey === `${value.courseId}\u0000${value.targetReleaseId}` &&
    Number.isSafeInteger(value.targetReleaseNumber) &&
    Number(value.targetReleaseNumber) >= 1 &&
    isDateTime(value.createdAt) &&
    isDateTime(value.updatedAt) &&
    typeof value.status === 'string' &&
    UPGRADE_TASK_STATUSES.has(value.status as UpgradeTaskStatus) &&
    (value.currentAssetId === null || nonBlank(value.currentAssetId)) &&
    isPlainObject(hashes) &&
    Object.values(hashes).every(
      (hash) => typeof hash === 'string' && SHA256.test(hash)
    ) &&
    Number.isSafeInteger(value.retryCount) &&
    Number(value.retryCount) >= 0 &&
    (value.lastError === null || typeof value.lastError === 'string')
  );
}

function isInline(value: unknown): boolean {
  if (!isPlainObject(value) || !onlyKeys(value, ['text'], ['marks', 'color', 'link']) || !nonBlank(value.text)) return false;
  if (
    value.marks !== undefined &&
    (!Array.isArray(value.marks) || value.marks.some((mark) => !MARKS.has(String(mark))))
  ) return false;
  if (value.color !== undefined && (typeof value.color !== 'string' || !COLOR.test(value.color))) return false;
  if (
    value.link !== undefined &&
    (!isPlainObject(value.link) || !onlyKeys(value.link, ['href']) || !isSafeHref(value.link.href))
  ) return false;
  return true;
}

function isRichDocument(value: unknown, assets: Map<string, AssetRecord>): boolean {
  if (!isPlainObject(value) || !onlyKeys(value, ['schemaVersion', 'blocks']) || value.schemaVersion !== 1) return false;
  if (!Array.isArray(value.blocks) || value.blocks.length === 0) return false;
  for (const block of value.blocks) {
    if (!isPlainObject(block) || typeof block.type !== 'string') return false;
    if (block.type === 'paragraph' || block.type === 'quote') {
      if (!onlyKeys(block, ['type', 'children']) || !Array.isArray(block.children) || block.children.length === 0 || !block.children.every(isInline)) return false;
      continue;
    }
    if (block.type === 'heading') {
      if (!onlyKeys(block, ['type', 'level', 'children']) || ![2, 3].includes(Number(block.level)) || !Array.isArray(block.children) || block.children.length === 0 || !block.children.every(isInline)) return false;
      continue;
    }
    if (block.type === 'list') {
      if (!onlyKeys(block, ['type', 'ordered', 'items']) || typeof block.ordered !== 'boolean' || !Array.isArray(block.items) || block.items.length === 0) return false;
      if (block.items.some((item) => !isPlainObject(item) || !onlyKeys(item, ['children']) || !Array.isArray(item.children) || item.children.length === 0 || !item.children.every(isInline))) return false;
      continue;
    }
    if (block.type !== 'image' && block.type !== 'audio' && block.type !== 'video') return false;
    const optional = block.type === 'image' ? [] : block.type === 'video' ? ['title', 'posterAssetId'] : ['title'];
    const required = block.type === 'image' ? ['type', 'assetId', 'alt'] : ['type', 'assetId'];
    if (!onlyKeys(block, required, optional) || !nonBlank(block.assetId)) return false;
    const asset = assets.get(block.assetId);
    if (!asset || asset.kind !== block.type) return false;
    if (block.type === 'image' && typeof block.alt !== 'string') return false;
    if (block.type !== 'image' && block.title !== undefined && typeof block.title !== 'string') return false;
    if (block.type === 'video' && block.posterAssetId !== undefined) {
      if (!nonBlank(block.posterAssetId)) return false;
      const poster = assets.get(block.posterAssetId);
      if (!poster || poster.kind !== 'image') return false;
    }
  }
  return true;
}

function isInteractionData(interaction: string, value: unknown): boolean {
  if (interaction === 'notice') return value === null;
  if (!isPlainObject(value)) return false;
  if (interaction === 'choice') {
    if (!onlyKeys(value, ['options', 'answer', 'explanation']) || !Array.isArray(value.options) || value.options.length < 2 || !nonBlank(value.answer) || !nonBlank(value.explanation)) return false;
    return value.options.every((option) => isPlainObject(option) && onlyKeys(option, ['id', 'label']) && nonBlank(option.id) && nonBlank(option.label)) && value.options.some((option) => isPlainObject(option) && option.id === value.answer);
  }
  if (interaction === 'blank') {
    return onlyKeys(value, ['acceptedAnswers', 'normalize', 'explanation']) && Array.isArray(value.acceptedAnswers) && value.acceptedAnswers.length > 0 && value.acceptedAnswers.every(nonBlank) && Array.isArray(value.normalize) && value.normalize.every((rule) => rule === 'trim' || rule === 'casefold') && nonBlank(value.explanation);
  }
  return onlyKeys(value, ['referenceFeedback']) && nonBlank(value.referenceFeedback);
}

function isPortableNode(value: unknown, assets: Map<string, AssetRecord>): value is PortableNode {
  if (!isPlainObject(value) || !onlyKeys(value, ['id', 'enabled', 'family', 'interaction', 'anchor', 'title', 'content', 'interactionData', 'effects'], ['presentationHints'])) return false;
  const anchor = value.anchor;
  const content = value.content;
  const effects = value.effects;
  const hints = value.presentationHints;
  return (
    nonBlank(value.id) &&
    value.enabled === true &&
    ['attention', 'practice'].includes(String(value.family)) &&
    ['notice', 'choice', 'blank', 'free_text'].includes(String(value.interaction)) &&
    value.family === (value.interaction === 'notice' ? 'attention' : 'practice') &&
    isPlainObject(anchor) &&
    onlyKeys(anchor, ['kind', 'timeSeconds'], ['captionId']) &&
    anchor.kind === 'time_cross' &&
    typeof anchor.timeSeconds === 'number' &&
    Number.isFinite(anchor.timeSeconds) &&
    anchor.timeSeconds >= 0 &&
    (anchor.captionId === undefined || anchor.captionId === null || nonBlank(anchor.captionId)) &&
    nonBlank(value.title) &&
    isRichDocument(content, assets) &&
    isInteractionData(String(value.interaction), value.interactionData) &&
    (hints === undefined ||
      (isPlainObject(hints) &&
        onlyKeys(hints, [], ['windowSize', 'windowStyle', 'windowPosition']) &&
        (hints.windowSize === undefined || ['s', 'm', 'l', 'overlay'].includes(String(hints.windowSize))) &&
        (hints.windowStyle === undefined || ['card', 'document'].includes(String(hints.windowStyle))) &&
        (hints.windowPosition === undefined || ['bottom-left', 'bottom-right', 'center'].includes(String(hints.windowPosition))))) &&
    isPlainObject(effects) &&
    onlyKeys(effects, ['pause']) &&
    effects.pause === true
  );
}

function isInstalledCourse(value: unknown): value is InstalledCourse {
  if (!isPlainObject(value)) return false;
  if (
    typeof value.courseId !== 'string' ||
    !value.courseId.trim() ||
    typeof value.title !== 'string' ||
    !value.title.trim() ||
    !Array.isArray(value.lessons) ||
    !Array.isArray(value.assets) ||
    !value.assets.every(isAssetRecord) ||
    (value.releaseId !== undefined &&
      value.releaseId !== null &&
      (typeof value.releaseId !== 'string' || !UUID.test(value.releaseId))) ||
    (value.releaseNumber !== undefined &&
      value.releaseNumber !== null &&
      (typeof value.releaseNumber !== 'number' ||
        !Number.isSafeInteger(value.releaseNumber) ||
        value.releaseNumber < 1)) ||
    !['example', 'authorized'].includes(String(value.source)) ||
    typeof value.readOnly !== 'boolean' ||
    typeof value.sourceId !== 'string' ||
    !value.sourceId.trim()
  ) return false;
  const assets = new Map<string, AssetRecord>();
  for (const asset of value.assets) {
    if (!isAssetRecord(asset) || assets.has(asset.assetId)) return false;
    assets.set(asset.assetId, asset as AssetRecord);
  }
  if (!isDateTime(value.publishedAt) || !isDateTime(value.installedAt)) return false;
  return value.lessons.every((lesson) => {
    if (!isPlainObject(lesson)) return false;
    return (
      typeof lesson.lessonId === 'string' &&
      lesson.lessonId.trim().length > 0 &&
      typeof lesson.title === 'string' &&
      lesson.title.trim().length > 0 &&
      typeof lesson.videoId === 'string' &&
      BVID.test(lesson.videoId) &&
      (lesson.page === undefined || (typeof lesson.page === 'number' && Number.isSafeInteger(lesson.page) && lesson.page >= 1)) &&
      (lesson.cid === undefined || lesson.cid === null || (typeof lesson.cid === 'string' && /^\d+$/.test(lesson.cid))) &&
      Array.isArray(lesson.nodes) &&
      lesson.nodes.length > 0 &&
      lesson.nodes.every((node) => isPortableNode(node, assets))
    );
  });
}

/**
 * 本机课程库。
 *
 * 两条不变量：
 *
 * 1. 所有写入串行。旧实现是读-改-写且无锁，两次并发兑换会互相覆盖，
 *    后完成的那次带着过期快照把前一次装的课程抹掉。
 * 2. 一门课的数据损坏只隔离那一门。读到不认识的结构时挪进 quarantine
 *    并继续，不整库重置——那会连带删掉其它课程的学习记录。
 */
export class CourseLibrary {
  /** 串行队列。每个写操作接在上一个之后，不并发读-改-写 */
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private area: StorageArea) {}

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    // 无论上一个成功失败都继续排队，一次失败不能卡死后续操作
    const next = this.tail.then(work, work);
    this.tail = next.catch(() => undefined);
    return next;
  }

  private async rawRead(): Promise<StorageRoot> {
    let stored: Record<string, unknown>;
    try {
      stored = await this.area.get([STORAGE_ROOT_KEY]);
    } catch {
      throw new StorageFailure('get');
    }

    const value = stored?.[STORAGE_ROOT_KEY];
    if (value === undefined || value === null) return emptyRoot();

    if (!isPlainObject(value)) {
      return this.quarantined(emptyRoot(), '存储根不是对象', value);
    }

    // 版本不认识就整根隔离：结构未知时任何字段读取都是猜测
    if (
      typeof value.storage_schema_version !== 'string' ||
      !/^2\.\d+\.\d+$/.test(value.storage_schema_version)
    ) {
      return this.quarantined(
        emptyRoot(),
        `存储版本 ${String(value.storage_schema_version)} 不受支持`,
        value
      );
    }

    return this.repair(value);
  }

  /** 逐字段核对形状，坏的那部分单独隔离，其余保留 */
  private repair(value: Record<string, unknown>): StorageRoot {
    const root = emptyRoot();
    const notes: QuarantineEntry[] = [];
    const now = new Date().toISOString();
    const drop = (reason: string, sample: unknown) =>
      notes.push({ at: now, reason, sample: JSON.stringify(sample).slice(0, 200) });

    if (isPlainObject(value.localIdentity)) {
      const id = value.localIdentity;
      if (
        typeof id.clientId === 'string' &&
        typeof id.proof === 'string' &&
        typeof id.proofSalt === 'string'
      ) {
        root.localIdentity = id as unknown as StorageRoot['localIdentity'];
      } else {
        drop('本机身份字段缺失', id);
      }
    }

    if (isPlainObject(value.installedCourses)) {
      for (const [courseId, course] of Object.entries(value.installedCourses)) {
        if (isInstalledCourse(course) && course.courseId === courseId) {
          const source = course.source === 'example' ? 'example' : 'authorized';
          root.installedCourses[courseId] = {
            ...course,
            lessons: course.lessons.map((lesson) => ({
              ...lesson,
              page: lesson.page ?? 1,
              cid: lesson.cid ?? null,
            })),
            releaseId: course.releaseId ?? null,
            releaseNumber: course.releaseNumber ?? null,
            source,
            readOnly: source === 'example' || course.readOnly === true,
          };
        } else {
          drop(`课程 ${courseId} 结构损坏`, course);
        }
      }
    }

    if (value.settings !== undefined) {
      if (isStudentSettings(value.settings)) {
        root.settings = value.settings;
      } else {
        root.settings = normalizeStudentSettings(value.settings);
        drop('设置字段无效，已回退默认值', value.settings);
      }
    }

    const upgradeQueue = value.upgradeQueue;
    if (
      isPlainObject(upgradeQueue) &&
      Array.isArray(upgradeQueue.tasks) &&
      upgradeQueue.tasks.every(isUpgradeTask)
    ) {
      root.upgradeQueue.tasks = upgradeQueue.tasks as UpgradeTask[];
    } else if (upgradeQueue !== undefined) {
      drop('升级队列结构损坏', upgradeQueue);
    }

    const cache = value.authorizationSourceCache;
    if (isPlainObject(cache) && Array.isArray(cache.sources)) {
      root.authorizationSourceCache.sources = cache.sources.filter(isPlainObject) as
        unknown as AuthorizationSource[];
    }

    if (isPlainObject(value.localLearningState)) {
      for (const [courseId, lessons] of Object.entries(value.localLearningState)) {
        if (!isPlainObject(lessons)) {
          drop(`课程 ${courseId} 学习状态损坏`, lessons);
          continue;
        }
        root.localLearningState[courseId] = lessons as unknown as Record<
          string,
          LessonProgress
        >;
      }
    }

    const q = value.quarantine;
    if (isPlainObject(q) && Array.isArray(q.entries)) {
      root.quarantine.entries = q.entries.filter(isPlainObject) as unknown as
        QuarantineEntry[];
    }
    root.quarantine.entries.push(...notes);

    return root;
  }

  private quarantined(
    root: StorageRoot,
    reason: string,
    sample: unknown
  ): StorageRoot {
    root.quarantine.entries.push({
      at: new Date().toISOString(),
      reason,
      sample: JSON.stringify(sample).slice(0, 200),
    });
    return root;
  }

  private async rawWrite(root: StorageRoot): Promise<void> {
    try {
      await this.area.set({ [STORAGE_ROOT_KEY]: root });
    } catch {
      // 写失败时磁盘上仍是上一份有效数据，调用方据此提示重试
      throw new StorageFailure('set');
    }
  }

  read(): Promise<StorageRoot> {
    return this.serialize(() => this.rawRead());
  }

  /** 读-改-写整体排在队列里，避免两次修改互相覆盖 */
  private update<T>(
    change: (root: StorageRoot) => T | Promise<T>
  ): Promise<{ root: StorageRoot; result: T }> {
    return this.serialize(async () => {
      const root = await this.rawRead();
      const result = await change(root);
      await this.rawWrite(root);
      return { root, result };
    });
  }

  /** 首次使用时建立本机身份，之后不再变化 */
  async ensureIdentity(
    make: () => { clientId: string; proof: string; proofSalt: string }
  ): Promise<StorageRoot['localIdentity']> {
    const { root } = await this.update((r) => {
      if (!r.localIdentity) {
        r.localIdentity = { ...make(), createdAt: new Date().toISOString() };
      }
    });
    return root.localIdentity;
  }

  /**
   * 确保随插件发布的只读示例课程存在。
   *
   * 示例课程不属于任何授权来源，也不能覆盖同 courseId 的真实授权课程。
   * 示例课程包更新时替换课程内容，但保留学生已有的学习进度。
   */
  ensureExampleCourse(course: InstalledCourse): Promise<StorageRoot> {
    return this.serialize(async () => {
      const root = await this.rawRead();
      const existing = root.installedCourses[course.courseId];
      // 同 courseId 的真实授权课程优先，示例包不能覆盖它。
      if (existing && existing.source !== 'example') return root;

      root.installedCourses[course.courseId] = {
        ...course,
        source: 'example',
        readOnly: true,
      };
      root.localLearningState[course.courseId] ??= {};
      await this.rawWrite(root);
      return root;
    });
  }

  /**
   * 按课程原子提交。
   *
   * 同一课程重复安装只替换它自己，其它课程和它们的学习状态不动。
   * 已有学习状态默认保留——重新下载通常是为了取更新，不是清进度。
   */
  installCourse(
    course: InstalledCourse,
    source: AuthorizationSource,
    options: { resetProgress?: boolean } = {}
  ): Promise<StorageRoot> {
    return this.update((root) => {
      root.installedCourses[course.courseId] = course;

      const sources = root.authorizationSourceCache.sources.filter(
        (s) => s.sourceId !== source.sourceId
      );
      sources.push(source);
      root.authorizationSourceCache.sources = sources;

      if (options.resetProgress || !root.localLearningState[course.courseId]) {
        root.localLearningState[course.courseId] = {};
      }
    }).then((r) => r.root);
  }

  /** 课程内容和已迁移学习状态必须作为一个原子替换写入 */
  replaceCourseAndLearningState(
    course: InstalledCourse,
    source: AuthorizationSource,
    learningState: Record<string, LessonProgress>
  ): Promise<StorageRoot> {
    return this.update((root) => {
      root.installedCourses[course.courseId] = course;

      const sources = root.authorizationSourceCache.sources.filter(
        (s) => s.sourceId !== source.sourceId
      );
      sources.push(source);
      root.authorizationSourceCache.sources = sources;
      root.localLearningState[course.courseId] = learningState;
    }).then((r) => r.root);
  }

  /** 在同一串行写操作内读取旧课程、迁移进度并提交新课程 */
  replaceCourseWithMigration(
    course: InstalledCourse,
    source: AuthorizationSource,
    migrate: (
      previousCourse: InstalledCourse,
      previousState: LearningState
    ) => Record<string, LessonProgress>
  ): Promise<StorageRoot> {
    return this.update((root) => {
      const previousCourse = root.installedCourses[course.courseId];
      if (!previousCourse) throw new Error('课程未安装');

      const learningState = migrate(
        previousCourse,
        root.localLearningState
      );
      root.installedCourses[course.courseId] = course;

      const sources = root.authorizationSourceCache.sources.filter(
        (s) => s.sourceId !== source.sourceId
      );
      sources.push(source);
      root.authorizationSourceCache.sources = sources;
      root.localLearningState[course.courseId] = learningState;
    }).then((r) => r.root);
  }

  /** 删除一门课连同它的学习状态。授权来源保留，便于说明它曾装过什么 */
  removeCourse(courseId: string): Promise<StorageRoot> {
    return this.update((root) => {
      delete root.installedCourses[courseId];
      delete root.localLearningState[courseId];
    }).then((r) => r.root);
  }

  /** 只清进度，课程内容留着 */
  resetProgress(courseId: string): Promise<StorageRoot> {
    return this.update((root) => {
      if (root.installedCourses[courseId]) {
        root.localLearningState[courseId] = {};
      }
    }).then((r) => r.root);
  }

  listUpgradeTasks(): Promise<UpgradeTask[]> {
    return this.read().then((root) => structuredClone(root.upgradeQueue.tasks));
  }

  enqueueUpgradeTask(
    courseId: string,
    targetReleaseId: string,
    targetReleaseNumber: number
  ): Promise<UpgradeTask> {
    return this.update((root) => {
      const now = new Date().toISOString();
      const current = root.installedCourses[courseId];
      const existing = root.upgradeQueue.tasks.find(
        (task) => task.courseId === courseId
      );

      if (existing && existing.targetReleaseNumber >= targetReleaseNumber) {
        return structuredClone(existing);
      }

      const next: UpgradeTask = existing
        ? {
            ...existing,
            taskKey: `${courseId}\u0000${targetReleaseId}`,
            targetReleaseId,
            targetReleaseNumber,
            status: 'queued',
            currentAssetId: null,
            completedAssetHashes: {},
            retryCount: 0,
            lastError: null,
            updatedAt: now,
          }
        : {
            taskKey: `${courseId}\u0000${targetReleaseId}`,
            courseId,
            previousReleaseId: current?.releaseId ?? null,
            targetReleaseId,
            targetReleaseNumber,
            createdAt: now,
            updatedAt: now,
            status: 'queued',
            currentAssetId: null,
            completedAssetHashes: {},
            retryCount: 0,
            lastError: null,
          };

      root.upgradeQueue.tasks = [
        ...root.upgradeQueue.tasks.filter((task) => task.courseId !== courseId),
        next,
      ];
      return structuredClone(next);
    }).then((r) => r.result);
  }

  updateUpgradeTask(
    taskKey: string,
    patch: Partial<
      Pick<
        UpgradeTask,
        | 'status'
        | 'currentAssetId'
        | 'completedAssetHashes'
        | 'retryCount'
        | 'lastError'
      >
    >
  ): Promise<UpgradeTask> {
    return this.update((root) => {
      const index = root.upgradeQueue.tasks.findIndex(
        (task) => task.taskKey === taskKey
      );
      if (index < 0) throw new Error('升级任务不存在');
      const current = root.upgradeQueue.tasks[index];
      const next: UpgradeTask = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      if (!isUpgradeTask(next)) throw new Error('升级任务字段无效');
      root.upgradeQueue.tasks[index] = next;
      return structuredClone(next);
    }).then((r) => r.result);
  }

  recoverUpgradeTasks(): Promise<UpgradeTask[]> {
    return this.update((root) => {
      const now = new Date().toISOString();
      root.upgradeQueue.tasks = root.upgradeQueue.tasks.map((task) => {
        const installed = root.installedCourses[task.courseId];
        if (installed?.releaseId === task.targetReleaseId) {
          return {
            ...task,
            status: 'committed',
            currentAssetId: null,
            lastError: null,
            updatedAt: now,
          };
        }
        if (
          task.status === 'downloading' ||
          task.status === 'verifying' ||
          task.status === 'ready_to_commit'
        ) {
          return {
            ...task,
            status: 'queued',
            updatedAt: now,
          };
        }
        return task;
      });
      return structuredClone(root.upgradeQueue.tasks);
    }).then((r) => r.result);
  }

  /** 记一次作答。追加而不覆盖，重做过的题保留全部尝试 */
  recordAttempt(
    courseId: string,
    lessonId: string,
    nodeId: string,
    attempt: NodeAttempt
  ): Promise<StorageRoot> {
    return this.update((root) => {
      const course = (root.localLearningState[courseId] ??= {});
      const lesson = (course[lessonId] ??= {
        done: [],
        attempts: {},
        lastPositionSeconds: 0,
        updatedAt: attempt.at,
      });

      (lesson.attempts[nodeId] ??= []).push(attempt);
      if (!lesson.done.includes(nodeId)) lesson.done.push(nodeId);
      lesson.updatedAt = attempt.at;
    }).then((r) => r.root);
  }

  /** 记播放位置。频繁调用，只动一个数字 */
  savePosition(
    courseId: string,
    lessonId: string,
    seconds: number
  ): Promise<void> {
    return this.update((root) => {
      const course = (root.localLearningState[courseId] ??= {});
      const lesson = (course[lessonId] ??= {
        done: [],
        attempts: {},
        lastPositionSeconds: 0,
        updatedAt: new Date().toISOString(),
      });
      lesson.lastPositionSeconds = Math.max(0, Math.floor(seconds));
      lesson.updatedAt = new Date().toISOString();
    }).then(() => undefined);
  }

  /** 清掉旧版本留下的键。它们不迁移，只删除 */
  async dropLegacyKeys(): Promise<string[]> {
    let present: string[];
    try {
      const stored = await this.area.get([...LEGACY_KEYS]);
      present = LEGACY_KEYS.filter((k) => stored?.[k] !== undefined);
    } catch {
      throw new StorageFailure('get');
    }
    if (present.length === 0) return [];
    try {
      await this.area.remove(present);
    } catch {
      throw new StorageFailure('remove');
    }
    return present;
  }
}
