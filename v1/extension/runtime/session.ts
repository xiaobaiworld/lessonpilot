import { NodeAttempt } from '../storage/types';
import { RichPageDocument, PresentationHints } from '../../web/shared/src';

/**
 * 学习会话状态机。
 *
 * 纯逻辑，不含任何 B 站选择器或 DOM 调用——host adapter 负责那一层。
 * 这样同一套调度规则可以在测试里跑完，不需要真实播放器。
 */

export type NodeKind = 'notice' | 'choice' | 'blank' | 'free_text';

export interface RuntimeNode {
  id: string;
  interaction: NodeKind;
  timeSeconds: number;
  title: string;
  content: RichPageDocument;
  interactionData: Record<string, unknown> | null;
  presentationHints?: PresentationHints;
}

/**
 * 学习窗口的状态。
 *
 * 这些状态互不冒充：关闭、出错、跳过、不支持、完成各有各的后续动作，
 * 混成一个"结束了"会让跳过被记成答对、出错被记成完成。
 */
export type WindowState =
  | { kind: 'idle' }
  | { kind: 'open'; node: RuntimeNode; draft: string }
  | { kind: 'answered'; node: RuntimeNode; outcome: NodeOutcome }
  | { kind: 'unsupported'; node: RuntimeNode; reason: string };

export type NodeOutcome =
  | { result: 'correct' }
  | { result: 'incorrect' }
  | { result: 'acknowledged' } // 重点标注这类无判分节点
  | { result: 'skipped' }
  | { result: 'failed'; reason: string };

export interface SessionSnapshot {
  courseId: string;
  lessonId: string;
  /** 锁定到安装时那一份，会话中途不热切换 */
  installedAt: string;
  window: WindowState;
  /** 本次会话已触发过的节点，防止 seek 回退后重复弹窗 */
  triggered: string[];
}

/** 一次要求宿主执行的动作。会话自己不碰播放器 */
export type HostAction =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'none' };

export interface AttemptRecord {
  nodeId: string;
  attempt: NodeAttempt;
}

const NO_ANSWER: NodeKind[] = ['notice'];

/** 判分。只有本机可判的类型才判，问答题交给学生自评 */
export function evaluate(node: RuntimeNode, answer: string): NodeOutcome {
  if (NO_ANSWER.includes(node.interaction)) return { result: 'acknowledged' };

  const e = node.interactionData ?? {};

  if (node.interaction === 'choice') {
    return answer === e.answer ? { result: 'correct' } : { result: 'incorrect' };
  }

  if (node.interaction === 'blank') {
    const rules = Array.isArray(e.normalize) ? (e.normalize as string[]) : [];
    const norm = (s: string) => {
      let out = s;
      if (rules.includes('trim')) out = out.trim();
      if (rules.includes('casefold')) out = out.toLowerCase();
      return out;
    };
    const accepted = Array.isArray(e.acceptedAnswers) ? (e.acceptedAnswers as string[]) : [];
    return accepted.some((a) => norm(a) === norm(answer))
      ? { result: 'correct' }
      : { result: 'incorrect' };
  }

  // 问答题不自动判分，展示参考答案后由学生确认
  return { result: 'acknowledged' };
}

export class LearningSession {
  private window: WindowState = { kind: 'idle' };
  private triggered = new Set<string>();
  private nodes: RuntimeNode[];
  private replayableNodeIds: Set<string>;
  private lastTime = 0;

  constructor(
    public readonly courseId: string,
    public readonly lessonId: string,
    /** 安装时刻。会话期间课程库更新不影响正在跑的这一份 */
    public readonly installedAt: string,
    nodes: RuntimeNode[]
  ) {
    // 按时刻排序，同刻按 id 稳定排序，保证两次运行顺序一致
    this.nodes = [...nodes].sort(
      (a, b) => a.timeSeconds - b.timeSeconds || a.id.localeCompare(b.id)
    );
    this.replayableNodeIds = new Set(
      this.nodes
        .filter((node) => node.interaction === 'notice')
        .map((node) => node.id)
    );
  }

  snapshot(): SessionSnapshot {
    return {
      courseId: this.courseId,
      lessonId: this.lessonId,
      installedAt: this.installedAt,
      window: this.window,
      triggered: [...this.triggered],
    };
  }

  /** 恢复已作答的节点，刷新后不再重复弹同一个 */
  restoreDone(nodeIds: string[]): void {
    for (const id of nodeIds) {
      if (!this.replayableNodeIds.has(id)) this.triggered.add(id);
    }
  }

