import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COMPANION_COMPLETE_MESSAGE,
  COMPANION_STATES,
  getCompanionStateAsset,
  resolveCompanionState,
} from './companion-assets';

describe('第一版小猫角色资源包', () => {
  it('包含六个状态，并为 idle 保持静音', () => {
    expect(COMPANION_STATES).toEqual([
      'focus',
      'idle',
      'prompt',
      'correct',
      'wrong',
      'complete',
    ]);
    expect(getCompanionStateAsset('idle')).toMatchObject({
      image: 'assets/companion/cat/v1/idle.webp',
      audio: null,
    });
  });

  it('把未知状态回退到 idle，并保留完成提示和独立小鱼干', () => {
    expect(resolveCompanionState('not-a-state')).toBe('idle');
    expect(getCompanionStateAsset('complete')).toMatchObject({
      image: 'assets/companion/cat/v1/complete.webp',
      audio: 'assets/companion/cat/v1/complete.ogg',
      overlay: 'assets/companion/cat/v1/fish-treat.webp',
      message: COMPANION_COMPLETE_MESSAGE,
    });
  });

  it('运行时只保留压缩后的 WebP 和 Ogg 角色资源', () => {
    const directory = resolve(__dirname, '../assets/companion/cat/v1');
    const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8')) as {
      states: Record<string, { image: string; audio: string | null }>;
      overlays: Record<string, { image: string }>;
    };
    const files = readdirSync(directory);

    for (const state of Object.values(manifest.states)) {
      expect(state.image).toMatch(/\.webp$/);
      expect(existsSync(resolve(directory, state.image))).toBe(true);
      if (state.audio) {
        expect(state.audio).toMatch(/\.ogg$/);
        expect(existsSync(resolve(directory, state.audio))).toBe(true);
      }
    }
    for (const overlay of Object.values(manifest.overlays)) {
      expect(overlay.image).toMatch(/\.webp$/);
      expect(existsSync(resolve(directory, overlay.image))).toBe(true);
    }
    expect(files.some((file) => /\.(png|wav)$/.test(file))).toBe(false);
  });
});
