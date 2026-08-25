import { Caption } from '@v1/web/shared';

export interface TimelineSegment {
  id: string;
  index: number;
  total: number;
  startSeconds: number;
  endSeconds: number;
}

export interface LaneNode {
  id: string;
  timeSeconds: number;
}

export interface LaneNodeResult extends LaneNode {
  lane: number;
}

export interface TimelineTick {
  seconds: number;
  percentage: number;
}

export const SEGMENT_LENGTH_OPTIONS = [
  { label: '5 分钟', seconds: 300 },
  { label: '10 分钟', seconds: 600 },
  { label: '30 分钟', seconds: 1800 },
] as const;

const DEFAULT_SEGMENT_SECONDS = SEGMENT_LENGTH_OPTIONS[0].seconds;

/** 长课节使用稳定的五分钟时间窗，短课节保持一个时间段。 */
export function buildSegments(
  durationSeconds: number,
  segmentSeconds: number = DEFAULT_SEGMENT_SECONDS
): TimelineSegment[] {
  const duration = Math.max(0, Math.ceil(durationSeconds));
  if (duration === 0) {
    return [{ id: 'segment-1', index: 1, total: 1, startSeconds: 0, endSeconds: 0 }];
  }

  const safeSegmentSeconds = Math.max(1, Math.ceil(segmentSeconds));
  const count = Math.max(1, Math.ceil(duration / safeSegmentSeconds));
  return Array.from({ length: count }, (_, index) => {
    const startSeconds = index * safeSegmentSeconds;
    return {
      id: `segment-${index + 1}`,
      index: index + 1,
      total: count,
      startSeconds,
      endSeconds: Math.min(duration, startSeconds + safeSegmentSeconds),
    };
  });
}

export function timelineTickInterval(segmentDurationSeconds: number): number {
  if (segmentDurationSeconds <= 180) return 30;
  if (segmentDurationSeconds <= 600) return 60;
  if (segmentDurationSeconds <= 1800) return 300;
  return 600;
}

/** 刻度、竖线和节点使用同一个时间坐标系，避免分段后视觉位置漂移。 */
export function buildSegmentTicks(
  segment: TimelineSegment,
  tickIntervalSeconds = timelineTickInterval(segment.endSeconds - segment.startSeconds)
): TimelineTick[] {
  const duration = Math.max(0, segment.endSeconds - segment.startSeconds);
  if (duration === 0) return [{ seconds: segment.startSeconds, percentage: 0 }];

  const interval = Math.max(1, Math.ceil(tickIntervalSeconds));
  const seconds = new Set<number>([segment.startSeconds, segment.endSeconds]);
  for (
    let value = Math.ceil(segment.startSeconds / interval) * interval;
    value < segment.endSeconds;
    value += interval
  ) {
    seconds.add(value);
  }

  return [...seconds]
    .sort((a, b) => a - b)
    .map((value) => ({
      seconds: value,
      percentage: ((value - segment.startSeconds) / duration) * 100,
    }));
}

export function segmentForTime(
  seconds: number,
  segments: TimelineSegment[]
): TimelineSegment | undefined {
  if (segments.length === 0) return undefined;
  const safeSeconds = Math.max(0, seconds);
  return (
    segments.find(
      (segment) =>
        safeSeconds >= segment.startSeconds &&
        (safeSeconds < segment.endSeconds || segment === segments[segments.length - 1])
    ) ?? segments[segments.length - 1]
  );
}

/** 选取节点附近字幕；中心字幕优先使用节点已有 captionId。 */
export function captionsAround(
  captions: Caption[],
  seconds: number,
  captionId?: string | null,
  radius = 2
): Caption[] {
  if (captions.length === 0) return [];
  const centerIndex = captionId
    ? captions.findIndex((caption) => caption.id === captionId)
    : -1;
  const nearestIndex =
    centerIndex >= 0
      ? centerIndex
      : captions.reduce(
          (best, caption, index) =>
            Math.abs(caption.startSeconds - seconds) <
            Math.abs(captions[best].startSeconds - seconds)
              ? index
              : best,
          0
        );
  return captions.slice(Math.max(0, nearestIndex - radius), nearestIndex + radius + 1);
}

/**
 * 摘要卡片按最近时间顺序分配轨道。四条轨道足够覆盖常见密集节点，
 * 超过四条时继续在最少冲突的轨道上循环。
 */
export function assignLanes(nodes: LaneNode[]): LaneNodeResult[] {
  const lastTimes: number[] = [];
  return [...nodes]
    .sort((a, b) => a.timeSeconds - b.timeSeconds || a.id.localeCompare(b.id))
    .map((node) => {
      let lane = 0;
      for (let candidate = 0; candidate < Math.max(4, lastTimes.length + 1); candidate++) {
        if (
          lastTimes[candidate] === undefined ||
          Math.abs(lastTimes[candidate] - node.timeSeconds) >= 35
        ) {
          lane = candidate;
          break;
        }
      }
      lastTimes[lane] = node.timeSeconds;
      return { ...node, lane };
    });
}
