/**
 * 1A diagnostics page behaviour.
 *
 * Proves the protocol works end to end and nothing more: no subtitle import, no
 * timeline, no node editing. Those belong to the 1B workspace, and adding them here
 * would make this page quietly become that workspace without meeting its gate.
 *
 * All dynamic text is written with textContent (A-SEC-01). Course prose and error
 * detail are untrusted input as far as this page is concerned, and innerHTML here
 * would be an injection point into the teacher's own browser.
 */
(function initWorkspaceDiagnostics(global) {
  const contract = global.LessonPilotCourseContract;
  const { createBridgeClient } = global.LessonPilotBridgeClient;

  const client = createBridgeClient({ window: global });

  const statusEl = document.getElementById('status');
  const logEl = document.getElementById('log');

  /**
   * The fixed course used to exercise a save. One notice node is enough to prove the
   * round trip; a realistic multi-node course would invite reading this page as a
   * content preview, which it is not.
   */
  function buildTestCourse() {
    const videoRef = { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' };
    return contract.normalizeCourse({
      schemaVersion: contract.SCHEMA_VERSION,
      courseId: contract.deriveCourseId(videoRef),
      videoRef,
      nodes: [{
        id: 'node-diagnostic-1',
        enabled: true,
        family: 'attention',
        interaction: 'notice',
        trigger: { kind: 'time_cross', timeSeconds: 39, captionId: null },
        display: { title: '1A 诊断节点', body: '这是用于验证消息通道的测试节点，不是真实课程内容。' },
        evaluation: null,
        effects: { pause: true }
      }],
      // Produced here, echoed back unchanged by the extension (D-011).
      updatedAt: new Date().toISOString()
    });
  }

  /** Short Chinese explanation per error code. Codes are stable; wording is not. */
  const ERROR_TEXT = {
    EXTENSION_UNAVAILABLE: '插件未响应。请确认已在 chrome://extensions 加载 src/ 并刷新本页。',
    UNSUPPORTED_VERSION: '插件协议版本与本页不兼容。请更新插件后重试。',
    UNKNOWN_OPERATION: '插件不支持该操作。',
    INVALID_REQUEST: '请求格式不合法，已被拒绝。',
    INVALID_CHANNEL: '消息通道不匹配，已被拒绝。',
    INVALID_COURSE: '课程配置未通过校验，插件已拒绝保存。',
    COURSE_MISMATCH: '当前课程与预期不一致，插件未做修改。',
    STORAGE_FAILURE: '插件本地存储读写失败。'
  };

  function setStatus(text, state) {
    statusEl.textContent = text;
    statusEl.dataset.state = state;
  }

  /** Append one line. Fields mirror the background log set: no prose, no answers. */
  function appendLog(operation, result) {
    const parts = [
      new Date().toISOString(),
      operation,
      result.ok ? 'success' : `failure ${result.error.code}`
    ];
    if (result.ok && typeof result.data?.courseId === 'string') parts.push(result.data.courseId);
    if (result.ok && typeof result.data?.sessionId === 'string') parts.push(result.data.sessionId);
    if (result.outcomeUnknown === true) parts.push('outcome-unknown');

    logEl.textContent += `${parts.join('  ')}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  /**
   * Run one operation with its buttons disabled, so a double click cannot produce two
   * writes while the first is still in flight.
   */
  function runOperation(label, operation, describe) {
    const buttons = [...document.querySelectorAll('button')];
    buttons.forEach((button) => { button.disabled = true; });
    setStatus(`${label}…`, '');

    operation()
      .then((result) => {
        appendLog(label, result);

        if (result.ok) {
          setStatus(describe(result.data), 'ok');
          return;
        }
        // A timed-out write may still have succeeded, so this must not be reported as
        // a failure the teacher should react to by redoing the work (A-BRIDGE-04).
        const explanation = ERROR_TEXT[result.error.code] ?? '操作未成功。';
        setStatus(
          result.outcomeUnknown === true
            ? `${label} 结果未确认：${explanation} 本页不会自动重试，请手动确认插件状态后再决定是否重试。`
            : `${label} 失败：${explanation}`,
          'bad'
        );
      })
      .finally(() => {
        buttons.forEach((button) => { button.disabled = false; });
      });
  }

  function showEnvironment() {
    document.getElementById('env-origin').textContent = global.location.origin;
    document.getElementById('env-pathname').textContent = global.location.pathname;
    // The page cannot verify the whitelist itself — that list lives in the extension.
    // Saying so is more honest than printing a guess.
    document.getElementById('env-allowed').textContent = '由插件内容脚本判定，PING 成功即表示本页在白名单内';
  }

  function wireButtons() {
    document.getElementById('btn-ping').addEventListener('click', () => {
      runOperation('PING', () => client.ping(), (data) => `插件已连接，版本 ${data.extensionVersion}。`);
    });

    document.getElementById('btn-get').addEventListener('click', () => {
      runOperation('读取当前课程', () => client.getCurrentCourse(), (data) => (
        data.course === null
          ? '插件中当前没有课程。'
          : `插件中有课程 ${data.course.courseId}，节点数 ${data.course.nodes.length}，更新时间 ${data.course.updatedAt}。`
      ));
    });

    document.getElementById('btn-save').addEventListener('click', () => {
      runOperation('保存测试课程', () => client.saveCurrentCourse(buildTestCourse()),
        (data) => `已保存 ${data.courseId}，更新时间 ${data.updatedAt}。`);
    });

    document.getElementById('btn-preview').addEventListener('click', () => {
      runOperation('创建预览会话',
        () => client.startPreviewSession(contract.deriveCourseId({ platform: 'bilibili', videoId: 'BV1WW4y1e7GL' })),
        (data) => `已创建会话 ${data.sessionId}，开始时间 ${data.startedAt}。`);
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      runOperation('清除当前课程',
        () => client.clearCurrentCourse(contract.deriveCourseId({ platform: 'bilibili', videoId: 'BV1WW4y1e7GL' })),
        () => '已清除当前课程和预览会话。');
    });
  }

  showEnvironment();
  wireButtons();
})(window);
