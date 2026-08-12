/**
 * Shared course validation and timed-node rules for the static student runtime.
 * The module works in both the browser and Node-based contract tests.
 */
(function initStudentWebRuntime(global, factory) {
  const api = factory();
  global.LessonPilotStudentRuntime = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createStudentWebRuntime() {
  const BILIBILI_VIDEO_ID = 'BV1WW4y1e7GL';
  const SUPPORTED_TYPES = new Set(['multiple_choice', 'fill_blank']);

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function evaluate(node, response) {
    return normalize(response) === normalize(node.answer);
  }

  function getAnswer(session, nodeId) {
    return session.answers.find((answer) => answer.nodeId === nodeId);
  }

  function getNextTrigger(nodes, session, currentTime) {
    return nodes.find((node) => currentTime >= node.timeSeconds && !getAnswer(session, node.id));
  }

  function validUrl(value) {
    try {
      new URL(value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function invalid(message) {
    return { ok: false, message };
  }

  function validateCourse(course) {
    if (!course || typeof course !== 'object') {
      return invalid('课程配置必须是对象。');
    }
    if (!course.id || !course.title || !course.source || !Array.isArray(course.nodes)) {
      return invalid('课程缺少 id、title、source 或 nodes。');
    }

    const { source, nodes } = course;
    if (source.platform !== 'bilibili' || source.videoId !== BILIBILI_VIDEO_ID) {
      return invalid('当前网页样例只允许指定的 B 站视频。');
    }
    if (!validUrl(source.pageUrl) || !validUrl(source.embedUrl)) {
      return invalid('B 站页面或嵌入地址无效。');
    }

    const pageUrl = new URL(source.pageUrl);
    const embedUrl = new URL(source.embedUrl);
    if (
      pageUrl.hostname !== 'www.bilibili.com' ||
      pageUrl.pathname !== `/video/${BILIBILI_VIDEO_ID}/` ||
      embedUrl.hostname !== 'player.bilibili.com' ||
      embedUrl.searchParams.get('bvid') !== BILIBILI_VIDEO_ID
    ) {
      return invalid('B 站地址必须与课程 BV 号完全匹配。');
    }
    if (nodes.length === 0) {
      return invalid('课程至少需要一个互动节点。');
    }

    const ids = new Set();
    let lastTime = -1;
    for (const node of nodes) {
      if (!node || typeof node !== 'object' || !node.id || ids.has(node.id)) {
        return invalid('互动节点 id 缺失或重复。');
      }
      ids.add(node.id);
      if (!SUPPORTED_TYPES.has(node.type) || !Number.isFinite(node.timeSeconds) || node.timeSeconds < 0) {
        return invalid(`互动节点 ${node.id} 的类型或时间无效。`);
      }
      if (node.timeSeconds < lastTime) {
        return invalid('互动节点必须按时间升序排列。');
      }
      lastTime = node.timeSeconds;
      if (!node.title || !node.prompt || !node.answer || !node.success || !node.failure) {
        return invalid(`互动节点 ${node.id} 缺少必要内容。`);
      }
      if (node.type === 'multiple_choice') {
        if (!Array.isArray(node.options) || node.options.length < 2 || !node.options.some((option) => option.id === node.answer)) {
          return invalid(`选择题 ${node.id} 的选项或答案无效。`);
        }
      }
    }
    return { ok: true, course };
  }

  return {
    BILIBILI_VIDEO_ID,
    evaluate,
    getAnswer,
    getNextTrigger,
    normalize,
    validateCourse
  };
});
