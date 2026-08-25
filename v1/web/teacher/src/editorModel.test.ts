import { describe, expect, it } from 'vitest';
import {
  assignLanes,
  buildSegmentTicks,
  buildSegments,
  segmentForTime,
} from './editorModel';

describe('教师编辑器分段模型', () => {
  it('短课节保持一个时间段', () => {
    expect(buildSegments(240)).toEqual([
      { id: 'segment-1', index: 1, total: 1, startSeconds: 0, endSeconds: 240 },
    ]);
  });

  it('长视频按五分钟切分并保留最后不足五分钟的一段', () => {
    expect(buildSegments(725)).toEqual([
      { id: 'segment-1', index: 1, total: 3, startSeconds: 0, endSeconds: 300 },
      { id: 'segment-2', index: 2, total: 3, startSeconds: 300, endSeconds: 600 },
      { id: 'segment-3', index: 3, total: 3, startSeconds: 600, endSeconds: 725 },
    ]);
  });

  it('支持五分钟、十分钟和三十分钟的时间段长度', () => {
    expect(buildSegments(725, 600)).toEqual([
      { id: 'segment-1', index: 1, total: 2, startSeconds: 0, endSeconds: 600 },
      { id: 'segment-2', index: 2, total: 2, startSeconds: 600, endSeconds: 725 },
    ]);
    expect(buildSegments(725, 1800)).toEqual([
      { id: 'segment-1', index: 1, total: 1, startSeconds: 0, endSeconds: 725 },
    ]);
  });

  it('分段二的竖线从该分段起点开始并与节点使用相同百分比', () => {
    const segment = buildSegments(725, 300)[1];
    expect(buildSegmentTicks(segment, 60)).toEqual([
      { seconds: 300, percentage: 0 },
      { seconds: 360, percentage: 20 },
      { seconds: 420, percentage: 40 },
      { seconds: 480, percentage: 60 },
      { seconds: 540, percentage: 80 },
      { seconds: 600, percentage: 100 },
    ]);
  });

  it('时间点能落到对应分段，边界属于后一个分段', () => {
    const segments = buildSegments(725);
    expect(segmentForTime(0, segments)?.id).toBe('segment-1');
    expect(segmentForTime(300, segments)?.id).toBe('segment-2');
    expect(segmentForTime(725, segments)?.id).toBe('segment-3');
  });

  it('节点摘要上下交错，临近节点不会占用相同轨道', () => {
    expect(
      assignLanes([
        { id: 'a', timeSeconds: 10 },
        { id: 'b', timeSeconds: 11 },
        { id: 'c', timeSeconds: 12 },
      ])
    ).toEqual([
      { id: 'a', timeSeconds: 10, lane: 0 },
      { id: 'b', timeSeconds: 11, lane: 1 },
      { id: 'c', timeSeconds: 12, lane: 2 },
    ]);
  });
});
