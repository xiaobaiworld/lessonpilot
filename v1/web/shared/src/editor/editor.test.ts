import { describe, it, expect } from 'vitest';
import { TimelineModel } from './TimelineModel';
import { NodeRegistry, InteractionNode } from './NodeRegistry';
import { parseSubtitle, toSeconds, formatTimestamp, captionAt } from './SubtitleParser';

describe('TimelineModel', () => {
  const timeline = new TimelineModel({
    durationSeconds: 513,
    pixelsPerSecond: 2,
    tickIntervalSeconds: 60,
  });

  it('秒数映射到像素位置', () => {
    expect(timeline.getPixelPosition(256.5)).toBe(513);
  });

  it('像素位置可反查秒数', () => {
    expect(timeline.getSecondsFromPixel(513)).toBeCloseTo(256.5);
  });

  it('刻度从 0 开始且不越过总时长', () => {
    const ticks = timeline.getTicks();
    expect(ticks[0].seconds).toBe(0);
    expect(ticks[ticks.length - 1].seconds).toBeLessThanOrEqual(513);
  });
});

describe('NodeRegistry', () => {
  const registry = new NodeRegistry();

  it('四种节点类型齐备', () => {
    expect(registry.getAllTypes()).toHaveLength(4);
  });

  it('拒绝缺选项的选择题', () => {
    const node: InteractionNode = {
      id: 'x',
      type: 'question',
      startTime: 10,
      content: { text: '问题', options: [] },
    };
    expect(registry.validateNode(node).valid).toBe(false);
  });

  it('拒绝负时刻', () => {
    const node: InteractionNode = {
      id: 'x',
      type: 'remark',
      startTime: -1,
      content: { text: '重点' },
    };
    expect(registry.validateNode(node).valid).toBe(false);
  });
});

describe('字幕时间戳', () => {
  it('小数部分按字面毫秒读，不补零', () => {
    // 关键：",6" 是 6ms，不是 600ms。同一份文件里这段宽度会变，
    // 补零会让字幕越过后一条并被丢弃。
    expect(toSeconds('00:00:01,6')).toBeCloseTo(1.006);
    expect(toSeconds('00:00:01,600')).toBeCloseTo(1.6);
    expect(toSeconds('00:00:01,60')).toBeCloseTo(1.06);
  });

  it('小时位可省略', () => {
    expect(toSeconds('01:30,000')).toBeCloseTo(90);
    expect(toSeconds('00:01:30,000')).toBeCloseTo(90);
  });

  it('VTT 用点号也接受', () => {
    expect(toSeconds('00:00:02.500')).toBeCloseTo(2.5);
  });

  it('拒绝越界的分秒', () => {
    expect(toSeconds('00:60:00,000')).toBeNull();
    expect(toSeconds('00:00:60,000')).toBeNull();
    expect(toSeconds('乱码')).toBeNull();
  });

  it('超过一小时才显示小时位', () => {
    expect(formatTimestamp(90)).toBe('01:30');
    expect(formatTimestamp(3661)).toBe('01:01:01');
  });
});

describe('parseSubtitle', () => {
  const srt = `1
00:00:01,000 --> 00:00:03,000
第一条字幕

2
00:00:05,000 --> 00:00:07,000
第二条<i>带标签</i>
跨两行`;

  it('解析 SRT，合并多行并去掉标签', () => {
    const r = parseSubtitle(srt, 'a.srt');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.captions).toHaveLength(2);
    expect(r.captions[0].text).toBe('第一条字幕');
    expect(r.captions[1].text).toBe('第二条带标签 跨两行');
  });

  it('容忍 BOM 与 CRLF', () => {
    const r = parseSubtitle('﻿' + srt.replace(/\n/g, '\r\n'), 'a.srt');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.captions).toHaveLength(2);
  });

  it('忽略 VTT 结束时刻后的 cue settings', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000 align:start position:50%
一句话`;
    const r = parseSubtitle(vtt, 'a.vtt');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.captions[0].endSeconds).toBeCloseTo(3);
  });

  it('丢弃结束不晚于开始的条目', () => {
    const bad = `1
00:00:03,000 --> 00:00:03,000
零长度`;
    expect(parseSubtitle(bad, 'a.srt').ok).toBe(false);
  });

  it('扩展名不对时直接拒绝，不去猜内容', () => {
    const r = parseSubtitle(srt, 'a.txt');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('.srt');
  });

  it('无有效字幕时给出可操作的提示', () => {
    const r = parseSubtitle('随便一段文字', 'a.srt');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('时间戳');
  });

  it('按时刻定位字幕', () => {
    const r = parseSubtitle(srt, 'a.srt');
    if (!r.ok) throw new Error('解析失败');
    expect(captionAt(r.captions, 2)?.text).toBe('第一条字幕');
    expect(captionAt(r.captions, 4)).toBeUndefined();
  });
});
