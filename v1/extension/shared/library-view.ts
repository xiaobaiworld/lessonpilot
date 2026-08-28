import { StorageRoot, InstalledCourse } from '../storage/types';
import { sameBilibiliVideoRef, BilibiliVideoRef } from './video-reference';

/**
 * 课程库视图模型。
 *
 * 纯函数，不碰 DOM。popup 和 B 站页面里的书包各自渲染，但列表规则、
 * 进度算法和状态判定只有这一份——两处渲染同一批数据却给出不同结论，
 * 学生会以为其中一处出了错。
 */

export interface LessonView {
  lessonId: string;
  title: string;
  videoId: string;
  page: number;
  cid: string | null;
  nodeCount: number;
  doneCount: number;
  /** 全部节点都作答过 */
  finished: boolean;
  lastPositionSeconds: number;
}

export interface CourseView {
  courseId: string;
  title: string;
  lessons: LessonView[];
  nodeCount: number;
  doneCount: number;
  /** 0–100 的整数，便于直接渲染，不在视图层再算 */
  percent: number;
  installedAt: string;
  source: 'example' | 'authorized';
  readOnly: boolean;
  /** 这门课是哪个授权码带来的，只有尾段 */
  codeHint: string | null;
}

export interface LibraryView {
  courses: CourseView[];
  /** 有内容可学：决定 popup 显示课程列表还是引导输入授权码 */
  hasCourses: boolean;
  /** 隔离区里有东西：界面应提示曾丢弃过损坏数据 */
  hasQuarantine: boolean;
}

function lessonView(
  lesson: InstalledCourse['lessons'][number],
  progress: { done: string[]; lastPositionSeconds: number } | undefined
): LessonView {
  const nodeCount = lesson.nodes.length;

  /*
   * 只统计当前课程包里仍存在的节点。
   * 老师改课后旧节点 id 可能消失，若直接用 done.length，
   * 会出现"已完成 5 / 共 3"这种读不通的进度。
   */
  const ids = new Set(
    lesson.nodes.map((n) => (n as { id?: unknown })?.id).filter((id) => typeof id === 'string')
  );
  const doneCount = (progress?.done ?? []).filter((id) => ids.has(id)).length;

  return {
    lessonId: lesson.lessonId,
    title: lesson.title,
    videoId: lesson.videoId,
    page: lesson.page ?? 1,
    cid: lesson.cid ?? null,
    nodeCount,
    doneCount,
    finished: nodeCount > 0 && doneCount >= nodeCount,
    lastPositionSeconds: progress?.lastPositionSeconds ?? 0,
  };
}

export function buildLibraryView(root: StorageRoot): LibraryView {
  const hintBySource = new Map(
    root.authorizationSourceCache.sources.map((s) => [s.sourceId, s.codeHint])
  );

  const courses = Object.values(root.installedCourses)
    .map((course): CourseView => {
      const progress = root.localLearningState[course.courseId] ?? {};
      const lessons = course.lessons.map((l) => lessonView(l, progress[l.lessonId]));
      const nodeCount = lessons.reduce((n, l) => n + l.nodeCount, 0);
      const doneCount = lessons.reduce((n, l) => n + l.doneCount, 0);

      return {
        courseId: course.courseId,
        title: course.title,
        lessons,
        nodeCount,
        doneCount,
        percent: nodeCount === 0 ? 0 : Math.round((doneCount / nodeCount) * 100),
        installedAt: course.installedAt,
        source: course.source,
        readOnly: course.readOnly,
        codeHint: hintBySource.get(course.sourceId) ?? null,
      };
    })
    // 最近安装的排在前面：学生通常先看刚拿到的那门
    .sort((a, b) => b.installedAt.localeCompare(a.installedAt));

  return {
    courses,
    hasCourses: courses.length > 0,
    hasQuarantine: root.quarantine.entries.length > 0,
  };
}

/**
 * 找出当前 B 站页面该运行哪个课节。
 *
 * 按 BVID 精确匹配。同一 BVID 落在多门课程里是可能的——老师可以把同一个
 * 视频用在不同课程——这时返回全部候选交给上层显式选择，不静默取第一个
 * （D-V1-010）。
 */
export interface RuntimeCandidate {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
}

export function findCandidates(
  root: StorageRoot,
  videoRef: BilibiliVideoRef | string
): RuntimeCandidate[] {
  const current: BilibiliVideoRef =
    typeof videoRef === 'string'
      ? { platform: 'bilibili', videoId: videoRef, page: 1, cid: null }
      : videoRef;
  const out: RuntimeCandidate[] = [];
  const courses = Object.values(root.installedCourses);
  const hasAuthorizedMatch = courses.some(
    (course) =>
      !course.readOnly && course.lessons.some((lesson) => sameBilibiliVideoRef({ ...lesson, page: lesson.page ?? 1, cid: lesson.cid ?? null }, current))
  );

  for (const course of courses) {
    // 示例课只用于开箱体验；真实授权课程存在时不让它抢占候选。
    if (course.readOnly && hasAuthorizedMatch) continue;
    for (const lesson of course.lessons) {
      if (sameBilibiliVideoRef({ ...lesson, page: lesson.page ?? 1, cid: lesson.cid ?? null }, current)) {
        out.push({
          courseId: course.courseId,
          courseTitle: course.title,
          lessonId: lesson.lessonId,
          lessonTitle: lesson.title,
        });
      }
    }
  }
  return out;
}

/** 删除前告诉学生会失去什么，而不是删完才知道 */
export interface RemovalImpact {
  courseTitle: string;
  lessonCount: number;
  /** 会一并清掉的作答记录条数 */
  attemptCount: number;
}

export function removalImpact(
  root: StorageRoot,
  courseId: string
): RemovalImpact | null {
  const course = root.installedCourses[courseId];
  if (!course || course.readOnly) return null;

  const progress = root.localLearningState[courseId] ?? {};
  const attemptCount = Object.values(progress).reduce(
    (total, lesson) =>
      total +
      Object.values(lesson.attempts ?? {}).reduce((n, list) => n + list.length, 0),
    0
  );

  return {
    courseTitle: course.title,
    lessonCount: course.lessons.length,
    attemptCount,
  };
}
