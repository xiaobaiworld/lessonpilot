import {
  COMPANION_PACK_ID,
  COMPANION_STATES,
  type CompanionVisualState,
} from '../content/companion-assets';

type StateAsset = {
  image: string;
  audio: string | null;
  durationMs: number | null;
};
type Reply<T> = { ok: true; data: T } | { ok: false; message?: string };

const root = document;
const assets = new Map<CompanionVisualState, StateAsset>();
let previewAudio: HTMLAudioElement | null = null;
let soundEnabled = true;

async function ask<T>(message: unknown): Promise<Reply<T>> {
  try {
    const reply = await chrome.runtime.sendMessage(message);
    if (!reply || typeof reply !== 'object') {
      return { ok: false, message: '扩展需要重新加载，请在扩展页面点刷新。' };
    }
    return (reply as any).ok
      ? { ok: true, data: (reply as any).data as T }
      : { ok: false, message: (reply as any).message ?? '角色资源读取失败。' };
  } catch {
    return { ok: false, message: '扩展未响应，请重新加载扩展。' };
  }
}

function showError(message: string): void {
  const error = root.querySelector<HTMLElement>('#error');
  if (!error) return;
  error.textContent = message;
  error.hidden = false;
}

async function loadAsset(state: CompanionVisualState): Promise<StateAsset | null> {
  const cached = assets.get(state);
  if (cached) return cached;
  const reply = await ask<StateAsset>({ type: 'companionAsset', packId: COMPANION_PACK_ID, state });
  if (!reply.ok) {
    showError(reply.message ?? '角色资源读取失败。');
    return null;
  }
  assets.set(state, reply.data);
  return reply.data;
}

function stopPreviewAudio(): void {
  if (!previewAudio) return;
  previewAudio.pause();
  previewAudio.currentTime = 0;
  previewAudio = null;
}

function playPreviewAudio(url: string): void {
  stopPreviewAudio();
  const audio = new Audio(url);
  previewAudio = audio;
  audio.addEventListener('ended', () => {
    if (previewAudio === audio) previewAudio = null;
  });
  void audio.play().catch(() => showError('声音暂时无法试听。'));
}

function bindStateImage(state: CompanionVisualState, asset: StateAsset, idleImage: string): void {
  const preview = root.querySelector<HTMLImageElement>('#selected-avatar');
  const thumb = root.querySelector<HTMLElement>(`[data-state-preview="${state}"]`);
  const image = thumb?.querySelector<HTMLImageElement>('img');
  if (image) image.src = asset.image;
  if (!thumb || !preview) return;
  thumb.addEventListener('mouseenter', () => { preview.src = asset.image; });
  thumb.addEventListener('focus', () => { preview.src = asset.image; });
  thumb.addEventListener('mouseleave', () => { preview.src = idleImage; });
  thumb.addEventListener('blur', () => { preview.src = idleImage; });
}

function syncSoundSwitch(): void {
  const button = root.querySelector<HTMLButtonElement>('#sound-switch');
  if (!button) return;
  button.classList.toggle('active', soundEnabled);
  button.textContent = soundEnabled ? '学习时播放声音' : '学习时静音';
}

function bindPreviewButtons(): void {
  root.querySelectorAll<HTMLButtonElement>('[data-audio-preview]').forEach((button) => {
    const state = button.dataset.audioPreview as CompanionVisualState;
    const asset = assets.get(state);
    if (!asset?.audio) {
      button.disabled = true;
      return;
    }
    button.addEventListener('click', () => playPreviewAudio(asset.audio!));
  });
}

async function init(): Promise<void> {
  const version = root.querySelector<HTMLElement>('#version');
  if (version) version.textContent = `v${chrome.runtime.getManifest().version}`;
  root.querySelector('#back-button')?.addEventListener('click', () => window.close());
  root.querySelector('#close-button')?.addEventListener('click', () => window.close());

  const [loaded, soundReply] = await Promise.all([
    Promise.all(COMPANION_STATES.map(async (state) => ({ state, asset: await loadAsset(state) }))),
    ask<{ soundEnabled: boolean }>({ type: 'companionSound' }),
  ]);
  if (soundReply.ok) soundEnabled = soundReply.data.soundEnabled;

  const idle = assets.get('idle');
  if (idle) {
    const selected = root.querySelector<HTMLImageElement>('#selected-avatar');
    const category = root.querySelector<HTMLImageElement>('#category-avatar');
    if (selected) selected.src = idle.image;
    if (category) category.src = idle.image;
    loaded.forEach(({ state, asset }) => {
      if (asset) bindStateImage(state, asset, idle.image);
    });
  }
  bindPreviewButtons();
  syncSoundSwitch();
  root.querySelector<HTMLButtonElement>('#sound-switch')?.addEventListener('click', async () => {
    const reply = await ask<{ soundEnabled: boolean }>({ type: 'setCompanionSound', enabled: !soundEnabled });
    if (!reply.ok) {
      showError(reply.message ?? '声音设置保存失败。');
      return;
    }
    soundEnabled = reply.data.soundEnabled;
    syncSoundSwitch();
  });
}

void init();
