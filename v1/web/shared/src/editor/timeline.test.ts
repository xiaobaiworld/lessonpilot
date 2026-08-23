import { describe, it, expect } from 'vitest';
import { TimelineModel } from './TimelineModel';

/**
 * 时间轴几何。
 *
 * 教师端用百分比布局，所以真正要保证的是"秒 → 百分比"和它的反向一致，
 * 以及刻度不越过总时长——越过会让末端刻度指向不存在的位置
 * （doc/lessons.md 2026-08-20 记过这个坑）。
 */
describe('TimelineModel 百分比定位', () => {
  const model = (durationSeconds: number, tick = 60) =>
    new TimelineModel({ durationSeconds, pixelsPerSecond: 1, tickIntervalSeconds: tick });

  it('两端与中点落在 0 / 50 / 100', () => {
    const m = model(512);
    expect(m.getPercentagePosition(0)).toBe(0);
    expect(m.getPercentagePosition(256)).toBeCloseTo(50);
    expect(m.getPercentagePosition(512)).toBe(100);
  });

  it('四分之一处与实际秒数对应', () => {
    // 界面上点 25% 应该落在 128 秒，这条对不上老师就会放错节点
    expect(model(512).getPercentagePosition(128)).toBeCloseTo(25);
  });

  it('刻度从 0 开始且不越过总时长', () => {
    for (const duration of [90, 512, 3600]) {
      const ticks = model(duration).getTicks();
      expect(ticks[0].seconds).toBe(0);
      expect(ticks[ticks.length - 1].seconds).toBeLessThanOrEqual(duration);
    }
  });

  it('刻度百分比与秒数自洽', () => {
    for (const tick of model(512).getTicks()) {
      expect(tick.percentage).toBeCloseTo((tick.seconds / 512) * 100);
    }
  });

  it('不能整除时最后一个刻度仍在范围内', () => {
    // 512 秒按 60 秒一格，最后一格是 480，不该出现 540
    const ticks = model(512, 60).getTicks();
    expect(ticks.map((t) => t.seconds)).not.toContain(540);
    expect(ticks[ticks.length - 1].seconds).toBe(480);
  });

  it('时长为 0 时不产生越界刻度', () => {
    expect(model(0).getTicks().map((t) => t.seconds)).toEqual([0]);
  });
});
