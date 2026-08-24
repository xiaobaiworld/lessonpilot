import { LibraryView } from '../shared/library-view';
import { VideoMode } from './runtime';
import {
  buildCompanionCourseRecords,
  CompanionCourseRecord,
  normalizeAccessCode,
} from './companion-model';

export type CompanionPlaybackState = 'idle' | 'playing' | 'paused';

export interface StudentCompanionDeps {
  styleText: string;
  loadLibrary(): Promise<LibraryView | null>;
  redeem(code: string): Promise<{ ok: boolean; message?: string }>;
  onTogglePlayback(): Promise<CompanionPlaybackState>;
}

export interface CompanionModeControl {
  setMode(mode: VideoMode): void;
  destroy(): void;
}

function drawMascot(
  ctx: CanvasRenderingContext2D,
  state: CompanionPlaybackState,
  frame: number
): void {
  ctx.clearRect(0, 0, 72, 96);
  const bounce = state === 'playing' ? Math.sin(frame * 0.25) * 2 : 0;
  const armSwing = state === 'playing' ? Math.sin(frame * 0.3) * 8 : 0;
  const blink = frame % 120 < 4;

  ctx.save();
  ctx.translate(0, bounce);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(36, 90, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2f3542';
  ctx.fillRect(26, 62, 8, 18);
  ctx.fillRect(38, 62, 8, 18);
  ctx.fillStyle = '#00a1d6';
  ctx.fillRect(24, 42, 24, 22);

  ctx.save();
  ctx.translate(24, 48);
  ctx.rotate(((-10 + armSwing) * Math.PI) / 180);
  ctx.fillStyle = '#00a1d6';
  ctx.fillRect(-6, 0, 6, 16);
  ctx.fillStyle = '#f4c99a';
  ctx.fillRect(-7, 14, 8, 8);
  ctx.restore();

  ctx.save();
  ctx.translate(48, 48);
  ctx.rotate(((10 - armSwing) * Math.PI) / 180);
  ctx.fillStyle = '#00a1d6';
  ctx.fillRect(0, 0, 6, 16);
  ctx.fillStyle = '#f4c99a';
  ctx.fillRect(-1, 14, 8, 8);
  ctx.restore();

  ctx.fillStyle = '#f4c99a';
  ctx.fillRect(22, 16, 28, 26);
  ctx.fillStyle = '#3d2b1f';
  ctx.fillRect(20, 12, 32, 10);
  ctx.fillRect(20, 12, 6, 18);
  ctx.fillRect(46, 12, 6, 18);
  ctx.fillStyle = '#f08a8a';
  ctx.fillRect(24, 30, 4, 3);
  ctx.fillRect(44, 30, 4, 3);
  ctx.fillStyle = '#1a1a1a';
  if (blink) {
    ctx.fillRect(28, 26, 6, 1);
    ctx.fillRect(38, 26, 6, 1);
  } else {
    ctx.fillRect(28, 24, 4, 4);
    ctx.fillRect(40, 24, 4, 4);
  }

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (state === 'playing') {
    ctx.arc(36, 34, 4, 0, Math.PI);
  } else if (state === 'paused') {
    ctx.moveTo(32, 34);
    ctx.lineTo(40, 34);
  } else {
    ctx.arc(36, 34, 3, 0.1 * Math.PI, 0.9 * Math.PI);
  }
  ctx.stroke();

  ctx.fillStyle = state === 'paused' ? '#fb7299' : '#00a1d6';
  ctx.beginPath();
  ctx.arc(58, 20, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  if (state === 'paused') {
    ctx.fillRect(55, 16, 2, 8);
    ctx.fillRect(59, 16, 2, 8);
  } else {
    ctx.beginPath();
    ctx.moveTo(56, 16);
    ctx.lineTo(56, 24);
    ctx.lineTo(63, 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export class StudentCompanion {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private readonly shell: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly stateHint: HTMLSpanElement;
  private readonly modeButton: HTMLButtonElement;
  private readonly bookbag: HTMLDivElement;
  private readonly courseList: HTMLDivElement;
  private readonly status: HTMLParagraphElement;
  private readonly codeInput: HTMLInputElement;
  private animationId = 0;
  private frame = 0;
  private state: CompanionPlaybackState = 'idle';
  private mode: VideoMode = 'course';
  private modeToggle: (() => void) | null = null;

  constructor(private readonly deps: StudentCompanionDeps) {
    this.host = document.createElement('div');
    this.host.id = 'knownmap-student-companion';
    this.root = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = deps.styleText;
    this.root.append(style);

    this.shell = document.createElement('div');
    this.shell.className = 'km-companion';
    this.shell.dataset.state = this.state;

    const controls = document.createElement('div');
    controls.className = 'km-companion-controls';

    const pause = this.control('暂停');
    pause.addEventListener('click', () => {
      void this.deps.onTogglePlayback().then((state) => this.setState(state));
    });

    this.modeButton = this.control('原视频');
    this.modeButton.disabled = true;
    this.modeButton.addEventListener('click', () => this.modeToggle?.());

    const bookbagButton = this.control('书包');
    bookbagButton.addEventListener('click', () => void this.openBookbag());
    controls.append(pause, this.modeButton, bookbagButton);

    const mascot = document.createElement('button');
    mascot.type = 'button';
    mascot.className = 'km-companion-mascot';
    mascot.setAttribute('aria-label', 'KnownMap 学习助手，点击控制视频播放');
    this.canvas = document.createElement('canvas');
    this.canvas.width = 72;
    this.canvas.height = 96;
    this.context = this.canvas.getContext('2d');
    this.stateHint = document.createElement('span');
    this.stateHint.className = 'km-companion-hint';
    mascot.append(this.canvas, this.stateHint);
    mascot.addEventListener('click', () => {
      void this.deps.onTogglePlayback().then((state) => this.setState(state));
    });

    this.bookbag = this.createBookbag();
    this.courseList = this.bookbag.querySelector('.km-companion-courses')!;
    this.status = this.bookbag.querySelector('.km-companion-status')!;
    this.codeInput = this.bookbag.querySelector<HTMLInputElement>('.km-companion-code')!;

    this.shell.append(controls, mascot);
    this.root.append(this.shell, this.bookbag);
    this.renderFrame();
  }

  mount(): void {
    if (!this.host.isConnected) (document.fullscreenElement ?? document.body).append(this.host);
  }

  setState(state: CompanionPlaybackState): void {
    this.state = state;
    this.shell.dataset.state = state;
    this.stateHint.textContent =
      state === 'playing' ? '点击暂停' : state === 'paused' ? '点击继续' : '等待视频…';
  }

  setMode(mode: VideoMode): void {
    this.mode = mode;
    this.modeButton.textContent = mode === 'original' ? '课程' : '原视频';
    this.modeButton.dataset.mode = mode;
  }

  createModeControl(onToggle: () => void): CompanionModeControl {
    this.modeToggle = onToggle;
    this.modeButton.disabled = false;
    return {
      setMode: (mode) => this.setMode(mode),
      destroy: () => {
        this.modeToggle = null;
        this.modeButton.disabled = true;
        this.setMode(this.mode);
      },
    };
  }

  destroy(): void {
    window.cancelAnimationFrame(this.animationId);
    this.host.remove();
  }

  private control(label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'km-companion-control';
    button.textContent = label;
    return button;
  }

  private createBookbag(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'km-companion-bookbag';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.innerHTML = `
      <header>
        <strong>KnownMap 书包</strong>
        <button type="button" class="km-companion-close" aria-label="关闭">×</button>
      </header>
      <div class="km-companion-courses"></div>
      <form class="km-companion-form">
        <label for="knownmap-companion-code">课程授权码</label>
        <input class="km-companion-code" id="knownmap-companion-code" autocomplete="off" spellcheck="false" placeholder="输入老师给的授权码">
        <button class="km-companion-submit" type="submit">领取课程</button>
      </form>
      <p class="km-companion-status" role="status"></p>
    `;
    panel.querySelector<HTMLButtonElement>('.km-companion-close')?.addEventListener(
      'click',
      () => {
        panel.hidden = true;
      }
    );
    panel.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.redeem();
    });
    return panel;
  }

  private async openBookbag(): Promise<void> {
    this.bookbag.hidden = false;
    await this.refreshLibrary();
    this.codeInput.focus();
  }

  private async refreshLibrary(): Promise<void> {
    const library = await this.deps.loadLibrary();
    if (!library) {
      this.status.textContent = '插件后台暂时不可用，请重新加载插件。';
      return;
    }
    const records = buildCompanionCourseRecords(library.courses);
    this.courseList.replaceChildren();
    if (records.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'km-companion-empty';
      empty.textContent = '还没有课程，输入授权码领取。';
      this.courseList.append(empty);
      return;
    }
    for (const record of records) this.courseList.append(this.renderRecord(record));
  }

  private renderRecord(record: CompanionCourseRecord): HTMLElement {
    const article = document.createElement('article');
    article.className = 'km-companion-record';
    const title = document.createElement('strong');
    title.textContent = record.label;
    const url = document.createElement('a');
    url.textContent = record.url;
    url.href = record.url;
    url.target = '_self';
    const open = document.createElement('a');
    open.textContent = '打开课程视频';
    open.href = record.url;
    open.target = '_self';
    article.append(title, url, open);
    return article;
  }

  private async redeem(): Promise<void> {
    const code = normalizeAccessCode(this.codeInput.value);
    if (!code) {
      this.status.textContent = '请输入授权码。';
      return;
    }
    const submit = this.bookbag.querySelector<HTMLButtonElement>('.km-companion-submit');
    if (submit) submit.disabled = true;
    this.status.textContent = '正在领取并校验课程…';
    try {
      const result = await this.deps.redeem(code);
      this.status.textContent = result.ok
        ? '课程已保存，可以开始学习。'
        : result.message ?? '课程领取失败，请稍后重试。';
      if (result.ok) {
        this.codeInput.value = '';
        await this.refreshLibrary();
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  private renderFrame(): void {
    this.frame += 1;
    if (this.context) drawMascot(this.context, this.state, this.frame);
    this.animationId = window.requestAnimationFrame(() => this.renderFrame());
  }
}
