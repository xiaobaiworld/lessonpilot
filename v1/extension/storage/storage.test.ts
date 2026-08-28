import { describe, it, expect, beforeEach } from 'vitest';
import { CourseLibrary, StorageArea, StorageFailure } from './index';
import {
  STORAGE_ROOT_KEY,
  STORAGE_SCHEMA_VERSION,
  InstalledCourse,
  AuthorizationSource,
} from './types';
import { PortableNode } from '../../web/shared/src';

/** 内存版 chrome.storage.local，可注入延迟和失败 */
class FakeArea implements StorageArea {
  data: Record<string, unknown> = {};
  delayMs = 0;
  failOn: 'get' | 'set' | 'remove' | null = null;
  writes = 0;

  private async wait() {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
  }

  async get(keys: string[]) {
    await this.wait();
    if (this.failOn === 'get') throw new Error('boom');
    const out: Record<string, unknown> = {};
    for (const k of keys) if (k in this.data) out[k] = this.data[k];
    return out;
  }

  async set(items: Record<string, unknown>) {
    await this.wait();
    if (this.failOn === 'set') throw new Error('boom');
    this.writes++;
    // 结构化克隆，模拟真实存储不共享引用
    Object.assign(this.data, JSON.parse(JSON.stringify(items)));
  }

  async remove(keys: string[]) {
    await this.wait();
    if (this.failOn === 'remove') throw new Error('boom');
    for (const k of keys) delete this.data[k];
  }

  root() {
    return this.data[STORAGE_ROOT_KEY] as any;
  }
}

const testNode = (id: string): PortableNode => ({
  id,
  enabled: true,
  family: 'attention',
  interaction: 'notice',
  anchor: { kind: 'time_cross', timeSeconds: 10, captionId: null },
  title: '重点',
  content: { schemaVersion: 1, blocks: [{ type: 'paragraph', children: [{ text: '提示' }] }] },
  interactionData: null,
  effects: { pause: true },
});

const course = (id: string, lessons = 1): InstalledCourse => ({
  courseId: id,
  title: `课程 ${id}`,
  assets: [],
  lessons: Array.from({ length: lessons }, (_, i) => ({
    lessonId: `${id}-l${i + 1}`,
    title: `第 ${i + 1} 节`,
    videoId: 'BV1Ac41187Lm',
    page: 1,
    cid: null,
    nodes: [testNode('n1')],
  })),
  publishedAt: '2026-08-23T00:00:00.000Z',
  installedAt: '2026-08-23T00:00:00.000Z',
  source: 'authorized',
  readOnly: false,
  sourceId: `src-${id}`,
});

const source = (id: string, courseIds: string[]): AuthorizationSource => ({
  sourceId: `src-${id}`,
  codeHint: 'OKARQ',
  redeemedAt: '2026-08-23T00:00:00.000Z',
  courseIds,
  expiresAt: null,
});

let area: FakeArea;
let lib: CourseLibrary;

beforeEach(() => {
  area = new FakeArea();
  lib = new CourseLibrary(area);
});

describe('初始状态', () => {
  it('空存储读出空根，不报错', async () => {
    const root = await lib.read();
    expect(root.storage_schema_version).toBe(STORAGE_SCHEMA_VERSION);
    expect(root.installedCourses).toEqual({});
    expect(root.quarantine.entries).toEqual([]);
  });

  it('本机身份只建一次', async () => {
    let calls = 0;
    const make = () => {
      calls++;
      return { clientId: 'c1', proof: 'p', proofSalt: 's' };
    };
    const first = await lib.ensureIdentity(make);
    const again = await lib.ensureIdentity(make);
    expect(calls).toBe(1);
    expect(again?.clientId).toBe(first?.clientId);
  });

  it('重复初始化示例课程会更新内容但不创建授权来源', async () => {
    const example = { ...course('example'), source: 'example' as const, readOnly: true };
    await lib.ensureExampleCourse(example);
    await lib.recordAttempt('example', 'example-l1', 'n1', {
      at: 't',
      answer: 'x',
      correct: true,
    });
    await lib.ensureExampleCourse({ ...example, title: '不应覆盖' });

    const root = await lib.read();
    expect(root.installedCourses.example.title).toBe('不应覆盖');
    expect(root.installedCourses.example.readOnly).toBe(true);
    expect(root.localLearningState.example['example-l1'].attempts.n1).toHaveLength(1);
    expect(root.authorizationSourceCache.sources).toEqual([]);
  });

  it('示例课程更新时替换课程内容但保留已有学习进度', async () => {
    const first = { ...course('example'), source: 'example' as const, readOnly: true };
    await lib.ensureExampleCourse(first);
    await lib.recordAttempt('example', 'example-l1', 'n1', {
      at: 't',
      answer: 'x',
      correct: true,
    });

    const updated = {
      ...first,
      lessons: [
        {
          ...first.lessons[0],
          nodes: [testNode('n1-new')],
        },
      ],
    };
    await lib.ensureExampleCourse(updated);

    const root = await lib.read();
    expect(root.installedCourses.example.lessons[0].nodes[0].id).toBe('n1-new');
    expect(root.localLearningState.example['example-l1'].attempts.n1).toHaveLength(1);
  });

  it('示例 courseId 冲突时不覆盖真实授权课程', async () => {
    await lib.installCourse(course('same'), source('same', ['same']));
    await lib.ensureExampleCourse({ ...course('same'), source: 'example', readOnly: true });
    const root = await lib.read();
    expect(root.installedCourses.same.source).toBe('authorized');
    expect(root.installedCourses.same.readOnly).toBe(false);
  });
});

