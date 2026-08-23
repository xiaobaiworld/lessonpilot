import {
  currentVideoId,
  waitForVideo,
  attachPlayer,
  watchNavigation,
} from '../host/bilibili';
import { LearningWindow } from './window';
import { CandidatePicker } from './picker';
import { CourseRuntime, PageController, Messenger } from './runtime';
import { RuntimeCandidate } from '../shared/library-view';
import styleText from './window.css?inline';

/**
 * 内容脚本入口。只负责把真实依赖填进 CourseRuntime。
 *
 * 接线逻辑在 content/runtime.ts，那里依赖全部可注入，所以能在测试里跑完
 * 整条链路——包括 seek、播放器重建、离线和扩展更新这些路径。
 */

async function send<T>(message: unknown): Promise<T | null> {
  try {
    const reply = await chrome.runtime.sendMessage(message);
    /*
     * 扩展更新后旧 service worker 可能已失效，sendMessage 会成功返回
     * undefined。只捕获 rejection 会漏掉这条路径，随后读 reply.xxx 直接
     * 抛异常，界面永久停在等待态（doc/lessons.md 2026-08-20）。
     */
    if (!reply || typeof reply !== 'object' || (reply as any).ok !== true) return null;
    return (reply as any).data as T;
  } catch {
    return null;
  }
}

const messenger: Messenger = {
  candidates: (videoId) => send<RuntimeCandidate[]>({ type: 'candidates', videoId }),
  lesson: (courseId, lessonId) => send({ type: 'lesson', courseId, lessonId }),
  attempt: async (courseId, lessonId, nodeId, at, answer, correct) => {
    await send({ type: 'attempt', courseId, lessonId, nodeId, at, answer, correct });
  },
  position: async (courseId, lessonId, seconds) => {
    await send({ type: 'position', courseId, lessonId, seconds });
  },
};

const controller = new PageController(
  () =>
    new CourseRuntime({
      messenger,
      waitForPlayer: async () => {
        const video = await waitForVideo();
        return video ? attachPlayer(video) : null;
      },
      createWindow: (callbacks) => new LearningWindow(callbacks, styleText),
      chooseCandidate: (candidates) =>
        new CandidatePicker(styleText).choose(candidates),
      now: () => new Date(),
    })
);

void controller.navigate(currentVideoId());
watchNavigation((videoId) => void controller.navigate(videoId));
