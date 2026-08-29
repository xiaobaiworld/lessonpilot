import { LearningSession, toRuntimeNodes } from '../runtime/session';
import { RuntimeCandidate } from '../shared/library-view';
import { PlayerHandle } from '../host/bilibili';
import type { BilibiliVideoRef } from '../shared/video-reference';
import type { PortableNode } from '../../web/shared/src/portableContent';
import type { CompanionVisualState } from './companion-assets';

/**
 * B 站页面上的课程运行时。
 *
 * 依赖全部注入，所以整条接线可以在测试里跑完，不需要真实播放器或扩展环境。
 * content/index.ts 只负责把真实依赖填进来并自启动。
 *
 * 职责边界：BVID 与播放器归 host adapter，调度与判分归 runtime/session，
 * 渲染归 content/window，存储访问一律经 background。
 */

export interface LessonPayload {
  installedAt: string;
  nodes: PortableNode[];
  done: string[];
  lastPositionSeconds: number;
}

/** 与 background 的通信。返回 null 表示这次请求不可用 */
export interface Messenger {
  candidates(videoRef: BilibiliVideoRef | string): Promise<RuntimeCandidate[] | null>;
  lesson(courseId: string, lessonId: string): Promise<LessonPayload | null>;
  attempt(
    courseId: string,
    lessonId: string,
    nodeId: string,
    at: string,
    answer: string,
    correct: boolean | null
  ): Promise<void>;
  position(courseId: string, lessonId: string, seconds: number): Promise<void>;
}

export interface WindowView {
  render(state: unknown): void;
  destroy(): void;
}

export type VideoMode = 'course' | 'original';

export interface VideoModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface VideoModeStore {
  read(): VideoMode;
  write(mode: VideoMode): VideoMode;
}

export interface ModeControl {
  setMode(mode: VideoMode): void;
  destroy(): void;
}

export interface CompanionStateSink {
  setVisualState(state: CompanionVisualState, eventKey?: string): void;
}

const VIDEO_MODE_STORAGE_KEY = 'lessonpilot.video-mode';

export function createVideoModeStore(
  storage: VideoModeStorage | null
): VideoModeStore {
  return {
    read() {
      try {
        return storage?.getItem(VIDEO_MODE_STORAGE_KEY) === 'original'
          ? 'original'
          : 'course';
      } catch {
        return 'course';
      }
    },
    write(mode) {
      const next = mode === 'original' ? 'original' : 'course';
      try {
        storage?.setItem(VIDEO_MODE_STORAGE_KEY, next);
      } catch {
        // 页面阻止 localStorage 时仍允许本次会话切换。
      }
      return next;
    },
  };
}

export interface RuntimeDeps {
  messenger: Messenger;
  /** 等播放器出现。返回 null 表示等不到，此时不接线也不留 UI */
  waitForPlayer(): Promise<PlayerHandle | null>;
  createWindow(callbacks: {
    courseId: string;
    onDraft(text: string): void;
    onSubmit(): void;
    onSkip(): void;
    onClose(): void;
  }): WindowView;
  modeStore: VideoModeStore;
  createModeControl(onToggle: () => void): ModeControl;
  /** 多候选时让学生选。返回 null 表示学生选择先不学 */
  chooseCandidate(candidates: RuntimeCandidate[]): Promise<RuntimeCandidate | null>;
  now(): Date;
  companion?: CompanionStateSink;
}

export class CourseRuntime {
  private session: LearningSession | null = null;
  private view: WindowView | null = null;
  private player: PlayerHandle | null = null;
  private modeControl: ModeControl | null = null;
  private videoMode: VideoMode = 'course';
  private teardown: (() => void)[] = [];
  private lastSavedSecond = -1;
  private pausedByRuntime = false;
  private companionState: CompanionVisualState | null = null;
  private companionEventKey: string | undefined;

  /*
   * start() 里有多个 await（取候选、等学生选、等播放器出现）。
   * 期间 SPA 可能已经切走并调过 stop()，若不检查就会把监听绑到已废弃的
   * 运行时上，学生在新视频页看到上一课的窗口。
   */
  private stopped = false;

  constructor(private deps: RuntimeDeps) {}

  async start(videoRef: BilibiliVideoRef | string): Promise<void> {
    const candidates = await this.deps.messenger.candidates(videoRef);
    // 没有匹配课程时安静退出，不在无关页面显示任何 KnownMap UI
    if (!candidates || candidates.length === 0 || this.stopped) return;

    // 单候选直接启动；多候选让学生选（D-V1-010）
    let pick: RuntimeCandidate;
    if (candidates.length === 1) {
      pick = candidates[0];
    } else {
      const chosen = await this.deps.chooseCandidate(candidates);
      if (!chosen || this.stopped) return;
      pick = chosen;
    }

    const lesson = await this.deps.messenger.lesson(pick.courseId, pick.lessonId);
    if (!lesson || this.stopped) return;

    const nodes = toRuntimeNodes({
      lessonId: pick.lessonId,
      title: pick.lessonTitle,
      videoId: typeof videoRef === 'string' ? videoRef : videoRef.videoId,
      nodes: lesson.nodes,
    });
    if (nodes.length === 0) return;

    const player = await this.deps.waitForPlayer();
    if (!player || this.stopped) return;

    this.session = new LearningSession(
      pick.courseId,
      pick.lessonId,
      lesson.installedAt,
      nodes
    );
    this.session.restoreDone(lesson.done ?? []);

    this.player = player;
    this.videoMode = this.deps.modeStore.read();
    this.view = this.deps.createWindow({
      courseId: this.session.courseId,
      onDraft: (text) => this.session?.updateDraft(text),
      onSubmit: () => this.commit('submit'),
      onSkip: () => this.commit('skip'),
      onClose: () => this.close(),
    });
    this.modeControl = this.deps.createModeControl(() => this.toggleVideoMode());
    this.modeControl.setMode(this.videoMode);
    this.setCompanionState('focus', `focus:${this.session.courseId}:${this.session.lessonId}`);

    this.teardown.push(
      player.onTimeUpdate((seconds) => this.tick(seconds)),
      player.onSeeked((seconds) => {
        this.session?.seek(seconds);
      })
    );
  }

