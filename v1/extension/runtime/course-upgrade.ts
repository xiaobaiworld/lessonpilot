import type { PortableNode } from '../../web/shared/src/portableContent';
import type {
  InstalledCourse,
  LearningState,
  LessonProgress,
} from '../storage/types';

export interface CourseNodeDiff {
  added: string[];
  removed: string[];
  unchanged: string[];
  modified: string[];
  addedLessons: string[];
  removedLessons: string[];
}

function nodeKey(lessonId: string, nodeId: string): string {
  return `${lessonId}\u0000${nodeId}`;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    );
  }
  return value;
}

/** 只排除不代表内容语义的身份和字幕定位字段。 */
export function nodeFingerprint(node: PortableNode): string {
  const normalized = {
    ...node,
    anchor: { ...node.anchor },
  } as Record<string, unknown>;
  delete normalized.id;
  delete (normalized.anchor as Record<string, unknown>).captionId;
  return JSON.stringify(stableValue(normalized));
}

function nodeMap(course: InstalledCourse): Map<string, PortableNode> {
  const entries = new Map<string, PortableNode>();
  for (const lesson of course.lessons) {
    for (const node of lesson.nodes) {
      entries.set(nodeKey(lesson.lessonId, node.id), node);
    }
  }
  return entries;
}

export function compareCourseNodes(
  before: InstalledCourse,
  after: InstalledCourse
): CourseNodeDiff {
  if (before.courseId !== after.courseId) {
    throw new Error('只能比较同一门课程的不同版本');
  }

  const beforeLessons = new Set(before.lessons.map((lesson) => lesson.lessonId));
  const afterLessons = new Set(after.lessons.map((lesson) => lesson.lessonId));
  const beforeNodes = nodeMap(before);
  const afterNodes = nodeMap(after);
  const diff: CourseNodeDiff = {
    added: [],
    removed: [],
    unchanged: [],
    modified: [],
    addedLessons: after.lessons
      .map((lesson) => lesson.lessonId)
      .filter((lessonId) => !beforeLessons.has(lessonId)),
    removedLessons: before.lessons
      .map((lesson) => lesson.lessonId)
      .filter((lessonId) => !afterLessons.has(lessonId)),
  };

  for (const [key, oldNode] of beforeNodes) {
    const newNode = afterNodes.get(key);
    if (!newNode) {
      diff.removed.push(key);
    } else if (nodeFingerprint(oldNode) === nodeFingerprint(newNode)) {
      diff.unchanged.push(key);
    } else {
      diff.modified.push(key);
    }
  }
  for (const key of afterNodes.keys()) {
    if (!beforeNodes.has(key)) diff.added.push(key);
  }
  return diff;
}

function cloneProgress(progress: LessonProgress): LessonProgress {
  return structuredClone(progress);
}

function nodeIdsFor(
  keys: string[],
  lessonId: string
): Set<string> {
  const prefix = `${lessonId}\u0000`;
  return new Set(
    keys
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
  );
}

/**
 * 迁移只影响当前版本可证明对应的 done。
 * attempts 是历史事实，即使节点被修改或删除也保留。
 */
export function migrateLearningState(
  before: InstalledCourse,
  after: InstalledCourse,
  state: LearningState
): Record<string, LessonProgress> {
  const diff = compareCourseNodes(before, after);
  const previous = state[before.courseId] ?? {};
  const unchangedByLesson = new Map<string, Set<string>>();
  for (const lesson of before.lessons) {
    unchangedByLesson.set(
      lesson.lessonId,
      nodeIdsFor(diff.unchanged, lesson.lessonId)
    );
  }

  const next: Record<string, LessonProgress> = {};
  for (const [lessonId, progress] of Object.entries(previous)) {
    const oldLesson = before.lessons.some((lesson) => lesson.lessonId === lessonId);
    const newLesson = after.lessons.some((lesson) => lesson.lessonId === lessonId);
    const cloned = cloneProgress(progress);

    if (!oldLesson || !newLesson) {
      next[lessonId] = { ...cloned, done: [] };
      continue;
    }

    const unchanged = unchangedByLesson.get(lessonId) ?? new Set<string>();
    next[lessonId] = {
      ...cloned,
      done: cloned.done.filter((nodeId) => unchanged.has(nodeId)),
    };
  }
  return next;
}
