import React, { useEffect, useRef, useState } from 'react';
import {
  PRESENTATION_LIMITS,
  resolvePresentationGeometry,
  resolvePresentationHints,
  type PresentationHints,
  type PresentationViewport,
  type WindowSizeConfig,
  type WindowPositionConfig,
} from '@v1/web/shared';

const POSITION_STEP = 0.5;
type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const RESIZE_HANDLES: readonly ResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

interface PresentationDraft {
  windowSize: WindowSizeConfig;
  windowPosition: WindowPositionConfig;
}

interface PointerInteraction {
  mode: 'move' | 'resize';
  pointerX: number;
  pointerY: number;
  draft: PresentationDraft;
  handle?: ResizeHandle;
}

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

function clampSizePercent(value: number): number {
  return Math.round(
    Math.min(
      Math.max(value, PRESENTATION_LIMITS.minPercent),
      PRESENTATION_LIMITS.maxPercent,
    ) * 10,
  ) / 10;
}

function resizeAxis(
  startMin: number,
  startMax: number,
  delta: number,
  moveMinEdge: boolean,
): [number, number] {
  if (moveMinEdge) {
    const size = clampSizePercent(startMax - (startMin + delta));
    return [startMax - size, startMax];
  }
  const size = clampSizePercent(startMax + delta - startMin);
  return [startMin, startMin + size];
}

export function resizeFromPointerDelta(
  start: PresentationDraft,
  handle: ResizeHandle,
  delta: { x: number; y: number },
  viewport: PresentationViewport,
): PresentationDraft {
  const deltaX = viewport.width ? delta.x / viewport.width * 100 : 0;
  const deltaY = viewport.height ? delta.y / viewport.height * 100 : 0;
  let left = start.windowPosition.xPercent - start.windowSize.widthPercent / 2;
  let right = start.windowPosition.xPercent + start.windowSize.widthPercent / 2;
  let top = start.windowPosition.yPercent - start.windowSize.heightPercent / 2;
  let bottom = start.windowPosition.yPercent + start.windowSize.heightPercent / 2;

  if (handle.includes('w')) [left, right] = resizeAxis(left, right, deltaX, true);
  if (handle.includes('e')) [left, right] = resizeAxis(left, right, deltaX, false);
  if (handle.includes('n')) [top, bottom] = resizeAxis(top, bottom, deltaY, true);
  if (handle.includes('s')) [top, bottom] = resizeAxis(top, bottom, deltaY, false);

  return {
    windowSize: {
      widthPercent: clampSizePercent(right - left),
      heightPercent: clampSizePercent(bottom - top),
    },
    windowPosition: {
      xPercent: clampPercent((left + right) / 2),
      yPercent: clampPercent((top + bottom) / 2),
    },
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
  const cardRef = useRef<HTMLElement>(null);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const [interactionMode, setInteractionMode] = useState<PointerInteraction['mode'] | null>(null);
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

  const updatePresentation = (draft: PresentationDraft) => {
    onChange({
      windowSize: draft.windowSize,
      windowPosition: draft.windowPosition,
      windowStyle: presentation.style,
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (disabled) return;
    cardRef.current?.setPointerCapture?.(event.pointerId);
    const handleElement = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-handle]')
      : null;
    const handle = handleElement?.dataset.handle as ResizeHandle | undefined;
    if (handle && RESIZE_HANDLES.includes(handle)) {
      event.stopPropagation();
      interactionRef.current = {
        mode: 'resize',
        pointerX: event.clientX,
        pointerY: event.clientY,
        draft: { windowSize: presentation.size, windowPosition: presentation.position },
        handle,
      };
      setInteractionMode('resize');
      return;
    }
    interactionRef.current = {
      mode: 'move',
      pointerX: event.clientX,
      pointerY: event.clientY,
      draft: { windowSize: presentation.size, windowPosition: presentation.position },
    };
    setInteractionMode('move');
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const start = interactionRef.current;
    if (!start || disabled) return;
    const delta = { x: event.clientX - start.pointerX, y: event.clientY - start.pointerY };
    if (start.mode === 'move') {
      updatePresentation({
        windowSize: start.draft.windowSize,
        windowPosition: positionFromPointerDelta(start.draft.windowPosition, delta, viewport),
      });
    } else if (start.handle) {
      updatePresentation(resizeFromPointerDelta(start.draft, start.handle, delta, viewport));
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    if (cardRef.current?.hasPointerCapture?.(event.pointerId)) {
      cardRef.current.releasePointerCapture?.(event.pointerId);
    }
    interactionRef.current = null;
    setInteractionMode(null);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      updatePresentation({
        windowSize: presentation.size,
        windowPosition: adjustPositionByKey(presentation.position, event.key),
      });
    }
    if (event.key === 'Home') {
      event.preventDefault();
      updatePresentation({
        windowSize: presentation.size,
        windowPosition: { xPercent: 0, yPercent: presentation.position.yPercent },
      });
    }
    if (event.key === 'End') {
      event.preventDefault();
      updatePresentation({
        windowSize: presentation.size,
        windowPosition: { xPercent: 100, yPercent: presentation.position.yPercent },
      });
    }
  };

  const stageStyle = {
    '--preview-left': `${geometry.left}px`,
    '--preview-top': `${geometry.top}px`,
    '--preview-width': `${geometry.width}px`,
    '--preview-height': `${geometry.height}px`,
  } as React.CSSProperties;

  return (
    <div
      className="student-node-preview-stage"
      ref={stageRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="student-node-preview-video-label">课程视频 · 预览画面</span>
      <span className="student-node-preview-play" aria-hidden="true">▶</span>
      <article
        ref={cardRef}
        className={`student-node-card${interactionMode ? ' is-dragging' : ''}`}
        style={stageStyle}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="拖动窗口调整位置；拖动边缘或四角调整大小；也可以使用方向键微调位置"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        {children}
        {RESIZE_HANDLES.map((handle) => (
          <span
            key={handle}
            className={`preview-resize-handle preview-resize-handle-${handle}`}
            data-handle={handle}
            aria-hidden="true"
          />
        ))}
      </article>
    </div>
  );
};
