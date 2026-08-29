import {
  currentVideoRef,
  findVideo,
  waitForVideo,
  attachPlayer,
  watchNavigation,
} from '../host/bilibili';
import { LearningWindow } from './window';
import type { RuntimeAsset } from './richText';
import { CandidatePicker } from './picker';
import {
  CourseRuntime,
  PageController,
  Messenger,
  createVideoModeStore,
} from './runtime';
import { LibraryView, RuntimeCandidate } from '../shared/library-view';
import styleText from './window.css?inline';
import companionStyle from './companion.css?inline';
import { StudentCompanion } from './companion';
import type { CompanionStateAsset, CompanionVisualState } from './companion-assets';

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
  candidates: (videoRef) => send<RuntimeCandidate[]>({ type: 'candidates', videoRef }),
  lesson: (courseId, lessonId) => send({ type: 'lesson', courseId, lessonId }),
  attempt: async (courseId, lessonId, nodeId, at, answer, correct) => {
    await send({ type: 'attempt', courseId, lessonId, nodeId, at, answer, correct });
  },
  position: async (courseId, lessonId, seconds) => {
    await send({ type: 'position', courseId, lessonId, seconds });
  },
};

const asset = async (
  courseId: string,
  assetId: string
): Promise<RuntimeAsset | null> => {
  return send<RuntimeAsset>({ type: 'asset', courseId, assetId });
};

const companion = new StudentCompanion({
  styleText: companionStyle,
  loadLibrary: () => send<LibraryView>({ type: 'library' }),
  redeem: async (code) => {
    const result = await send<{ installed: unknown[] }>({ type: 'redeem', code });
    return result
      ? { ok: true }
      : { ok: false, message: '课程领取失败，请稍后重试。' };
  },
  loadAsset: (state: CompanionVisualState) =>
    send<CompanionStateAsset>({ type: 'companionAsset', packId: 'cat-v1', state }),
  loadSoundEnabled: async () => {
    const result = await send<{ soundEnabled: boolean }>({ type: 'companionSound' });
    return typeof result?.soundEnabled === 'boolean' ? result.soundEnabled : null;
  },
  saveSoundEnabled: async (enabled) => {
    await send({ type: 'setCompanionSound', enabled });
  },
  onTogglePlayback: async () => {
    const video = findVideo();
    if (!video) return 'idle';
    if (video.paused || video.ended) {
      try {
        await video.play();
      } catch {
        return 'paused';
      }
      return 'playing';
    }
    video.pause();
    return 'paused';
  },
});

let visibilityRequest = 0;
const syncCompanionVisibility = async (videoRef: ReturnType<typeof currentVideoRef>) => {
  const request = ++visibilityRequest;
  companion.hide();
  if (!videoRef) return;
  const candidates = await messenger.candidates(videoRef);
  if (request === visibilityRequest && candidates && candidates.length > 0) companion.mount();
};

const syncCompanionState = () => {
  const video = findVideo();
  companion.setState(
    !video || video.paused || video.ended ? (video ? 'paused' : 'idle') : 'playing'
  );
};
syncCompanionState();
const companionStateTimer = window.setInterval(syncCompanionState, 1000);

let modeStorage: Storage | null = null;
try {
  modeStorage = window.localStorage;
} catch {
  modeStorage = null;
}

const controller = new PageController(
  () =>
    new CourseRuntime({
      messenger,
      waitForPlayer: async () => {
        const video = await waitForVideo();
        return video ? attachPlayer(video) : null;
      },
      createWindow: ({ courseId, ...callbacks }) =>
        new LearningWindow(callbacks, styleText, (assetId) =>
          asset(courseId, assetId)
        ),
      modeStore: createVideoModeStore(modeStorage),
      createModeControl: (onToggle) => companion.createModeControl(onToggle),
      chooseCandidate: (candidates) =>
        new CandidatePicker(styleText).choose(candidates),
      now: () => new Date(),
      companion,
    })
);

const initialVideoRef = currentVideoRef();
void syncCompanionVisibility(initialVideoRef);
void controller.navigate(initialVideoRef);
const stopNavigation = watchNavigation((videoRef) => {
  void syncCompanionVisibility(videoRef);
  void controller.navigate(videoRef);
});
window.addEventListener(
  'pagehide',
  () => {
    stopNavigation();
    window.clearInterval(companionStateTimer);
    companion.destroy();
  },
  { once: true }
);
