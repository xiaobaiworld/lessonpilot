import {
  COMPANION_PACK_ID,
  COMPANION_STATES,
  type CompanionVisualState,
} from '../content/companion-assets';

type StateAsset = { image: string };
type Reply<T> = { ok: true; data: T } | { ok: false; message?: string };

const root = document;
const assets = new Map<CompanionVisualState, StateAsset>();

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

function bindStateImage(state: CompanionVisualState, asset: StateAsset): void {
  const preview = root.querySelector<HTMLImageElement>('#selected-avatar');
  if (state === 'idle' && preview) preview.src = asset.image;

  const thumb = root.querySelector<HTMLElement>(`[data-state-preview="${state}"]`);
  const images = thumb?.querySelectorAll<HTMLImageElement>('img');
  images?.forEach((image) => { image.src = asset.image; });
}

async function init(): Promise<void> {
  const version = root.querySelector<HTMLElement>('#version');
  if (version) version.textContent = `v${chrome.runtime.getManifest().version}`;

  const loaded = await Promise.all(
    COMPANION_STATES.map(async (state) => ({ state, asset: await loadAsset(state) })),
  );
  loaded.forEach(({ state, asset }) => {
    if (asset) bindStateImage(state, asset);
  });
}

void init();
