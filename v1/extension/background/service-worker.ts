import { CourseLibrary } from '../storage';
import {
  AssetCache,
  AssetCacheError,
  IndexedDbAssetDatabase,
} from '../storage/assets';
import {
  checkCourseUpdates,
  redeemAccessCode,
  upgradeCourse,
} from './redeem';
import { buildLibraryView, findCandidates, removalImpact } from '../shared/library-view';
import { API_ORIGIN } from './config';
import { createExampleCourse } from './example-course';
import { isBilibiliVideoRef } from '../shared/video-reference';

/**
 * background 是唯一的网络与持久化边界。
 *
 * content script 和 popup 都只发消息。让它们各自读写 chrome.storage 会出现
 * 两个标签页同时读-改-写，串行队列也拦不住——队列只在单个 JS 环境内有效。
 */

const library = new CourseLibrary(chrome.storage.local);
const assetStore = new AssetCache(new IndexedDbAssetDatabase());
const exampleCourse = (() => {
  try {
    return createExampleCourse();
  } catch {
    // 构建门禁会拦截无效内置课程；运行时仍不能因此阻断真实授权课程。
    return null;
  }
})();

/** 统一响应形状。调用方靠 ok 判断，不靠字段是否存在猜 */
type Reply = { ok: true; data?: unknown } | { ok: false; code: string; message: string };

const ok = (data?: unknown): Reply => ({ ok: true, data });
const err = (code: string, message: string): Reply => ({ ok: false, code, message });

