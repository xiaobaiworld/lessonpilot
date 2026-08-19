/** Pure BVID gating, SPA watching and node timeline helpers. */
(function initCourseRuntime(global, factory) {
  const api = factory();
  global.LessonPilotCourseRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis, function createCourseRuntimeModule() {
  function getBvidFromLocation(location) {
    const match = String(location?.pathname ?? '').match(/^\/video\/(BV[a-zA-Z0-9]+)(?:\/|$)/i);
    return match ? match[1] : null;
  }

  function courseMatchesLocation(course, location) {
    return course?.videoRef?.platform === 'bilibili'
      && getBvidFromLocation(location) === course.videoRef.videoId;
  }

  function createNodeTimeline(course, onNode, { completedNodeIds = [] } = {}) {
    const completed = new Set(completedNodeIds);
    const triggered = new Set(completed);
    let previousTime = 0;
    let activeNodeId = null;
    function update(currentTime) {
      if (activeNodeId !== null) return;
      if (currentTime < previousTime - 1) {
        triggered.clear();
        for (const nodeId of completed) triggered.add(nodeId);
      }
      for (const node of course.nodes ?? []) {
        if (!node.enabled || triggered.has(node.id)) continue;
        if (currentTime >= node.trigger.timeSeconds) {
          triggered.add(node.id);
          activeNodeId = node.id;
          onNode(node);
          break;
        }
      }
      previousTime = currentTime;
    }
    function complete(nodeId) {
      if (nodeId === activeNodeId) {
        completed.add(nodeId);
        activeNodeId = null;
      }
    }
    return {
      update,
      complete,
      reset: () => {
        triggered.clear();
        for (const nodeId of completed) triggered.add(nodeId);
        previousTime = 0;
        activeNodeId = null;
      }
    };
  }

  function evaluateNodeAnswer(node, answer) {
    if (node?.interaction === 'choice') {
      return { correct: answer === node.evaluation.answer, feedback: node.evaluation.explanation };
    }
    if (node?.interaction === 'blank') {
      const normalized = String(answer ?? '').trim().toLowerCase();
      const accepted = node.evaluation.acceptedAnswers.map((item) => item.trim().toLowerCase());
      return { correct: accepted.includes(normalized), feedback: node.evaluation.explanation };
    }
    if (node?.interaction === 'free_text') {
      return { correct: true, feedback: node.evaluation.referenceFeedback };
    }
    return { correct: true, feedback: node?.display?.body ?? '' };
  }

  function createCoursePageWatcher({ window: win, course, onEnter, onLeave }) {
    let active = courseMatchesLocation(course, win.location);
    if (active) onEnter(win.location);
    function sync() {
      const next = courseMatchesLocation(course, win.location);
      if (next && !active) onEnter(win.location);
      if (!next && active) onLeave(win.location);
      active = next;
    }
    const originals = {};
    for (const method of ['pushState', 'replaceState']) {
      originals[method] = win.history[method];
      win.history[method] = function wrapped(...args) {
        const result = originals[method].apply(this, args);
        sync();
        return result;
      };
    }
    win.addEventListener('popstate', sync);
    const intervalId = win.setInterval(sync, 1000);
    return () => {
      win.removeEventListener('popstate', sync);
      win.clearInterval(intervalId);
      for (const method of ['pushState', 'replaceState']) win.history[method] = originals[method];
      if (active) onLeave(win.location);
      active = false;
    };
  }

  return {
    getBvidFromLocation,
    courseMatchesLocation,
    createNodeTimeline,
    evaluateNodeAnswer,
    createCoursePageWatcher
  };
});
