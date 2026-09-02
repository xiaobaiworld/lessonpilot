import { LibraryView } from '../shared/library-view';
import { VideoMode } from './runtime';
import {
  buildCompanionCourseRecords,
  CompanionCourseRecord,
  normalizeAccessCode,
} from './companion-model';
import type { CompanionStateAsset, CompanionVisualState } from './companion-assets';

export type CompanionPlaybackState = 'idle' | 'playing' | 'paused';

export interface StudentCompanionDeps {
  styleText: string;
  loadLibrary(): Promise<LibraryView | null>;
  redeem(code: string): Promise<{ ok: boolean; message?: string }>;
  loadAsset(state: CompanionVisualState): Promise<CompanionStateAsset | null>;
  loadSoundEnabled?(): Promise<boolean | null>;
  saveSoundEnabled?(enabled: boolean): Promise<void>;
  onTogglePlayback(): Promise<CompanionPlaybackState>;
}

export interface CompanionModeControl {
  setMode(mode: VideoMode): void;
  destroy(): void;
}

const VISUAL_HINTS: Record<CompanionVisualState, string> = {
  focus: '准备开始学习',
  idle: '等待视频…',
  prompt: '有新的提示',
  correct: '答对了',
  wrong: '再想想',
  complete: '完成啦',
};

export class StudentCompanion {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private readonly shell: HTMLDivElement;
  private readonly image: HTMLImageElement;
  private readonly fish: HTMLImageElement;
  private readonly message: HTMLParagraphElement;
  private readonly stateHint: HTMLSpanElement;
  private readonly modeButton: HTMLButtonElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly bookbag: HTMLDivElement;
  private readonly courseList: HTMLDivElement;
  private readonly status: HTMLParagraphElement;
  private readonly codeInput: HTMLInputElement;
  private playbackState: CompanionPlaybackState = 'idle';
  private visualState: CompanionVisualState = 'idle';
  private visualEventKey: string | undefined;
  private loadGeneration = 0;
  private mode: VideoMode = 'course';
  private modeToggle: (() => void) | null = null;
  private soundEnabled = true;
  private soundPreferenceTouched = false;
  private audio: HTMLAudioElement | null = null;
  private completeTimer = 0;

  constructor(private readonly deps: StudentCompanionDeps) {
    this.host = document.createElement('div');
    this.host.id = 'knownmap-student-companion';
    this.root = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = deps.styleText;
    this.root.append(style);

    this.shell = document.createElement('div');
    this.shell.className = 'km-companion';
    this.shell.dataset.state = this.playbackState;
    this.shell.dataset.visualState = this.visualState;

    const controls = document.createElement('div');
    controls.className = 'km-companion-controls';

    const pause = this.control('暂停');
    pause.addEventListener('click', () => {
      void this.deps.onTogglePlayback().then((state) => this.setState(state));
    });

    this.modeButton = this.control('原视频');
    this.modeButton.disabled = true;
    this.modeButton.addEventListener('click', () => this.modeToggle?.());

    this.soundButton = this.control('声音开');
    this.soundButton.setAttribute('aria-pressed', 'true');
    this.soundButton.addEventListener('click', () => void this.toggleSound());

    const bookbagButton = this.control('书包');
    bookbagButton.addEventListener('click', () => void this.openBookbag());
    controls.append(pause, this.modeButton, this.soundButton, bookbagButton);

    const mascot = document.createElement('button');
    mascot.type = 'button';
    mascot.className = 'km-companion-mascot';
    mascot.setAttribute('aria-label', 'KnownMap 学习助手，点击控制视频播放');
    this.image = document.createElement('img');
    this.image.className = 'km-companion-image';
    this.image.alt = 'KnownMap 学习助手';
    this.fish = document.createElement('img');
    this.fish.className = 'km-companion-fish';
    this.fish.alt = '';
    this.fish.hidden = true;
    this.message = document.createElement('p');
    this.message.className = 'km-companion-message';
    this.message.hidden = true;
    this.stateHint = document.createElement('span');
    this.stateHint.className = 'km-companion-hint';
    mascot.append(this.image, this.fish, this.message, this.stateHint);
    mascot.addEventListener('click', () => {
      void this.deps.onTogglePlayback().then((state) => this.setState(state));
    });

    this.bookbag = this.createBookbag();
    this.courseList = this.bookbag.querySelector('.km-companion-courses')!;
    this.status = this.bookbag.querySelector('.km-companion-status')!;
    this.codeInput = this.bookbag.querySelector<HTMLInputElement>('.km-companion-code')!;

    this.shell.append(controls, mascot);
    this.root.append(this.shell, this.bookbag);
    void this.loadSoundPreference();
    void this.applyVisualState('idle');
  }