  private tick(seconds: number): void {
    if (!this.session) return;

    if (this.videoMode === 'course') {
      const action = this.session.advance(seconds);
      if (action.type === 'pause') {
        const player = this.player;
        this.pausedByRuntime = player?.isPlaying() ?? false;
        if (this.pausedByRuntime) player?.pause();
      }

      const state = this.session.snapshot().window;
      if (action.type !== 'none' || state.kind !== 'idle') {
        this.view?.render(state);
      }
      if (state.kind === 'open') this.setCompanionState('prompt', `prompt:${state.node.id}`);
      else if (state.kind === 'idle') this.setCompanionState('idle');
    }

    // 位置节流到整秒：timeupdate 每秒触发多次
    const whole = Math.floor(seconds);
    if (whole !== this.lastSavedSecond) {
      this.lastSavedSecond = whole;
      /*
       * 必须接 catch，不能只用 void：上报失败时 void 会留下未处理的
       * rejection，学生控制台里就是一条错误。位置丢一次无关紧要，
       * 但不能因此在页面上留下噪声。
       */
      this.deps.messenger
        .position(this.session.courseId, this.session.lessonId, whole)
        .catch(() => undefined);
    }
  }

  private commit(kind: 'submit' | 'skip'): void {
    if (!this.session) return;

    const at = this.deps.now().toISOString();
    const record =
      kind === 'submit' ? this.session.submit(at) : this.session.skip(at);

    const window = this.session.snapshot().window;
    this.view?.render(window);
    if (window.kind === 'answered') {
      if (window.outcome.result === 'correct' || window.outcome.result === 'acknowledged') {
        this.setCompanionState('correct', `correct:${window.node.id}`);
      } else if (window.outcome.result === 'incorrect') {
        this.setCompanionState('wrong', `wrong:${window.node.id}`);
      }
    }

    if (record) {
      // 同上：上报失败不能变成页面上的未处理 rejection。
      // 作答已在本机内存里，界面照常进入已作答态。
      this.deps.messenger
        .attempt(
          this.session.courseId,
          this.session.lessonId,
          record.nodeId,
          record.attempt.at,
          record.attempt.answer,
          record.attempt.correct
        )
        .catch(() => undefined);
    }
  }

  private close(): void {
    if (!this.session) return;
    const beforeClose = this.session.snapshot().window;
    const action = this.session.close();
    const shouldResume = this.pausedByRuntime;
    this.pausedByRuntime = false;
    this.view?.render(this.session.snapshot().window);
    if (
      beforeClose.kind === 'answered' &&
      (beforeClose.outcome.result === 'correct' || beforeClose.outcome.result === 'acknowledged')
    ) {
      this.setCompanionState('complete', `complete:${beforeClose.node.id}`);
    } else {
      this.setCompanionState('idle');
    }
    if (action.type === 'resume' && shouldResume) this.player?.play();
  }

  private toggleVideoMode(): void {
    if (!this.session || !this.player) return;

    this.videoMode = this.deps.modeStore.write(
      this.videoMode === 'course' ? 'original' : 'course'
    );
    this.modeControl?.setMode(this.videoMode);

    if (this.videoMode === 'original') {
      const action = this.session.suspend();
      const shouldResume = this.pausedByRuntime;
      this.pausedByRuntime = false;
      this.view?.render(this.session.snapshot().window);
      this.setCompanionState('idle');
      if (action.type === 'resume' && shouldResume) this.player.play();
      return;
    }

    this.tick(this.player.currentTime());
  }

  /** 拆掉全部监听和 DOM。SPA 切走时必须调用 */
  stop(): void {
    this.stopped = true;
    for (const off of this.teardown) off();
    this.teardown = [];
    this.view?.destroy();
    this.modeControl?.destroy();
    this.view = null;
    this.modeControl = null;
    this.session = null;
    this.player = null;
    this.lastSavedSecond = -1;
    this.pausedByRuntime = false;
    this.videoMode = 'course';
    this.companionState = null;
    this.companionEventKey = undefined;
  }

  private setCompanionState(state: CompanionVisualState, eventKey?: string): void {
    if (!this.deps.companion) return;
    if (state === this.companionState && eventKey === this.companionEventKey) return;
    this.companionState = state;
    this.companionEventKey = eventKey;
    this.deps.companion.setVisualState(state, eventKey);
  }

  /** 供测试与诊断读取当前状态，不用于业务判断 */
  snapshot() {
    return this.session?.snapshot() ?? null;
  }
}

/**
 * 页面控制器。按当前 BVID 起停运行时。
 *
 * 每次切换都先 stop 再新建：复用实例会让上一课的已触发标记和监听留下来。
 */
export class PageController {
  private runtime: CourseRuntime | null = null;

  constructor(private makeRuntime: () => CourseRuntime) {}

  async navigate(videoRef: BilibiliVideoRef | string | null): Promise<void> {
    this.runtime?.stop();
    this.runtime = null;
    if (!videoRef) return;
    this.runtime = this.makeRuntime();
    await this.runtime.start(videoRef);
  }

  current(): CourseRuntime | null {
    return this.runtime;
  }
}
