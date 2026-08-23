import {
  currentVideoId,
  waitForVideo,
  attachPlayer,
  watchNavigation,
  PlayerHandle,
} from '../host/bilibili';
import { LearningSession, toRuntimeNodes } from '../runtime/session';
import { LearningWindow } from './window';
import { CandidatePicker } from './picker';
import { RuntimeCandidate } from '../shared/library-view';
import styleText from './window.css?inline';

/**
 * B 站页面上的课程运行时。
 *
 * 职责边界：本文件只做接线。BVID 与播放器归 host adapter，调度与判分归
 * runtime/session，渲染归 content/window，存储访问一律经 background 消息
 * —— content script 不直接读写 chrome.storage，那样两个标签页会各写一份。
 */

type Message =
  | { type: 'candidates'; videoId: string }
  | { type: 'lesson'; courseId: string; lessonId: string }
  | {
      type: 'attempt';
      courseId: string;
      lessonId: string;
      nodeId: string;
      at: string;
      answer: string;
      correct: boolean | null;
    }
  | { type: 'position'; courseId: string; lessonId: string; seconds: number };

async function send<T>(message: Message): Promise<T | null> {
  try {
    const reply = await chrome.runtime.sendMessage(message);
    /*
     * 扩展更新后旧 service worker 可能已失效，sendMessage 会成功返回
     * undefined。只捕获 rejection 会漏掉这条路径，随后读 reply.xxx 直接
     * 抛异常，界面永久停在等待态（doc/lessons.md 2026-08-20 条）。
     */
    if (!reply || typeof reply !== 'object' || (reply as any).ok !== true) return null;
    return (reply as any).data as T;
  } catch {
    return null;
  }
}

class Runtime {
  private session: LearningSession | null = null;
  private window: LearningWindow | null = null;
  private player: PlayerHandle | null = null;
  private picker: CandidatePicker | null = null;
  /*
   * start() 里有多个 await（取候选、等学生选、等播放器出现）。
   * 期间 SPA 可能已经切走并调过 stop()，若不检查就会把监听绑到
   * 已废弃的运行时上，学生在新视频页看到上一课的窗口。
   */
  private stopped = false;
  private teardown: (() => void)[] = [];

  async start(videoId: string): Promise<void> {
    const candidates = await send<RuntimeCandidate[]>({ type: 'candidates', videoId });

    // 没有匹配课程时安静退出，不在无关页面显示任何 KnownMap UI
    if (!candidates || candidates.length === 0) return;
    if (this.stopped) return;

    /*
     * 单候选直接启动；多候选让学生选（D-V1-010）。
     * 静默取第一个会让学生在一门课里做另一门课的题，而界面上看不出为什么。
     */
    let pick: RuntimeCandidate;
    if (candidates.length === 1) {
      pick = candidates[0];
    } else {
      this.picker = new CandidatePicker(styleText);
      const chosen = await this.picker.choose(candidates);
      this.picker = null;
      if (!chosen || this.stopped) return; // 先不学，或已切走
      pick = chosen;
    }

    const lesson = await send<{
      installedAt: string;
      nodes: unknown[];
      done: string[];
      lastPositionSeconds: number;
    }>({ type: 'lesson', courseId: pick.courseId, lessonId: pick.lessonId });
    if (!lesson) return;
    if (this.stopped) return;

    const video = await waitForVideo();
    if (!video) return; // 播放器没出现就不接线，也不留 UI
    if (this.stopped) return;

    const nodes = toRuntimeNodes({
      lessonId: pick.lessonId,
      title: pick.lessonTitle,
      videoId,
      nodes: lesson.nodes,
    });
    if (nodes.length === 0) return;

    this.session = new LearningSession(
      pick.courseId,
      pick.lessonId,
      lesson.installedAt,
      nodes
    );
    this.session.restoreDone(lesson.done ?? []);

    this.player = attachPlayer(video);
    this.window = new LearningWindow(
      {
        onDraft: (text) => this.session?.updateDraft(text),
        onSubmit: () => this.commit('submit'),
        onSkip: () => this.commit('skip'),
        onClose: () => this.close(),
      },
      styleText
    );

    this.teardown.push(
      this.player.onTimeUpdate((seconds) => this.tick(seconds)),
      this.player.onSeeked((seconds) => {
        this.session?.seek(seconds);
      })
    );
  }

  private tick(seconds: number): void {
    if (!this.session) return;

    const action = this.session.advance(seconds);
    if (action.type === 'pause') this.player?.pause();

    if (action.type !== 'none' || this.session.snapshot().window.kind !== 'idle') {
      this.window?.render(this.session.snapshot().window);
    }

    // 位置节流到整秒，timeupdate 每秒触发多次
    const whole = Math.floor(seconds);
    if (whole !== this.lastSaved) {
      this.lastSaved = whole;
      void send({
        type: 'position',
        courseId: this.session.courseId,
        lessonId: this.session.lessonId,
        seconds: whole,
      });
    }
  }

  private lastSaved = -1;

  private commit(kind: 'submit' | 'skip'): void {
    if (!this.session) return;

    const record =
      kind === 'submit'
        ? this.session.submit(new Date().toISOString())
        : this.session.skip(new Date().toISOString());

    this.window?.render(this.session.snapshot().window);

    if (record) {
      void send({
        type: 'attempt',
        courseId: this.session.courseId,
        lessonId: this.session.lessonId,
        nodeId: record.nodeId,
        at: record.attempt.at,
        answer: record.attempt.answer,
        correct: record.attempt.correct,
      });
    }
  }

  private close(): void {
    if (!this.session) return;
    const action = this.session.close();
    this.window?.render(this.session.snapshot().window);
    if (action.type === 'resume') this.player?.play();
  }

  /** 拆掉全部监听和 DOM。SPA 切走时必须调用 */
  stop(): void {
    this.stopped = true;
    for (const off of this.teardown) off();
    this.teardown = [];
    this.window?.destroy();
    this.window = null;
    this.picker?.destroy();
    this.picker = null;
    this.session = null;
    this.player = null;
    this.lastSaved = -1;
  }
}

let runtime: Runtime | null = null;

function restart(videoId: string | null): void {
  runtime?.stop();
  runtime = null;
  if (!videoId) return;
  runtime = new Runtime();
  void runtime.start(videoId);
}

restart(currentVideoId());
watchNavigation(restart);
