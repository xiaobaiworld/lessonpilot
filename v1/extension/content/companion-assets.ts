import packManifest from '../assets/companion/cat/v1/manifest.json';

export const COMPANION_PACK_ID = 'cat-v1' as const;
export const COMPANION_MASCOT_ID = 'cat' as const;
export const COMPANION_STATES = [
  'focus',
  'idle',
  'prompt',
  'correct',
  'wrong',
  'complete',
] as const;

export type CompanionVisualState = (typeof COMPANION_STATES)[number];
export const COMPANION_COMPLETE_MESSAGE = '感谢你让我又吃到了一条小鱼。';

export interface CompanionStateAsset {
  state: CompanionVisualState;
  image: string;
  audio: string | null;
  durationMs: number | null;
  overlay?: string;
  message?: string;
}

type PackState = {
  image: string;
  audio: string | null;
  durationMs: number | null;
  overlay?: string;
  message?: string;
};

const states = packManifest.states as Record<CompanionVisualState, PackState>;
const root = 'assets/companion/cat/v1/';

function assetPath(file: string): string {
  return `${root}${file}`;
}

export function resolveCompanionState(value: unknown): CompanionVisualState {
  return typeof value === 'string' && (COMPANION_STATES as readonly string[]).includes(value)
    ? (value as CompanionVisualState)
    : 'idle';
}

export function getCompanionStateAsset(value: unknown): CompanionStateAsset {
  const state = resolveCompanionState(value);
  const source = states[state] ?? states.idle;
  return {
    state,
    image: assetPath(source.image),
    audio: source.audio ? assetPath(source.audio) : null,
    durationMs: source.durationMs,
    ...(source.overlay ? { overlay: assetPath(packManifest.overlays[source.overlay as 'fishTreat'].image) } : {}),
    ...(source.message ? { message: source.message } : {}),
  };
}

export function getCompanionOverlayPath(name: 'fishTreat'): string {
  return assetPath(packManifest.overlays[name].image);
}
