(function initKnownMapTimelineModel(global, factory) {
  const api = factory();
  global.KnownMapTimelineModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTimelineModel() {
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const roundTenth = (value) => Math.round(value * 10) / 10;

  function durationFromCaptions(captions) {
    const values = (Array.isArray(captions) ? captions : []).flatMap((caption) => [
      Number(caption?.endSeconds),
      Number(caption?.startSeconds)
    ]).filter((value) => Number.isFinite(value) && value >= 0);
    return Math.max(1, values.length ? Math.max(...values) : 1);
  }

  function durationFromContent(captions, nodes, minimumDurationSeconds = 0) {
    const captionList = Array.isArray(captions) ? captions : [];
    const nodeTimes = (Array.isArray(nodes) ? nodes : [])
      .map((node) => Number(node?.trigger?.timeSeconds))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const nodeDuration = nodeTimes.length ? Math.max(...nodeTimes) : 0;
    const minimumDuration = Math.max(0, Number(minimumDurationSeconds) || 0);
    if (captionList.length) {
      return Math.max(durationFromCaptions(captionList), nodeDuration, minimumDuration);
    }
    return Math.max(60, Math.ceil(nodeDuration / 60) * 60, minimumDuration);
  }

  function secondsFromClientX({ left, width, clientX, durationSeconds }) {
    const safeWidth = Number(width);
    const safeDuration = Math.max(1, Number(durationSeconds) || 1);
    if (!Number.isFinite(safeWidth) || safeWidth <= 0) return 0;
    const ratio = clamp((Number(clientX) - Number(left || 0)) / safeWidth, 0, 1);
    return roundTenth(ratio * safeDuration);
  }

  function percentFromSeconds(timeSeconds, durationSeconds) {
    const safeDuration = Math.max(1, Number(durationSeconds) || 1);
    return roundTenth(clamp((Number(timeSeconds) || 0) / safeDuration, 0, 1) * 100);
  }

  function nearestCaption(captions, timeSeconds) {
    const list = Array.isArray(captions) ? captions : [];
    if (!list.length) return null;
    const target = Number(timeSeconds);
    if (!Number.isFinite(target)) return list[0];

    let nearest = null;
    let nearestDistance = Infinity;
    for (const caption of list) {
      const start = Number(caption?.startSeconds);
      const end = Number(caption?.endSeconds);
      if (!Number.isFinite(start)) continue;
      if (Number.isFinite(end) && target >= start && target <= end) return caption;
      const distance = Math.abs(target - start);
      if (distance < nearestDistance) {
        nearest = caption;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  function sortNodes(nodes) {
    return [...(Array.isArray(nodes) ? nodes : [])].sort((left, right) => (
      Number(left?.trigger?.timeSeconds) - Number(right?.trigger?.timeSeconds)
      || String(left?.id).localeCompare(String(right?.id))
    ));
  }

  function assignLanes(nodes, { durationSeconds = 1, minGapPercent = 8, laneCount = 4 } = {}) {
    const laneEnds = Array.from({ length: laneCount }, () => -Infinity);
    return sortNodes(nodes).map((node) => {
      const percent = percentFromSeconds(node?.trigger?.timeSeconds, durationSeconds);
      let lane = laneEnds.findIndex((lastPercent) => percent - lastPercent >= minGapPercent);
      if (lane < 0) {
        lane = laneEnds.indexOf(Math.min(...laneEnds));
      }
      laneEnds[lane] = percent;
      return { ...node, percent, lane };
    });
  }

  function moveNode(nodes, nodeId, { timeSeconds, captions, captionId } = {}) {
    const safeTime = Math.max(0, roundTenth(Number(timeSeconds) || 0));
    const resolvedCaption = captionId === undefined
      ? nearestCaption(captions, safeTime)?.id ?? null
      : captionId;
    return sortNodes((Array.isArray(nodes) ? nodes : []).map((node) => (
      node.id === nodeId
        ? {
            ...node,
            trigger: {
              ...node.trigger,
              timeSeconds: safeTime,
              captionId: resolvedCaption
            }
          }
        : node
    )));
  }

  function formatTime(timeSeconds) {
    const safe = Math.max(0, Math.floor(Number(timeSeconds) || 0));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return hours > 0
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return {
    durationFromCaptions,
    durationFromContent,
    secondsFromClientX,
    percentFromSeconds,
    nearestCaption,
    sortNodes,
    assignLanes,
    moveNode,
    formatTime
  };
});
