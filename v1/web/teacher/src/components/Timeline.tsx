import React from 'react';
import { TimelineModel } from '@v1/web/shared/editor';
import { ScriptNode } from '../api';
import { metaOf, formatTime } from '../nodes';

interface Props {
  nodes: ScriptNode[];
  /**
   * 课程总时长。
   *
   * 只在有真源时才传：字幕最后一句的结束时刻。没有字幕时不显示时间轴——
   * 随手填一个兜底时长会让刻度、末端标记和节点百分比一致地指向错误位置
   * （doc/lessons.md 2026-08-20）。
   */
  durationSeconds: number;
  /** 点击轨道空白处，在该时刻新建节点 */
  onPlaceAt: (seconds: number) => void;
  /** 点击已有节点标记 */
  onSelect: (nodeId: string) => void;
  selectedId: string | null;
}

/** 刻度间隔随时长自适应，避免短视频刻度太密、长视频太疏 */
function tickInterval(durationSeconds: number): number {
  if (durationSeconds <= 180) return 30;
  if (durationSeconds <= 600) return 60;
  if (durationSeconds <= 1800) return 300;
  return 600;
}

export const Timeline: React.FC<Props> = ({
  nodes,
  durationSeconds,
  onPlaceAt,
  onSelect,
  selectedId,
}) => {
  if (durationSeconds <= 0) return null;

  const model = new TimelineModel({
    durationSeconds,
    pixelsPerSecond: 1, // 用百分比布局，像素比例不参与渲染
    tickIntervalSeconds: tickInterval(durationSeconds),
  });

  const placeFromClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const seconds = Math.round(Math.max(0, Math.min(1, ratio)) * durationSeconds);
    onPlaceAt(seconds);
  };

  return (
    <div className="timeline">
      <div className="timeline-head">
        <strong>时间轴</strong>
        <span>点击轨道在该时刻新建节点，或点标记跳到对应节点</span>
        <span className="timeline-duration">{formatTime(durationSeconds)}</span>
      </div>

      <div
        className="timeline-track"
        onClick={placeFromClick}
        role="button"
        tabIndex={0}
        aria-label="课程时间轴，点击以在该时刻新建节点"
        onKeyDown={(e) => {
          // 键盘用户：Enter 在中点新建，之后可在节点卡里改时刻
          if (e.key === 'Enter') onPlaceAt(Math.round(durationSeconds / 2));
        }}
      >
        {model.getTicks().map((tick) => (
          <span
            key={tick.seconds}
            className="timeline-tick"
            style={{ left: `${tick.percentage}%` }}
          >
            <i />
            <b>{formatTime(tick.seconds)}</b>
          </span>
        ))}

        {nodes.map((node) => {
          const seconds = node.trigger.timeSeconds;
          // 超出时长的节点仍要能看到，贴在末端并标出来
          const overflow = seconds > durationSeconds;
          const percent = overflow
            ? 100
            : model.getPercentagePosition(seconds);
          const meta = metaOf(node.interaction);

          return (
            <button
              key={node.id}
              type="button"
              className={
                `timeline-marker timeline-marker-${node.interaction}` +
                (selectedId === node.id ? ' is-selected' : '') +
                (overflow ? ' is-overflow' : '')
              }
              style={{ left: `${percent}%` }}
              title={
                overflow
                  ? `${meta.label} ${formatTime(seconds)}（超出课程时长）`
                  : `${meta.label} ${formatTime(seconds)}`
              }
              onClick={(e) => {
                e.stopPropagation(); // 不要同时触发轨道的新建
                onSelect(node.id);
              }}
            >
              <span className="visually-hidden">
                {meta.label} {formatTime(seconds)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
