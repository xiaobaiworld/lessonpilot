import { describe, expect, it } from 'vitest';
import type {
  InstalledCourse,
  LearningState,
  LessonProgress,
  UpgradeTask,
} from '../storage/types';
import {
  compareCourseNodes,
  migrateLearningState,
  nodeFingerprint,
  UpgradeQueueRunner,
} from './course-upgrade';

const node = (
  id: string,
  title: string,
  timeSeconds: number,
  captionId: string | null = null
) => ({
  id,
  enabled: true as const,
  family: 'attention' as const,
  interaction: 'notice' as const,
  anchor: { kind: 'time_cross' as const, timeSeconds, captionId },
  title,
  content: {
    schemaVersion: 1 as const,
    blocks: [{ type: 'paragraph' as const, children: [{ text: title }] }],
  },
  interactionData: null,
  effects: { pause: true as const },
});

const course = (
  lessons: InstalledCourse['lessons'],
  courseId = 'course-1'
): InstalledCourse => ({
  courseId,
  title: '课程',
  lessons,
  assets: [],
  releaseId: null,
  releaseNumber: null,
  publishedAt: '2026-08-28T00:00:00.000Z',
  installedAt: '2026-08-28T00:00:00.000Z',
  source: 'authorized',
  readOnly: false,
  sourceId: 'source-1',
});

const lesson = (lessonId: string, nodes: ReturnType<typeof node>[]) => ({
  lessonId,
  title: lessonId,
  videoId: 'BV1Ac41187Lm',
  page: 1,
  cid: null,
  nodes,
});

const progress = (
  done: string[],
  attempts: Record<string, LessonProgress['attempts'][string]> = {}
): LessonProgress => ({
  done,
  attempts,
  lastPositionSeconds: 12,
  updatedAt: '2026-08-28T00:00:00.000Z',
});

describe('课程节点差异', () => {
  it('按 lessonId + node.id 分类新增、删除、未变更和已修改节点', () => {
    const before = course([
      lesson('lesson-1', [
        node('same', '不变', 10),
        node('changed', '旧标题', 20),
        node('removed', '被删除', 30),
      ]),
    ]);
    const after = course([
      lesson('lesson-1', [
        node('same', '不变', 10),
        node('changed', '新标题', 20),
        node('added', '新增', 40),
      ]),
    ]);

    expect(compareCourseNodes(before, after)).toEqual({
      added: ['lesson-1\u0000added'],
      removed: ['lesson-1\u0000removed'],
      unchanged: ['lesson-1\u0000same'],
      modified: ['lesson-1\u0000changed'],
      addedLessons: [],
      removedLessons: [],
    });
  });

  it('指纹忽略节点 id 和字幕 captionId，但保留内容语义', () => {
    const first = node('first', '相同内容', 10, 'caption-a');
    const second = node('second', '相同内容', 10, 'caption-b');
    expect(nodeFingerprint(first)).toBe(nodeFingerprint(second));
    expect(nodeFingerprint(first)).not.toBe(nodeFingerprint(node('first', '不同内容', 10)));
  });

  it('课节新增和删除单独记录，删除课节的历史状态不丢', () => {
    const before = course([
      lesson('kept', [node('n1', '保留', 10)]),
      lesson('removed-lesson', [node('old', '旧课节', 20)]),
    ]);
    const after = course([
      lesson('kept', [node('n1', '保留', 10)]),
      lesson('new-lesson', [node('new', '新课节', 30)]),
    ]);
    const diff = compareCourseNodes(before, after);

    expect(diff.addedLessons).toEqual(['new-lesson']);
    expect(diff.removedLessons).toEqual(['removed-lesson']);
    expect(diff.removed).toEqual(['removed-lesson\u0000old']);
  });
});

