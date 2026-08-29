/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudentCompanion } from './companion';
import type { CompanionStateAsset, CompanionVisualState } from './companion-assets';

const asset = (state: CompanionVisualState): CompanionStateAsset => ({
  state,
  image: `chrome-extension://${state}.png`,
  audio: state === 'idle' ? null : `chrome-extension://${state}.wav`,
  durationMs: state === 'complete' ? 1000 : null,
  ...(state === 'complete'
    ? {
        overlay: 'chrome-extension://fish.png',
        message: '感谢你让我又吃到了一条小鱼。',
      }
    : {}),
});

afterEach(() => {
  document.querySelector('#knownmap-student-companion')?.remove();
  vi.unstubAllGlobals();
});

describe('StudentCompanion 角色资源渲染', () => {
  it('按状态显示图片、声音以及完成态小鱼和提示语', async () => {
    const played: string[] = [];
    class FakeAudio {
      src: string;
      preload = '';
      constructor(src: string) {
        this.src = src;
      }
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
      pause() {}
    }
    vi.stubGlobal('Audio', FakeAudio);

    const companion = new StudentCompanion({
      styleText: '',
      loadLibrary: async () => null,
      redeem: async () => ({ ok: true }),
      loadAsset: async (state) => asset(state),
      onTogglePlayback: async () => 'idle',
    });
    companion.mount();
    await Promise.resolve();
    companion.setVisualState('complete', 'node-1');
    await Promise.resolve();

    const shadow = document.querySelector('#knownmap-student-companion')?.shadowRoot;
    expect(shadow?.querySelector<HTMLImageElement>('.km-companion-image')?.src).toContain(
      'complete.png'
    );
    expect(shadow?.querySelector<HTMLImageElement>('.km-companion-fish')?.hidden).toBe(false);
    expect(shadow?.querySelector('.km-companion-message')?.textContent).toBe(
      '感谢你让我又吃到了一条小鱼。'
    );
    expect(played).toEqual(['chrome-extension://complete.wav']);

    companion.setVisualState('complete', 'node-1');
    await Promise.resolve();
    expect(played).toHaveLength(1);
    companion.destroy();
  });

  it('声音关闭后保留视觉状态，资源加载失败回退 idle', async () => {
    const played: string[] = [];
    class FakeAudio {
      src: string;
      constructor(src: string) {
        this.src = src;
      }
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
      pause() {}
    }
    vi.stubGlobal('Audio', FakeAudio);
    const loadAsset = vi.fn(async (state: CompanionVisualState) =>
      state === 'wrong' ? null : asset(state)
    );
    const companion = new StudentCompanion({
      styleText: '',
      loadLibrary: async () => null,
      redeem: async () => ({ ok: true }),
      loadAsset,
      onTogglePlayback: async () => 'idle',
    });
    companion.mount();
    await Promise.resolve();
    const shadow = document.querySelector('#knownmap-student-companion')?.shadowRoot;
    await (shadow?.querySelector<HTMLButtonElement>('.km-companion-control:nth-child(3)')?.click(), Promise.resolve());
    companion.setVisualState('wrong', 'node-2');
    await Promise.resolve();

    expect(loadAsset).toHaveBeenCalledWith('idle');
    expect(shadow?.querySelector<HTMLImageElement>('.km-companion-image')?.src).toContain(
      'idle.png'
    );
    expect(played).toHaveLength(0);
    companion.destroy();
  });
});
