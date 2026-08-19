/** KnownMap student runtime: bookbag on every Bilibili video, course only on matching BVID. */
(function initContentScript() {
  if (window.__lessonPilotBootstrap) return;
  window.__lessonPilotBootstrap = true;

  const player = window.LessonPilotBiliPlayer;
  const { MascotWidget } = window.LessonPilotMascot;
  const { AccessPanel } = window.LessonPilotAccessPanel;
  const runtime = window.LessonPilotCourseRuntime;

  let course = null;
  let learningState = null;
  let pageWatcherStop = null;
  let playbackStop = null;
  let timeStop = null;
  let mascot = null;

  function teardownCourseUi() {
    playbackStop?.();
    timeStop?.();
    mascot?.destroy();
    playbackStop = null;
    timeStop = null;
    mascot = null;
  }

  function setupCourseUi() {
    if (!course || mascot) return;
    mascot = new MascotWidget();
    mascot.mount();
    const completedNodeIds = Object.entries(learningState?.nodeStates ?? {})
      .filter(([, state]) => state.status === 'completed')
      .map(([nodeId]) => nodeId);
    const timeline = runtime.createNodeTimeline(course, (node) => {
      player.pause();
      mascot.showNode(node, async (answer) => {
        const evaluation = runtime.evaluateNodeAnswer(node, answer);
        const saved = await chrome.runtime.sendMessage({
          type: 'RECORD_STUDENT_NODE_ATTEMPT',
          payload: { nodeId: node.id, correct: evaluation.correct, answer }
        });
        if (!saved?.ok) {
          return {
            accepted: false,
            correct: false,
            feedback: '学习进度保存失败，请重试。'
          };
        }
        return { ...evaluation, accepted: true };
      }, async () => {
        timeline.complete(node.id);
        mascot?.setState(await player.play());
      });
    }, { completedNodeIds });

    mascot.shell.addEventListener('lessonpilot:mascot-toggle', async () => {
      const state = await player.togglePlayback();
      mascot?.setState(state === 'missing' ? 'idle' : state);
    });
    mascot.shell.addEventListener('lessonpilot:pause', () => mascot?.setState(player.pause()));
    playbackStop = player.watchPlayback((state) => mascot?.setState(state));
    timeStop = player.watchTime((currentTime) => timeline.update(currentTime));
  }

  function activateCourse(nextCourse, nextLearningState = null) {
    pageWatcherStop?.();
    teardownCourseUi();
    course = nextCourse;
    learningState = nextLearningState;
    if (!course) return;
    pageWatcherStop = runtime.createCoursePageWatcher({
      window,
      course,
      onEnter: setupCourseUi,
      onLeave: teardownCourseUi
    });
  }

  async function bootstrap() {
    let installedCourse = null;
    let installedLearningState = null;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_INSTALLED_STUDENT_COURSE' });
      if (response?.ok) {
        installedCourse = response.installedCourse;
        installedLearningState = response.learningState;
      }
    } catch {
      // The bookbag remains usable and will show a download error if the worker is unavailable.
    }
    const panel = new AccessPanel({
      runtime: chrome.runtime,
      installedCourse,
      onCourseInstalled: activateCourse
    });
    panel.mount();
    activateCourse(installedCourse?.course ?? null, installedLearningState);

    window.addEventListener('pagehide', () => {
      pageWatcherStop?.();
      teardownCourseUi();
      panel.destroy();
    }, { once: true });
  }

  bootstrap();
})();
