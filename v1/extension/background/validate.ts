import { InstalledCourse, InstalledLesson } from '../storage/types';

/**
 * 课程包复验。
 *
 * 服务端已经校验过一遍，这里再验一遍是因为：插件把包写进本机后，运行时
 * 会无条件相信它。中间任何一步（网络截断、扩展被换、存储串位）产生的
 * 畸形数据，都必须在落库前挡住，而不是留给运行时崩。
 *
 * 结构真源是 v1/contracts/schemas/course-package.schema.json。
 */

export type Invalid = { ok: false; reason: string };
export type Valid<T> = { ok: true; value: T };
export type Checked<T> = Valid<T> | Invalid;

const BVID = /^BV[0-9A-Za-z]{10}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonBlank(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function checkLesson(raw: unknown, at: string): Checked<InstalledLesson> {
  if (!isObject(raw)) return { ok: false, reason: `${at} 不是对象` };

  if (!UUID.test(String(raw.lessonId))) {
    return { ok: false, reason: `${at} 的 lessonId 不是 UUID` };
  }
  if (!nonBlank(raw.title)) {
    return { ok: false, reason: `${at} 缺标题` };
  }

  const video = raw.videoRef;
  if (!isObject(video) || video.platform !== 'bilibili') {
    return { ok: false, reason: `${at} 的 videoRef 平台不受支持` };
  }
  if (!BVID.test(String(video.videoId))) {
    return { ok: false, reason: `${at} 的 BVID 格式不对` };
  }

  // 节点为空的课节无法运行：到点没有任何可展示的内容
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    return { ok: false, reason: `${at} 没有互动节点` };
  }
  for (const [i, node] of raw.nodes.entries()) {
    if (!isObject(node)) return { ok: false, reason: `${at} 第 ${i + 1} 个节点不是对象` };
    const trigger = node.trigger;
    if (!isObject(trigger) || typeof trigger.timeSeconds !== 'number') {
      return { ok: false, reason: `${at} 第 ${i + 1} 个节点缺触发时刻` };
    }
    if (!Number.isFinite(trigger.timeSeconds) || trigger.timeSeconds < 0) {
      return { ok: false, reason: `${at} 第 ${i + 1} 个节点触发时刻非法` };
    }
  }

  return {
    ok: true,
    value: {
      lessonId: String(raw.lessonId),
      title: String(raw.title).trim(),
      videoId: String(video.videoId),
      nodes: raw.nodes,
    },
  };
}

export function checkCoursePackage(
  raw: unknown,
  sourceId: string
): Checked<InstalledCourse> {
  if (!isObject(raw)) return { ok: false, reason: '课程包不是对象' };

  // 主版本不认识时安全拒绝，不猜字段
  if (raw.schemaVersion !== 2) {
    return { ok: false, reason: `课程包版本 ${String(raw.schemaVersion)} 不受支持` };
  }
  if (!UUID.test(String(raw.courseId))) {
    return { ok: false, reason: 'courseId 不是 UUID' };
  }
  if (!nonBlank(raw.title)) {
    return { ok: false, reason: '课程缺标题' };
  }
  if (!Array.isArray(raw.lessons) || raw.lessons.length === 0) {
    return { ok: false, reason: '课程没有课节' };
  }
  if (!nonBlank(raw.updatedAt)) {
    return { ok: false, reason: '课程缺更新时刻' };
  }

  const lessons: InstalledLesson[] = [];
  for (const [i, lesson] of raw.lessons.entries()) {
    const checked = checkLesson(lesson, `第 ${i + 1} 个课节`);
    if (!checked.ok) return checked;
    lessons.push(checked.value);
  }

  // UUID 必须唯一，否则运行时按 id 查课节会取到错的那个
  const ids = new Set(lessons.map((l) => l.lessonId));
  if (ids.size !== lessons.length) {
    return { ok: false, reason: '课节 UUID 重复' };
  }
  if (ids.has(String(raw.courseId))) {
    return { ok: false, reason: '课节 UUID 与课程 UUID 相同' };
  }

  /*
   * 同一课程内 BVID 不能重复。
   * 运行时靠 BVID 匹配当前页面，重复了就无法确定该跑哪个课节，
   * 而静默取第一个与 D-V1-010 冲突。
   */
  const videos = new Set(lessons.map((l) => l.videoId));
  if (videos.size !== lessons.length) {
    return { ok: false, reason: '同一课程内 BVID 重复' };
  }

  return {
    ok: true,
    value: {
      courseId: String(raw.courseId),
      title: String(raw.title).trim(),
      lessons,
      publishedAt: String(raw.updatedAt),
      installedAt: new Date().toISOString(),
      source: 'authorized',
      readOnly: false,
      sourceId,
    },
  };
}