describe('并发写入', () => {
  it('同时安装两门课，两门都在——串行化前这里会丢一门', async () => {
    area.delayMs = 5; // 放大读-改-写的窗口
    await Promise.all([
      lib.installCourse(course('a'), source('a', ['a'])),
      lib.installCourse(course('b'), source('b', ['b'])),
    ]);
    const root = await lib.read();
    expect(Object.keys(root.installedCourses).sort()).toEqual(['a', 'b']);
    expect(root.authorizationSourceCache.sources).toHaveLength(2);
  });

  it('同一节点并发记录多次尝试，一次都不丢', async () => {
    area.delayMs = 3;
    await lib.installCourse(course('a'), source('a', ['a']));
    await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        lib.recordAttempt('a', 'a-l1', 'n1', {
          at: `t${i}`,
          answer: `ans${i}`,
          correct: true,
        })
      )
    );
    const root = await lib.read();
    expect(root.localLearningState.a['a-l1'].attempts.n1).toHaveLength(5);
  });

  it('一次写失败不会卡死后续操作', async () => {
    area.failOn = 'set';
    await expect(lib.installCourse(course('a'), source('a', ['a']))).rejects.toBeInstanceOf(
      StorageFailure
    );
    area.failOn = null;
    await lib.installCourse(course('b'), source('b', ['b']));
    const root = await lib.read();
    expect(Object.keys(root.installedCourses)).toEqual(['b']);
  });
});

describe('损坏隔离', () => {
  it('版本不认识时整根隔离，不当有效数据读', async () => {
    area.data[STORAGE_ROOT_KEY] = {
      storage_schema_version: '0.9.0',
      installedCourses: { a: course('a') },
    };
    const root = await lib.read();
    expect(root.installedCourses).toEqual({});
    expect(root.quarantine.entries[0].reason).toContain('0.9.0');
  });

  it('单门课程损坏只隔离那一门，其它课程保留', async () => {
    area.data[STORAGE_ROOT_KEY] = {
      storage_schema_version: STORAGE_SCHEMA_VERSION,
      installedCourses: { good: course('good'), bad: { title: 42 } },
      localLearningState: {},
      authorizationSourceCache: { sources: [] },
      quarantine: { entries: [] },
    };
    const root = await lib.read();
    expect(Object.keys(root.installedCourses)).toEqual(['good']);
    expect(root.quarantine.entries[0].reason).toContain('bad');
  });

  it('课程节点形状损坏时隔离整门课程', async () => {
    area.data[STORAGE_ROOT_KEY] = {
      storage_schema_version: STORAGE_SCHEMA_VERSION,
      installedCourses: {
        good: course('good'),
        bad: { ...course('bad'), lessons: [{ lessonId: 'bad-l1', title: '第一节', videoId: 'BV1Ac41187Lm', nodes: [{ id: 'only-id' }] }] },
      },
      localLearningState: {},
      authorizationSourceCache: { sources: [] },
      quarantine: { entries: [] },
    };
    const root = await lib.read();
    expect(Object.keys(root.installedCourses)).toEqual(['good']);
    expect(root.quarantine.entries[0].reason).toContain('bad');
  });

  it('课程节点的富文档和媒体引用损坏时隔离整门课程', async () => {
    area.data[STORAGE_ROOT_KEY] = {
      storage_schema_version: STORAGE_SCHEMA_VERSION,
      installedCourses: {
        good: course('good'),
        bad: {
          ...course('bad'),
          assets: [{
            assetId: 'audio-1',
            kind: 'audio',
            mimeType: 'audio/mpeg',
            byteSize: 4,
            sha256: 'a'.repeat(64),
            sourceType: 'uploaded',
          }],
          lessons: [{
            lessonId: 'bad-l1',
            title: '第一节',
            videoId: 'BV1Ac41187Lm',
            nodes: [{
              ...testNode('bad-node'),
              content: { schemaVersion: 1, blocks: [{ type: 'image', assetId: 'audio-1', alt: '图' }] },
            }],
          }],
        },
      },
      localLearningState: {},
      authorizationSourceCache: { sources: [] },
      quarantine: { entries: [] },
    };
    const root = await lib.read();
    expect(Object.keys(root.installedCourses)).toEqual(['good']);
    expect(root.quarantine.entries[0].reason).toContain('bad');
  });

  it('存储根不是对象时不抛异常', async () => {
    area.data[STORAGE_ROOT_KEY] = 'garbage';
    const root = await lib.read();
    expect(root.installedCourses).toEqual({});
    expect(root.quarantine.entries).toHaveLength(1);
  });

  it('隔离样本截断，不把整份坏数据搬进存储', async () => {
    area.data[STORAGE_ROOT_KEY] = { storage_schema_version: 'x', junk: 'y'.repeat(5000) };
    const root = await lib.read();
    expect(root.quarantine.entries[0].sample.length).toBeLessThanOrEqual(200);
  });
});

