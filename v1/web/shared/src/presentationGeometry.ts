import {
  PRESENTATION_LIMITS,
  type ResolvedPresentationHints,
  type WindowPositionConfig,
} from './portableContent';

export interface PresentationViewport {
  width: number;
  height: number;
}

export interface PresentationRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PresentationContentSize {
  width: number;
  height: number;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function roundedPercent(value: number): number {
  return Math.round(value * 10) / 10;
}

export function resolvePresentationGeometry(
  hints: ResolvedPresentationHints,
  viewport: PresentationViewport,
  safeMargin = 16,
  contentSize?: PresentationContentSize,
): PresentationRect {
  const viewportWidth = finiteNonNegative(viewport.width);
  const viewportHeight = finiteNonNegative(viewport.height);
  const margin = Math.min(Math.max(finiteNonNegative(safeMargin), 0), Math.min(viewportWidth, viewportHeight) / 2);
  const baseWidth = Math.round(viewportWidth * hints.size.widthPercent / 100);
  const baseHeight = Math.round(viewportHeight * hints.size.heightPercent / 100);
  const width = Math.min(
    Math.max(baseWidth, Math.round(finiteNonNegative(contentSize?.width ?? 0))),
    Math.max(0, viewportWidth - margin * 2),
  );
  const height = Math.min(
    Math.max(baseHeight, Math.round(finiteNonNegative(contentSize?.height ?? 0))),
    Math.max(0, viewportHeight - margin * 2),
  );
  const centerX = viewportWidth * hints.position.xPercent / 100;
  const centerY = viewportHeight * hints.position.yPercent / 100;
  const left = clamp(centerX - width / 2, margin, viewportWidth - margin - width);
  const top = clamp(centerY - height / 2, margin, viewportHeight - margin - height);
  return { left: Math.round(left), top: Math.round(top), width, height };
}

export function percentFromPreviewPoint(
  point: { x: number; y: number },
  viewport: PresentationViewport,
): WindowPositionConfig {
  const width = finiteNonNegative(viewport.width);
  const height = finiteNonNegative(viewport.height);
  return {
    xPercent: width ? roundedPercent(clamp(point.x / width * 100, PRESENTATION_LIMITS.positionMinPercent, PRESENTATION_LIMITS.positionMaxPercent)) : 50,
    yPercent: height ? roundedPercent(clamp(point.y / height * 100, PRESENTATION_LIMITS.positionMinPercent, PRESENTATION_LIMITS.positionMaxPercent)) : 50,
  };
}