  /**
   * 播放进度推进。
   *
   * 只在跨过节点时刻的那一刻触发一次。窗口已开时不再叠加第二个——
   * 同时弹两个窗口没有正确的收尾顺序。
   */
  advance(seconds: number): HostAction {
    if (seconds < this.lastTime - 1) {
      for (const id of this.replayableNodeIds) this.triggered.delete(id);
    }
    this.lastTime = seconds;
    if (this.window.kind !== 'idle') return { type: 'none' };

    const due = this.nodes.find(
      (n) => !this.triggered.has(n.id) && seconds >= n.timeSeconds
    );
    if (!due) return { type: 'none' };

    this.triggered.add(due.id);

    const supported: NodeKind[] = ['notice', 'choice', 'blank', 'free_text'];
    if (!supported.includes(due.interaction)) {
      // 不认识的类型不能假装完成，也不能卡住播放
      this.window = {
        kind: 'unsupported',
        node: due,
        reason: `不支持的节点类型 ${due.interaction}`,
      };
      return { type: 'none' };
    }

    this.window = { kind: 'open', node: due, draft: '' };
    return { type: 'pause' };
  }

  /** 输入草稿。与正式尝试分开：草稿不写盘，不计入作答历史 */
  updateDraft(text: string): void {
    if (this.window.kind === 'open') {
      this.window = { ...this.window, draft: text };
    }
  }

  /**
   * 提交作答。
   *
   * 返回要追加保存的记录；窗口不在 open 状态时返回 null，
   * 重复点击提交不会记第二条。
   */
  submit(at: string): AttemptRecord | null {
    if (this.window.kind !== 'open') return null;

    const { node, draft } = this.window;
    const outcome = evaluate(node, draft);
    this.window = { kind: 'answered', node, outcome };

    return {
      nodeId: node.id,
      attempt: {
        at,
        answer: draft,
        correct:
          outcome.result === 'correct'
            ? true
            : outcome.result === 'incorrect'
              ? false
              : null,
      },
    };
  }

  /** 学生主动跳过。记为 skipped，不能当作答对 */
  skip(at: string): AttemptRecord | null {
    if (this.window.kind !== 'open') return null;
    const { node } = this.window;
    this.window = { kind: 'answered', node, outcome: { result: 'skipped' } };
    return { nodeId: node.id, attempt: { at, answer: '', correct: null } };
  }

  /** 渲染或判分出错。记为 failed，学生能继续看视频 */
  failCurrent(reason: string): void {
    if (this.window.kind === 'open') {
      this.window = {
        kind: 'answered',
        node: this.window.node,
        outcome: { result: 'failed', reason },
      };
    }
  }

  /** 关窗继续播放。answered / unsupported 都从这里回到 idle */
  close(): HostAction {
    if (this.window.kind === 'idle') return { type: 'none' };
    this.window = { kind: 'idle' };
    return { type: 'resume' };
  }

  /**
   * 暂时退出课程模式。
   *
   * 尚未作答的节点需要从 triggered 中撤回，否则学生切回课程模式后会永远
   * 错过它；已经提交或跳过的节点仍保留完成状态。
   */
  suspend(): HostAction {
    if (this.window.kind === 'idle') return { type: 'none' };
    if (this.window.kind === 'open') this.triggered.delete(this.window.node.id);
    this.window = { kind: 'idle' };
    return { type: 'resume' };
  }

  /**
   * 学生 seek。
   *
   * 往前拖不补触发已跳过的节点——那会连弹好几个窗口。
   * 往回拖也不重置已触发标记：同一个节点在一次会话里只打断一次。
   */
  seek(seconds: number): HostAction {
    if (seconds < this.lastTime - 1) {
      for (const id of this.replayableNodeIds) this.triggered.delete(id);
    }
    for (const node of this.nodes) {
      if (seconds > node.timeSeconds && !this.replayableNodeIds.has(node.id)) {
        this.triggered.add(node.id);
      }
    }
    this.lastTime = seconds;
    return { type: 'none' };
  }

  /** 全部节点都触发过 */
  get complete(): boolean {
    return this.nodes.every((n) => this.triggered.has(n.id));
  }
}

/** 从已安装课节构造运行时节点 */
export function toRuntimeNodes(lesson: { nodes: unknown[]; lessonId?: string; title?: string; videoId?: string }): RuntimeNode[] {
  const out: RuntimeNode[] = [];
  for (const raw of lesson.nodes) {
    const n = raw as Record<string, any>;
    if (typeof n?.id !== 'string') continue;
    const t = n?.anchor?.timeSeconds;
    if (typeof t !== 'number' || !Number.isFinite(t)) continue;
    out.push({
      id: n.id,
      interaction: n.interaction,
      timeSeconds: t,
      title: typeof n.title === 'string' ? n.title : '',
      content: n.content,
      interactionData: n.interactionData ?? null,
      presentationHints: n.presentationHints,
    });
  }
  return out;
}
