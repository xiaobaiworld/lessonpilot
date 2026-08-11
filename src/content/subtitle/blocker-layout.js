/**
 * Layout helpers for timed subtitle blockers.
 */
(function initBlockerLayout(global) {
  /**
   * @param {number | string | undefined} value
   * @param {number} base
   * @param {number} [min=0]
   */
  function resolveMetric(value, base, min = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(min, Math.round(value));
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.endsWith('%')) {
        const ratio = Number.parseFloat(trimmed) / 100;
        if (Number.isFinite(ratio)) {
          return Math.max(min, Math.round(base * ratio));
        }
      }

      if (trimmed.endsWith('px')) {
        const pixels = Number.parseFloat(trimmed);
        if (Number.isFinite(pixels)) {
          return Math.max(min, Math.round(pixels));
        }
      }
    }

    return min;
  }

  /**
   * @param {Array<{ start: number, end: number }>} blockers
   * @param {number} currentTime
   */
  function findActiveBlocker(blockers, currentTime) {
    return blockers.find(
      (blocker) => currentTime >= blocker.start && currentTime < blocker.end
    );
  }

  /**
   * @param {DOMRect} videoRect
   * @param {{
   *   bottom?: number | string,
   *   height?: number | string,
   *   left?: number | string,
   *   width?: number | string,
   *   minHeight?: number,
   *   background?: string,
   *   opacity?: number
   * }} layout
   */
  function computeBarRect(videoRect, layout = {}) {
    const minHeight = layout.minHeight ?? 0;
    const height = resolveMetric(layout.height ?? '12%', videoRect.height, minHeight);
    const bottom = resolveMetric(layout.bottom ?? '8%', videoRect.height, 0);
    const left = resolveMetric(layout.left ?? '0%', videoRect.width, 0);
    const width = resolveMetric(layout.width ?? '100%', videoRect.width, 0);
    const top = videoRect.bottom - bottom - height;

    return {
      left: Math.round(videoRect.left + left),
      top: Math.round(top),
      width,
      height,
      background: layout.background ?? '#000000',
      opacity: layout.opacity ?? 0.96
    };
  }

  global.LessonPilotBlockerLayout = {
    resolveMetric,
    findActiveBlocker,
    computeBarRect
  };
})(window);
