import React, { useEffect, useRef, useState } from 'react';
import {
  PRESENTATION_LIMITS,
  resolvePresentationGeometry,
  resolvePresentationHints,
  type PresentationHints,
  type PresentationViewport,
  type WindowPositionConfig,
} from '@v1/web/shared';

const POSITION_STEP = 0.5;

function clampPercent(value: number): number {
  return Math.round(
    Math.min(
      Math.max(value, PRESENTATION_LIMITS.positionMinPercent),
      PRESENTATION_LIMITS.positionMaxPercent,
    ) * 10,
  ) / 10;
}

export function positionFromPointerDelta(
  start: WindowPositionConfig,
  delta: { x: number; y: number },
  viewport: PresentationViewport,
): WindowPositionConfig {
  return {
    xPercent: viewport.width ? clampPercent(start.xPercent + delta.x / viewport.width * 100) : start.xPercent,
    yPercent: viewport.height ? clampPercent(start.yPercent + delta.y / viewport.height * 100) : start.yPercent,
  };
}

export function adjustPositionByKey(
  position: WindowPositionConfig,
  key: string,
): WindowPositionConfig {
  const delta = {
    x: key === 'ArrowRight' ? POSITION_STEP : key === 'ArrowLeft' ? -POSITION_STEP : 0,
    y: key === 'ArrowDown' ? POSITION_STEP : key === 'ArrowUp' ? -POSITION_STEP : 0,
  };
  return {
    xPercent: clampPercent(position.xPercent + delta.x),
    yPercent: clampPercent(position.yPercent + delta.y),
  };
}

interface PresentationPreviewProps {
  hints: PresentationHints;
  disabled: boolean;
  children: React.ReactNode;
  onChange: (patch: Partial<PresentationHints>) => void;
}

export const PresentationPreview: React.FC<PresentationPreviewProps> = ({
  hints,
  disabled,
  children,
  onChange,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    position: WindowPositionConfig;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState<PresentationViewport>({ width: 640, height: 360 });
  const presentation = resolvePresentationHints(hints);
  const geometry = resolvePresentationGeometry(presentation, viewport, 16);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const updateViewport = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ width: rect.width, height: rect.height });
      }
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const updatePosition = (position: WindowPositionConfig) => {
    onChange({
      windowSize: presentation.size,
      windowPosition: position,
      windowStyle: presentation.style,
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      position: presentation.position,
    };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start || disabled) return;
    updatePosition(positionFromPointerDelta(
      start.position,
      { x: event.clientX - start.pointerX, y: event.clientY - start.pointerY },
      viewport,
    ));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      updatePosition(adjustPositionByKey(presentation.position, event.key));
    }
    if (event.key === 'Home') {
      event.preventDefault();
      updatePosition({ xPercent: 0, yPercent: presentation.position.yPercent });
    }
    if (event.key === 'End') {
      event.preventDefault();
      updatePosition({ xPercent: 100, yPercent: presentation.position.yPercent });
    }
  };

  const stageStyle = {
    '--preview-left': `${geometry.left}px`,
    '--preview-top': `${geometry.top}px`,
    '--preview-width': `${geometry.width}px`,
    '--preview-height': `${geometry.height}px`,
  } as React.CSSProperties;

  return (
    <div className="student-node-preview-stage" ref={stageRef}>
      <span className="student-node-preview-video-label">课程视频 · 预览画面</span>
      <span className="student-node-preview-play" aria-hidden="true">▶</span>
      <article
        className={`student-node-card${dragging ? ' is-dragging' : ''}`}
        style={stageStyle}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="拖动调整互动窗口位置，也可以使用方向键微调"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {children}
      </article>
    </div>
  );
};