  mount(): void {
    if (!this.host.isConnected) (document.fullscreenElement ?? document.body).append(this.host);
  }

  hide(): void {
    this.bookbag.hidden = true;
    this.host.remove();
  }

  /** 视频播放状态与角色表现状态分开，保留旧调用方的播放控制 API。 */
  setState(state: CompanionPlaybackState): void {
    this.playbackState = state;
    this.shell.dataset.state = state;
    if (state === 'playing') this.stateHint.textContent = '点击暂停';
    else if (this.visualState === 'idle') this.stateHint.textContent = '等待视频…';
  }

  setVisualState(state: CompanionVisualState, eventKey?: string): void {
    if (state === this.visualState && eventKey === this.visualEventKey) return;
    this.visualState = state;
    this.visualEventKey = eventKey;
    this.shell.dataset.visualState = state;
    this.stateHint.textContent = VISUAL_HINTS[state];
    void this.applyVisualState(state);
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
    this.loadGeneration++;
    window.clearTimeout(this.completeTimer);
    this.stopAudio();
    this.host.remove();
  }

  private control(label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'km-companion-control';
    button.textContent = label;
    return button;
  }

  private async loadSoundPreference(): Promise<void> {
    try {
      const enabled = await this.deps.loadSoundEnabled?.();
      if (typeof enabled === 'boolean' && !this.soundPreferenceTouched) {
        this.setSoundEnabled(enabled);
      }
    } catch {
      // 偏好读取失败时保留默认开启，不影响学习。
    }
  }

  private async toggleSound(): Promise<void> {
    this.soundPreferenceTouched = true;
    this.setSoundEnabled(!this.soundEnabled);
    try {
      await this.deps.saveSoundEnabled?.(this.soundEnabled);
    } catch {
      // 声音偏好保存失败只影响本次页面，不影响角色状态。
    }
    if (!this.soundEnabled) this.stopAudio();
  }

  private setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.soundButton.textContent = enabled ? '声音开' : '声音关';
    this.soundButton.setAttribute('aria-pressed', String(enabled));
  }

  private async applyVisualState(state: CompanionVisualState): Promise<void> {
    const generation = ++this.loadGeneration;
    window.clearTimeout(this.completeTimer);
    this.message.hidden = true;
    this.fish.hidden = true;
    this.stopAudio();

    let asset: CompanionStateAsset | null = null;
    try {
      asset = await this.deps.loadAsset(state);
    } catch {
      asset = null;
    }
    if (generation !== this.loadGeneration) return;

    if (!asset && state !== 'idle') {
      try {
        asset = await this.deps.loadAsset('idle');
      } catch {
        asset = null;
      }
    }
    if (generation !== this.loadGeneration || !asset) return;

    this.image.src = asset.image;
    this.image.hidden = false;
    if (state === 'complete' && asset.overlay) {
      this.fish.src = asset.overlay;
      this.fish.hidden = false;
      if (asset.message) {
        this.message.textContent = asset.message;
        this.message.hidden = false;
      }
      this.completeTimer = window.setTimeout(() => {
        if (generation === this.loadGeneration && this.visualState === 'complete') {
          this.setVisualState('idle');
        }
      }, asset.durationMs ?? 1600);
    }
    if (this.soundEnabled && asset.audio) this.playAudio(asset.audio);
  }

  private playAudio(src: string): void {
    if (typeof Audio === 'undefined') return;
    const audio = new Audio(src);
    audio.preload = 'auto';
    this.audio = audio;
    const result = audio.play();
    if (result && typeof result.catch === 'function') result.catch(() => undefined);
  }

  private stopAudio(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.src = '';
    this.audio = null;
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
}
