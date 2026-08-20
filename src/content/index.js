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
  let activeCourseId = null;
  let activeLessonId = null;
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
          payload: {
            courseId: activeCourseId,
            lessonId: activeLessonId,
            nodeId: node.id,
            correct: evaluation.correct,
            answer
          }
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

  function activateLesson(match) {
    teardownCourseUi();
    course = match?.lesson ?? null;
    learningState = match?.learningState ?? null;
    activeCourseId = match?.course?.courseId ?? null;
    activeLessonId = match?.lesson?.lessonId ?? null;
    if (course) setupCourseUi();
  }

  function activateLibrary(installedCourses, learningStates) {
    pageWatcherStop?.();
    teardownCourseUi();
    pageWatcherStop = runtime.createCourseLibraryWatcher({
      window,
      installedCourses,
      learningStates,
      onChange: activateLesson
    });
  }

  async function loadLibrary() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_INSTALLED_STUDENT_COURSES' });
    if (!response?.ok) return { installedCourses: [], learningStates: {} };
    return {
      installedCourses: response.installedCourses ?? [],
      learningStates: response.learningStates ?? {}
    };
  }

  async function bootstrap() {
    let library = { installedCourses: [], learningStates: {} };
    try {
      library = await loadLibrary();
    } catch {
      // The bookbag remains usable and will show a download error if the worker is unavailable.
    }
    const panel = new AccessPanel({
      runtime: chrome.runtime,
      installedCourses: library.installedCourses,
      onCourseInstalled: async () => {
        library = await loadLibrary();
        panel.renderCourses(library.installedCourses);
        activateLibrary(library.installedCourses, library.learningStates);
      }
    });
    panel.mount();
    activateLibrary(library.installedCourses, library.learningStates);

    window.addEventListener('pagehide', () => {
      pageWatcherStop?.();
      teardownCourseUi();
      panel.destroy();
    }, { once: true });
  }

  bootstrap();
})();
