/**
 * 编辑器领域模块测试
 */

import { describe, it, expect } from 'vitest';
import { TimelineModel } from './TimelineModel';
import { NodeRegistry, InteractionNode } from './NodeRegistry';
import { SubtitleParser } from './SubtitleParser';

describe('TimelineModel', () => {
  const config = { durationSeconds: 513, pixelsPerSecond: 2, tickIntervalSeconds: 60 };
  const timeline = new TimelineModel(config);

  it('应该计算像素位置', () => {
    // 256.5 秒时的位置应该是中点附近
    const pixel = timeline.getPixelPosition(256.5);
    expect(pixel).toBe(513); // 256.5 * 2
  });

  it('应该格式化时间', () => {
    expect(timeline.formatTime(127)).toBe('02:07');
    expect(timeline.formatTime(3661)).toBe('61:01');
  });

  it('应该生成刻度', () => {
    const ticks = timeline.getTicks();
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0].seconds).toBe(0);
  });
});

describe('NodeRegistry', () => {
  const registry = new NodeRegistry();

  it('应该返回所有节点类型', () => {
    const types = registry.getAllTypes();
    expect(types.length).toBe(4);
    expect(types.map((t) => t.type)).toContain('remark');
  });

  it('应该验证节点', () => {
    const node: InteractionNode = {
      id: 'test',
      type: 'remark',
      startTime: 10,
      content: { text: '重点内容' },
    };

    const result = registry.validateNode(node);
    expect(result.valid).toBe(true);
  });

  it('应该拒绝无效节点', () => {
    const node: InteractionNode = {
      id: 'test',
      type: 'question',
      startTime: 10,
      content: { text: '问题', options: [] }, // 空选项
    };

    const result = registry.validateNode(node);
    expect(result.valid).toBe(false);
  });
});

describe('SubtitleParser', () => {
  const parser = new SubtitleParser();

  const srtContent = `1
00:00:01,000 --> 00:00:03,000
第一条字幕

2
00:00:05,000 --> 00:00:07,000
第二条字幕`;

  it('应该解析 SRT 字幕', () => {
    const subs = parser.parseSRT(srtContent);
    expect(subs.length).toBe(2);
    expect(subs[0].text).toBe('第一条字幕');
    expect(subs[0].startTime).toBe(1);
  });

  it('应该获取给定时间的字幕', () => {
    const subs = parser.parseSRT(srtContent);
    const sub = parser.getSubtitleAtTime(subs, 2);
    expect(sub?.text).toBe('第一条字幕');
  });
});