describe('课程隔离与更新', () => {
  it('重装同一课程不动其它课程的学习状态', async () => {
    await lib.installCourse(course('a'), source('a', ['a']));
    await lib.installCourse(course('b'), source('b', ['b']));
    await lib.recordAttempt('b', 'b-l1', 'n1', { at: 't', answer: 'x', correct: true });

    await lib.installCourse(course('a', 2), source('a', ['a']));

    const root = await lib.read();
    expect(root.installedCourses.a.lessons).toHaveLength(2);
    expect(root.localLearningState.b['b-l1'].attempts.n1).toHaveLength(1);
  });

  it('重装默认保留进度，显式要求才清', async () => {
    await lib.installCourse(course('a'), source('a', ['a']));
    await lib.recordAttempt('a', 'a-l1', 'n1', { at: 't', answer: 'x', correct: true });

    await lib.installCourse(course('a'), source('a', ['a']));
    let root = await lib.read();
    expect(root.localLearningState.a['a-l1'].attempts.n1).toHaveLength(1);

    await lib.installCourse(course('a'), source('a', ['a']), { resetProgress: true });
    root = await lib.read();
    expect(root.localLearningState.a ?? {}).toEqual({});
  });

  it('删除课程连带删掉它的学习状态，不影响别的课', async () => {
    await lib.installCourse(course('a'), source('a', ['a']));
    await lib.installCourse(course('b'), source('b', ['b']));
    await lib.recordAttempt('a', 'a-l1', 'n1', { at: 't', answer: 'x', correct: true });
    await lib.recordAttempt('b', 'b-l1', 'n1', { at: 't', answer: 'x', correct: true });

    await lib.removeCourse('a');

    const root = await lib.read();
    expect(Object.keys(root.installedCourses)).toEqual(['b']);
    expect(root.localLearningState.a).toBeUndefined();
    expect(root.localLearningState.b['b-l1'].attempts.n1).toHaveLength(1);
  });
});

describe('旧键', () => {
  it('只删除存在的旧键并报告删了哪些', async () => {
    area.data.studentCourseStore = { storageVersion: 2 };
    area.data.currentCourse = {};
    const dropped = await lib.dropLegacyKeys();
    expect(dropped.sort()).toEqual(['currentCourse', 'studentCourseStore']);
    expect(area.data.studentCourseStore).toBeUndefined();
  });

  it('没有旧键时不发起删除', async () => {
    expect(await lib.dropLegacyKeys()).toEqual([]);
  });

  it('旧数据不会被当成 v1 根读进来', async () => {
    area.data.studentCourseStore = { storageVersion: 2, installedCourses: { a: {} } };
    const root = await lib.read();
    expect(root.installedCourses).toEqual({});
  });
});
