import { describe, expect, it } from 'vitest';
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
      image: 'assets/companion/cat/v1/idle.png',
      audio: null,
    });
  });

  it('把未知状态回退到 idle，并保留完成提示和独立小鱼干', () => {
    expect(resolveCompanionState('not-a-state')).toBe('idle');
    expect(getCompanionStateAsset('complete')).toMatchObject({
      image: 'assets/companion/cat/v1/complete.png',
      audio: 'assets/companion/cat/v1/complete.wav',
      overlay: 'assets/companion/cat/v1/fish-treat.png',
      message: COMPANION_COMPLETE_MESSAGE,
    });
  });
});
