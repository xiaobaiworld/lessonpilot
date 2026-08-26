import React, { useMemo, useRef, useState } from 'react';
import { NODE_ICON_IDS, NodeIcon } from '@v1/web/shared/editor';
import { ScriptNode, NodeKind } from '../api';
import { metaOf, formatTime } from '../nodes';
import { TimelineSegment, assignLanes, buildSegmentTicks } from '../editorModel';

interface Props {
  nodes: ScriptNode[];
  durationSeconds: number;
  segment: TimelineSegment;
  armedKind: NodeKind | null;
  selectedId: string | null;
  onArm: (kind: NodeKind | null) => void;
  onPlaceAt: (seconds: number, kind?: NodeKind) => void;
  onSelect: (nodeId: string) => void;
  onOpen: (nodeId: string) => void;
  onMove: (nodeId: string, seconds: number) => void;
}

const TIMELINE_SAFE_EDGE = 38;

export const Timeline: React.FC<Props> = ({
  nodes,
  durationSeconds,
  segment,
  armedKind,
  selectedId,
  onArm,
  onPlaceAt,
  onSelect,
  onOpen,
  onMove,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragSeconds, setDragSeconds] = useState<number | null>(null);
  const ticks = useMemo(() => buildSegmentTicks(segment), [segment]);
  const visibleNodes = nodes.filter(
    (node) =>
      node.anchor.timeSeconds >= segment.startSeconds &&
      (node.anchor.timeSeconds < segment.endSeconds || segment.index === segment.total)
  );
  const lanes = assignLanes(
    visibleNodes.map((node) => ({ id: node.id, timeSeconds: node.anchor.timeSeconds }))
  );

  const secondsFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const contentWidth = Math.max(1, rect.width - TIMELINE_SAFE_EDGE * 2);
    const ratio = Math.max(
      0,
      Math.min(1, (clientX - rect.left - TIMELINE_SAFE_EDGE) / contentWidth)
    );
    return Math.round(
      (segment.startSeconds + ratio * (segment.endSeconds - segment.startSeconds)) * 10
    ) / 10;
  };

  const place = (clientX: number) => {
    if (!armedKind) return;
    onPlaceAt(secondsFromEvent(clientX));
    onArm(null);
  };

  return (
    <section className="visual-timeline" aria-label="课节时间线">
      <div className="visual-timeline-toolbar">
        <div>
          <strong>课节时间线</strong>
          <span>
            {formatTime(segment.startSeconds)} - {formatTime(segment.endSeconds)} · 共{' '}
            {formatTime(durationSeconds)}
          </span>
        </div>
        <span className="timeline-placement">
          {armedKind ? `已选择${metaOf(armedKind).label}，点击时间轴放置` : '选择节点后点击时间轴'}
        </span>
      </div>

      <div className="visual-timeline-ruler" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick.seconds} style={{ left: `${tick.percentage}%` }}>
            {formatTime(tick.seconds)}
          </span>
        ))}
      </div>

      <div
        ref={trackRef}
        className={`visual-timeline-track${armedKind ? ' is-armed' : ''}`}
        role="group"
        tabIndex={0}
        aria-label="课节时间轴"
        onClick={(event) => {
          if (event.target === event.currentTarget) place(event.clientX);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onArm(null);
          if (event.key === 'Enter' && armedKind) {
            const rect = event.currentTarget.getBoundingClientRect();
            place(rect.left + rect.width / 2);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragSeconds(secondsFromEvent(event.clientX));
        }}
        onDragLeave={() => setDragSeconds(null)}
        onDrop={(event) => {
          event.preventDefault();
          const nodeId = event.dataTransfer.getData('text/node-id');
          const kind = event.dataTransfer.getData('text/node-kind') as NodeKind;
          if (nodeId) onMove(nodeId, secondsFromEvent(event.clientX));
          else if (kind) {
            onArm(kind);
            onPlaceAt(secondsFromEvent(event.clientX), kind);
          }
          setDragSeconds(null);
        }}
      >
        <div className="visual-timeline-axis" />
        <div
          className="visual-timeline-content"
          onClick={(event) => {
            if (event.target === event.currentTarget) place(event.clientX);
          }}
        >
          <div className="visual-timeline-grid" aria-hidden="true">
            {ticks.map((tick) => (
              <span
                key={tick.seconds}
                className="visual-timeline-tick-line"
                style={{ left: `${tick.percentage}%` }}
              />
            ))}
          </div>
          <span className="timeline-boundary timeline-boundary-start">开始</span>
          <span className="timeline-boundary timeline-boundary-end">结束</span>
          {dragSeconds !== null && (
            <span
              className="timeline-drop-indicator"
              style={{
                left: `${((dragSeconds - segment.startSeconds) / (segment.endSeconds - segment.startSeconds || 1)) * 100}%`,
              }}
            >
              {formatTime(dragSeconds)}
            </span>
          )}

          {visibleNodes.map((node) => {
            const seconds = node.anchor.timeSeconds;
            const position =
              ((seconds - segment.startSeconds) / (segment.endSeconds - segment.startSeconds || 1)) *
              100;
            const lane = lanes.find((item) => item.id === node.id)?.lane ?? 0;
            const meta = metaOf(node.interaction);
            const iconId = NODE_ICON_IDS[node.interaction];
            const title = node.title || meta.label;
            return (
              <React.Fragment key={node.id}>
                <button
                  type="button"
                  draggable
                  className={`timeline-node-marker timeline-node-${node.interaction}${selectedId === node.id ? ' is-selected' : ''}`}
                  style={{ left: `${position}%` }}
                  aria-label={`${title} ${formatTime(seconds)}`}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/node-id', node.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(node.id);
                  }}
                  onDoubleClick={() => onOpen(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === 'Delete') onOpen(node.id);
                  }}
                >
                  <span className="timeline-node-marker-icon">
                    <NodeIcon iconId={iconId as 'attention' | 'choice' | 'blank' | 'qa'} />
                  </span>
                  <small>{formatTime(seconds)}</small>
                </button>
                <button
                  type="button"
                  className={`timeline-node-summary timeline-node-${node.interaction}${selectedId === node.id ? ' is-selected' : ''}`}
                  data-lane={lane % 2}
                  style={{ left: `${position}%` }}
                  onClick={() => onOpen(node.id)}
                >
                  {title}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {nodes.length === 0 && (
        <p className="visual-timeline-empty">还没有互动节点。先选择上方组件，再点击时间轴放置。</p>
      )}
    </section>
  );
};
