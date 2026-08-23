import {
  STORAGE_ROOT_KEY,
  STORAGE_SCHEMA_VERSION,
  LEGACY_KEYS,
  StorageRoot,
  InstalledCourse,
  AuthorizationSource,
  LessonProgress,
  NodeAttempt,
  QuarantineEntry,
  emptyRoot,
} from './types';

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
    if (value.storage_schema_version !== STORAGE_SCHEMA_VERSION) {
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
        if (
          isPlainObject(course) &&
          typeof course.title === 'string' &&
          Array.isArray(course.lessons)
        ) {
          root.installedCourses[courseId] = course as unknown as InstalledCourse;
        } else {
          drop(`课程 ${courseId} 结构损坏`, course);
        }
      }
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