async function handle(message: unknown): Promise<Reply> {
  if (exampleCourse) {
    try {
      await library.ensureExampleCourse(exampleCourse);
    } catch {
      // 示例初始化失败不影响真实授权课程，后者仍可继续兑换。
    }
  }

  if (typeof message !== 'object' || message === null) {
    return err('BAD_MESSAGE', '消息格式不正确。');
  }
  const m = message as Record<string, unknown>;

  switch (m.type) {
    case 'library': {
      return ok(buildLibraryView(await library.read()));
    }

    case 'redeem': {
      if (typeof m.code !== 'string') return err('BAD_MESSAGE', '缺少授权码。');
      const result = await redeemAccessCode(m.code, {
        library,
        assetStore,
        apiOrigin: API_ORIGIN,
        fetch: globalThis.fetch.bind(globalThis),
        now: () => new Date(),
      });
      return result.ok
        ? ok({ installed: result.installed.map((c) => ({ courseId: c.courseId, title: c.title })) })
        : err(result.code, result.message);
    }

    case 'asset': {
      if (typeof m.courseId !== 'string' || typeof m.assetId !== 'string') {
        return err('BAD_MESSAGE', '缺少课程或资源。');
      }
      try {
        const root = await library.read();
        const course = root.installedCourses[m.courseId];
        if (!course?.releaseId) return err('ASSET_MISSING', '本机没有这个课程资源。');
        const cached = await assetStore.get(
          m.courseId,
          course.releaseId,
          m.assetId
        );
        if (!cached) return err('ASSET_MISSING', '本机没有这个课程资源。');
        return ok({
          assetId: cached.assetId,
          mimeType: cached.mimeType,
          bytes: await cached.blob.arrayBuffer(),
        });
      } catch (error) {
        if (error instanceof AssetCacheError) {
          return err(
            error.code,
            error.code === 'ASSET_CORRUPT'
              ? '本机资源校验失败。'
              : '本机资源读取失败。'
          );
        }
        return err('STORAGE', '本机资源读取失败。');
      }
    }

    case 'upgradeTasks': {
      try {
        return ok({ tasks: await library.listUpgradeTasks() });
      } catch {
        return err('STORAGE', '升级任务读取失败。');
      }
    }

    case 'pauseUpgrade':
    case 'resumeUpgrade':
    case 'cancelUpgrade': {
      if (typeof m.taskKey !== 'string' || !m.taskKey) {
        return err('BAD_MESSAGE', '缺少升级任务。');
      }
      const status =
        m.type === 'pauseUpgrade'
          ? 'paused'
          : m.type === 'resumeUpgrade'
            ? 'queued'
            : 'cancelled';
      try {
        const task = await library.updateUpgradeTask(m.taskKey, { status });
        return ok({ task });
      } catch {
        return err(
          m.type === 'cancelUpgrade' ? 'NOT_FOUND' : 'STORAGE',
          m.type === 'cancelUpgrade' ? '升级任务不存在。' : '升级任务状态更新失败。'
        );
      }
    }

    case 'checkCourseUpdates': {
      if (
        m.courseIds !== undefined &&
        (!Array.isArray(m.courseIds) ||
          m.courseIds.some((courseId) => typeof courseId !== 'string'))
      ) {
        return err('BAD_MESSAGE', '课程筛选条件不正确。');
      }
      const result = await checkCourseUpdates(
        {
          library,
          assetStore,
          apiOrigin: API_ORIGIN,
          fetch: globalThis.fetch.bind(globalThis),
        },
        m.courseIds as string[] | undefined
      );
      return result.ok ? ok({ courses: result.courses }) : err(result.code, result.message);
    }

    case 'upgradeCourse': {
      if (
        typeof m.courseId !== 'string' ||
        typeof m.expectedReleaseId !== 'string'
      ) {
        return err('BAD_MESSAGE', '缺少课程或期望版本。');
      }
      const result = await upgradeCourse(m.courseId, m.expectedReleaseId, {
        library,
        assetStore,
        apiOrigin: API_ORIGIN,
        fetch: globalThis.fetch.bind(globalThis),
      });
      return result.ok ? ok({ course: result.course }) : err(result.code, result.message);
    }

    case 'candidates': {
      if (!isBilibiliVideoRef(m.videoRef)) return err('BAD_MESSAGE', '缺少完整视频引用。');
      return ok(findCandidates(await library.read(), m.videoRef));
    }

    case 'lesson': {
      const { courseId, lessonId } = m as { courseId?: string; lessonId?: string };
      if (!courseId || !lessonId) return err('BAD_MESSAGE', '缺少课程或课节。');

      const root = await library.read();
      const course = root.installedCourses[courseId];
      const lesson = course?.lessons.find((l) => l.lessonId === lessonId);
      if (!lesson) return err('NOT_INSTALLED', '本机没有这个课节。');

      const progress = root.localLearningState[courseId]?.[lessonId];
      return ok({
        installedAt: course.installedAt,
        nodes: lesson.nodes,
        done: progress?.done ?? [],
        lastPositionSeconds: progress?.lastPositionSeconds ?? 0,
      });
    }

    case 'attempt': {
      const a = m as Record<string, any>;
      if (!a.courseId || !a.lessonId || !a.nodeId) {
        return err('BAD_MESSAGE', '作答记录缺少标识。');
      }
      try {
        await library.recordAttempt(a.courseId, a.lessonId, a.nodeId, {
          at: String(a.at ?? new Date().toISOString()),
          answer: String(a.answer ?? ''),
          correct: typeof a.correct === 'boolean' ? a.correct : null,
        });
        return ok();
      } catch {
        return err('STORAGE', '作答未能保存。');
      }
    }

    case 'position': {
      const p = m as Record<string, any>;
      if (!p.courseId || !p.lessonId) return err('BAD_MESSAGE', '缺少课程或课节。');
      try {
        await library.savePosition(p.courseId, p.lessonId, Number(p.seconds) || 0);
        return ok();
      } catch {
        // 位置丢一次无关紧要，不打扰学生
        return ok();
      }
    }

    case 'removalImpact': {
      if (typeof m.courseId !== 'string') return err('BAD_MESSAGE', '缺少课程。');
      const impact = removalImpact(await library.read(), m.courseId);
      return impact ? ok(impact) : err('NOT_INSTALLED', '本机没有这门课程。');
    }

    case 'removeCourse': {
      if (typeof m.courseId !== 'string') return err('BAD_MESSAGE', '缺少课程。');
      try {
        const root = await library.read();
        if (root.installedCourses[m.courseId]?.readOnly) {
          return err('READ_ONLY', '示例课程不可删除，只能重置学习进度。');
        }
        await library.removeCourse(m.courseId);
        return ok();
      } catch {
        return err('STORAGE', '删除失败，课程仍在本机。');
      }
    }

    case 'resetProgress': {
      if (typeof m.courseId !== 'string') return err('BAD_MESSAGE', '缺少课程。');
      try {
        await library.resetProgress(m.courseId);
        return ok();
      } catch {
        return err('STORAGE', '重置失败，进度未改变。');
      }
    }

    default:
      // 不认识的消息明确拒绝，不静默返回成功
      return err('UNKNOWN_OPERATION', '不支持的操作。');
  }
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  handle(message)
    .then(respond)
    .catch(() => respond(err('INTERNAL', '扩展内部出错，请重试。')));
  return true; // 保持消息通道开着，异步响应才能送达
});

// 安装或更新时清掉旧版本留下的键。它们不迁移
chrome.runtime.onInstalled.addListener(() => {
  void library.dropLegacyKeys();
});
