import { RuntimeNode, WindowState, NodeOutcome } from '../runtime/session';
import { VideoMode } from './runtime';

/**
 * 学习窗口渲染。
 *
 * 四类节点共用同一个生命周期：打开 → 作答 → 反馈 → 关闭。
 * 只有渲染在这里，判分和状态迁移都在 runtime/session.ts。
 *
 * 用 Shadow DOM 隔离样式：B 站页面自己的 CSS 很重，不隔离会互相污染，
 * 而污染 B 站的样式属于超出必要的干预。
 */

export interface WindowCallbacks {
  onDraft(text: string): void;
  onSubmit(): void;
  onSkip(): void;
  onClose(): void;
}

const OUTCOME_TEXT: Record<NodeOutcome['result'], string> = {
  correct: '答对了',
  incorrect: '再想想',
  acknowledged: '已了解',
  skipped: '已跳过',
  failed: '这个节点出了问题',
};

export class LearningWindow {
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;
  private detachFullscreen: (() => void) | null = null;

  constructor(
    private callbacks: WindowCallbacks,
    private styleText: string
  ) {}

  render(state: WindowState): void {
    if (state.kind === 'idle') {
      this.destroy();
      return;
    }

    const root = this.ensureRoot();
    root.querySelector('.km-panel')?.remove();

    const panel = document.createElement('div');
    panel.className = 'km-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');

    if (state.kind === 'unsupported') {
      panel.append(
        this.heading('这个互动暂时无法显示'),
        this.paragraph(state.reason),
        this.actions([this.button('继续播放', 'primary', this.callbacks.onClose)])
      );
    } else if (state.kind === 'open') {
      this.renderQuestion(panel, state.node, state.draft);
    } else {
      this.renderOutcome(panel, state.node, state.outcome);
    }

    root.append(panel);
    // 焦点移进窗口，键盘用户不必先 Tab 穿过整个 B 站页面
    panel.querySelector<HTMLElement>('textarea, input, button')?.focus();
  }

  private renderQuestion(panel: HTMLElement, node: RuntimeNode, draft: string): void {
    const d = node.display as Record<string, any>;
    panel.append(this.heading(String(d.title ?? '')));

    if (node.interaction === 'notice') {
      panel.append(this.paragraph(String(d.body ?? '')));
      panel.append(
        this.actions([this.button('确认并继续', 'primary', this.callbacks.onSubmit)])
      );
      return;
    }

    panel.append(this.paragraph(String(d.prompt ?? '')));

    if (node.interaction === 'choice') {
      const options = Array.isArray(d.options) ? d.options : [];
      const list = document.createElement('div');
      list.className = 'km-options';
      for (const opt of options) {
        const label = document.createElement('label');
        label.className = 'km-option';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'km-answer';
        radio.value = String(opt.id);
        radio.checked = draft === String(opt.id);
        radio.addEventListener('change', () => this.callbacks.onDraft(String(opt.id)));
        label.append(radio, document.createTextNode(String(opt.label ?? '')));
        list.append(label);
      }
      panel.append(list);
    } else {
      const input = document.createElement(
        node.interaction === 'blank' ? 'input' : 'textarea'
      ) as HTMLInputElement | HTMLTextAreaElement;
      input.className = 'km-input';
      input.value = draft;
      if (input instanceof HTMLTextAreaElement) input.rows = 4;
      input.addEventListener('input', () => this.callbacks.onDraft(input.value));
      panel.append(input);
    }

    panel.append(
      this.actions([
        this.button('跳过', 'ghost', this.callbacks.onSkip),
        this.button('提交', 'primary', this.callbacks.onSubmit),
      ])
    );
  }

  private renderOutcome(
    panel: HTMLElement,
    node: RuntimeNode,
    outcome: NodeOutcome
  ): void {
    const e = (node.evaluation ?? {}) as Record<string, any>;
    panel.append(this.heading(OUTCOME_TEXT[outcome.result]));

    if (outcome.result === 'failed') {
      panel.append(this.paragraph(outcome.reason));
    }

    // 解析/参考答案：答错和跳过都该看到，这是学习的部分
    const explanation = e.explanation ?? e.referenceFeedback;
    if (typeof explanation === 'string' && explanation.trim()) {
      panel.append(this.paragraph(explanation));
    }

    panel.append(
      this.actions([this.button('继续播放', 'primary', this.callbacks.onClose)])
    );
  }

  private ensureRoot(): ShadowRoot {
    if (this.root) return this.root;

    this.host = document.createElement('div');
    this.host.id = 'knownmap-learning-window';
    // Shadow DOM 双向隔离，B 站的 CSS 进不来，我们的也出不去
    this.root = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = this.styleText;
    this.root.append(style);

    this.mount();

    /*
     * 学生进出全屏时把窗口搬到正确的父节点。
     * 全屏期间只有全屏元素的子树参与渲染，挂在 body 上的窗口有尺寸但
     * 看不见——学生只会看到画面冻住，没有任何提示，也没法继续。
     */
    const onFullscreenChange = () => this.mount();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    this.detachFullscreen = () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);

    return this.root;
  }

  /** 挂到当前该挂的父节点：全屏时是全屏元素，否则是 body */
  private mount(): void {
    if (!this.host) return;
    const parent = document.fullscreenElement ?? document.body;
    if (this.host.parentNode !== parent) parent.append(this.host);
  }

  /** 移除窗口与宿主节点。离开页面时必须调用，否则 SPA 切走后残留 DOM */
  destroy(): void {
    this.detachFullscreen?.();
    this.detachFullscreen = null;
    this.host?.remove();
    this.host = null;
    this.root = null;
  }

  private heading(text: string): HTMLElement {
    const h = document.createElement('h2');
    h.className = 'km-title';
    h.textContent = text; // textContent 而非 innerHTML：内容来自课程包，按数据处理
    return h;
  }

  private paragraph(text: string): HTMLElement {
    const p = document.createElement('p');
    p.className = 'km-body';
    p.textContent = text;
    return p;
  }

  private actions(buttons: HTMLElement[]): HTMLElement {
    const row = document.createElement('div');
    row.className = 'km-actions';
    row.append(...buttons);
    return row;
  }

  private button(
    text: string,
    kind: 'primary' | 'ghost',
    onClick: () => void
  ): HTMLElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `km-button km-${kind}`;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }
}

export class VideoModeControl {
  private host: HTMLElement;
  private root: ShadowRoot;
  private button: HTMLButtonElement;
  private detachFullscreen: (() => void) | null = null;

  constructor(onToggle: () => void, styleText: string) {
    this.host = document.createElement('div');
    this.host.id = 'knownmap-video-mode-control';
    this.root = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = styleText;
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'km-mode-button';
    this.button.addEventListener('click', onToggle);
    this.root.append(style, this.button);

    const onFullscreenChange = () => this.mount();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    this.detachFullscreen = () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    this.mount();
  }

  setMode(mode: VideoMode): void {
    const original = mode === 'original';
    this.button.textContent = original ? '课程模式' : '原视频';
    this.button.setAttribute(
      'aria-label',
      original ? '切换到 KnownMap 课程模式' : '切换到原视频模式'
    );
    this.button.dataset.mode = mode;
  }

  private mount(): void {
    const parent = document.fullscreenElement ?? document.body;
    if (this.host.parentNode !== parent) parent.append(this.host);
  }

  destroy(): void {
    this.detachFullscreen?.();
    this.detachFullscreen = null;
    this.host.remove();
  }
}
