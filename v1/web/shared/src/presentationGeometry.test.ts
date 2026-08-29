import { describe, expect, it } from 'vitest';
import { resolvePresentationGeometry } from './presentationGeometry';

describe('互动窗口几何计算', () => {
  it('按视口百分比计算中心点矩形', () => {
    expect(resolvePresentationGeometry(
      {
        size: { widthPercent: 40, heightPercent: 30 },
        position: { xPercent: 50, yPercent: 50 },
        style: 'document',
      },
      { width: 1000, height: 800 },
    )).toEqual({ left: 300, top: 280, width: 400, height: 240 });
  });

  it('尺寸和位置会被安全边界限制', () => {
    expect(resolvePresentationGeometry(
      {
        size: { widthPercent: 66, heightPercent: 66 },
        position: { xPercent: 0, yPercent: 100 },
        style: 'card',
      },
      { width: 320, height: 240 },
    )).toEqual({ left: 16, top: 66, width: 211, height: 158 });
  });
});
