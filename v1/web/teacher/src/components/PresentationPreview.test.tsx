import { describe, expect, it } from 'vitest';
import {
  adjustPositionByKey,
  positionFromPointerDelta,
} from './PresentationPreview';

describe('互动窗口预览位置控制', () => {
  it('把拖动位移转换为百分比并限制在安全位置', () => {
    expect(positionFromPointerDelta(
      { xPercent: 50, yPercent: 50 },
      { x: 250, y: -100 },
      { width: 1000, height: 800 },
    )).toEqual({ xPercent: 75, yPercent: 37.5 });

    expect(positionFromPointerDelta(
      { xPercent: 50, yPercent: 50 },
      { x: -900, y: 900 },
      { width: 1000, height: 800 },
    )).toEqual({ xPercent: 0, yPercent: 100 });
  });

  it('方向键每次微调半个百分点', () => {
    expect(adjustPositionByKey({ xPercent: 50, yPercent: 50 }, 'ArrowRight')).toEqual({
      xPercent: 50.5,
      yPercent: 50,
    });
    expect(adjustPositionByKey({ xPercent: 0, yPercent: 100 }, 'ArrowLeft')).toEqual({
      xPercent: 0,
      yPercent: 100,
    });
  });
});