describe('学习状态迁移', () => {
  it('只保留未变更节点的 done，修改和删除节点保留 attempts', () => {
    const before = course([
      lesson('lesson-1', [
        node('same', '不变', 10),
        node('changed', '旧标题', 20),
        node('removed', '被删除', 30),
      ]),
    ]);
    const after = course([
      lesson('lesson-1', [
        node('same', '不变', 10),
        node('changed', '新标题', 20),
        node('added', '新增', 40),
      ]),
    ]);
    const state: LearningState = {
      'course-1': {
        'lesson-1': progress(
          ['same', 'changed', 'removed'],
          {
            same: [{ at: '2026-08-28T00:00:00.000Z', answer: 'a', correct: true }],
            changed: [{ at: '2026-08-28T00:00:01.000Z', answer: 'b', correct: false }],
            removed: [{ at: '2026-08-28T00:00:02.000Z', answer: 'c', correct: null }],
          }
        ),
      },
    };

    const migrated = migrateLearningState(before, after, state);
    expect(migrated).toEqual({
      'lesson-1': {
        done: ['same'],
        attempts: state['course-1']['lesson-1'].attempts,
        lastPositionSeconds: 12,
        updatedAt: '2026-08-28T00:00:00.000Z',
      },
    });
  });

  it('新课节没有旧进度，删除课节保留历史但不再显示完成项', () => {
    const before = course([
      lesson('removed-lesson', [node('old', '旧课节', 20)]),
    ]);
    const after = course([
      lesson('new-lesson', [node('new', '新课节', 30)]),
    ]);
    const state: LearningState = {
      'course-1': {
        'removed-lesson': progress(['old'], {
          old: [{ at: '2026-08-28T00:00:00.000Z', answer: 'history', correct: true }],
        }),
      },
    };

    const migrated = migrateLearningState(before, after, state);
    expect(migrated).toEqual({
      'removed-lesson': {
        done: [],
        attempts: state['course-1']['removed-lesson'].attempts,
        lastPositionSeconds: 12,
        updatedAt: '2026-08-28T00:00:00.000Z',
      },
    });
  });
});

const upgradeTask = (courseId: string, targetReleaseId: string): UpgradeTask => ({
  taskKey: `${courseId}\u0000${targetReleaseId}`,
  courseId,
  previousReleaseId: 'release-1',
  targetReleaseId,
  targetReleaseNumber: 2,
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
  status: 'queued',
  currentAssetId: null,
  completedAssetHashes: {},
  retryCount: 0,
  lastError: null,
});

describe('升级队列运行器', () => {
  it('一次只运行一个任务，并跳过当前活跃课程', async () => {
    let tasks = [upgradeTask('active', 'release-2'), upgradeTask('other', 'release-3')];
    const executed: string[] = [];
    const runner = new UpgradeQueueRunner(
      {
        listUpgradeTasks: async () => tasks,
        updateUpgradeTask: async (taskKey, patch) => {
          tasks = tasks.map((task) =>
            task.taskKey === taskKey ? { ...task, ...patch } : task
          );
          return tasks.find((task) => task.taskKey === taskKey)!;
        },
      },
      async (task) => {
        executed.push(task.courseId);
      },
      (courseId) => courseId !== 'active'
    );

    const first = await runner.runNext();
    expect(first?.status).toBe('committed');
    expect(executed).toEqual(['other']);
    expect(tasks.find((task) => task.courseId === 'active')?.status).toBe('queued');
  });

  it('执行失败记录失败原因和重试次数，后续任务仍可运行', async () => {
    let tasks = [upgradeTask('broken', 'release-2'), upgradeTask('next', 'release-3')];
    const runner = new UpgradeQueueRunner(
      {
        listUpgradeTasks: async () => tasks,
        updateUpgradeTask: async (taskKey, patch) => {
          tasks = tasks.map((task) =>
            task.taskKey === taskKey ? { ...task, ...patch } : task
          );
          return tasks.find((task) => task.taskKey === taskKey)!;
        },
      },
      async (task) => {
        if (task.courseId === 'broken') throw new Error('network');
      }
    );

    const failed = await runner.runNext();
    expect(failed).toMatchObject({
      status: 'failed',
      retryCount: 1,
      lastError: 'network',
    });
    const next = await runner.runNext();
    expect(next?.courseId).toBe('next');
    expect(next?.status).toBe('committed');
  });
});
