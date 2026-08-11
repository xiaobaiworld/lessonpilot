/**
 * LessonPilot content script entry.
 */
(function initContentScript() {
  if (window.__lessonPilotBootstrap) {
    return;
  }
  window.__lessonPilotBootstrap = true;

  const demo = window.LessonPilotDemoConfig;
  const player = window.LessonPilotBiliPlayer;
  const { MascotWidget } = window.LessonPilotMascot;
  const { SubtitleBlocker } = window.LessonPilotSubtitleBlocker;

  /** @type {InstanceType<typeof MascotWidget> | null} */
  let mascot = null;
  /** @type {InstanceType<typeof SubtitleBlocker> | null} */
  let subtitleBlocker = null;
  /** @type {(() => void) | null} */
  let stopWatchingPlayback = null;
  /** @type {(() => void) | null} */
  let stopWatchingTime = null;
  let dialogShownAt35 = false;

  /**
   * @param {'playing' | 'paused' | 'missing'} state
   */
  function syncState(state) {
    if (!mascot) {
      return;
    }

    if (state === 'playing') {
      mascot.setState('playing');
    } else if (state === 'paused') {
      mascot.setState('paused');
    } else {
      mascot.setState('idle');
    }
  }

  /**
   * @param {number} currentTime
   */
  function handleTimeUpdate(currentTime) {
    subtitleBlocker?.update(currentTime);

    if (currentTime < demo.DIALOG_AT_SECONDS - 0.5) {
      dialogShownAt35 = false;
      return;
    }

    if (currentTime >= demo.DIALOG_AT_SECONDS && !dialogShownAt35 && mascot) {
      dialogShownAt35 = true;
      mascot.showDialog();
    }
  }

  function teardownDemoControls() {
    stopWatchingPlayback?.();
    stopWatchingTime?.();
    mascot?.destroy();
    subtitleBlocker?.destroy();

    stopWatchingPlayback = null;
    stopWatchingTime = null;
    mascot = null;
    subtitleBlocker = null;
    dialogShownAt35 = false;
  }

  function setupDemoControls() {
    if (mascot) {
      return;
    }

    mascot = new MascotWidget();
    mascot.mount();

    subtitleBlocker = new SubtitleBlocker({
      getVideo: () => player.getMainVideo(),
      blockers: demo.SUBTITLE_BLOCKERS
    });
    subtitleBlocker.mount();

    mascot.shell.addEventListener('lessonpilot:mascot-toggle', async () => {
      syncState(await player.togglePlayback());
    });

    mascot.shell.addEventListener('lessonpilot:pause', () => {
      syncState(player.pause());
    });

    mascot.shell.addEventListener('lessonpilot:seek-30', () => {
      syncState(player.seekTo(demo.SEEK_30_SECONDS));
    });

    mascot.shell.addEventListener('lessonpilot:seek-35', () => {
      syncState(player.seekTo(demo.DIALOG_AT_SECONDS));
      dialogShownAt35 = true;
      mascot.showDialog();
    });

    stopWatchingPlayback = player.watchPlayback((state) => {
      syncState(state);
    });

    stopWatchingTime = player.watchTime((currentTime) => {
      handleTimeUpdate(currentTime);
    });
  }

  const stopWatchingUrl = demo.watchDemoPage(setupDemoControls, teardownDemoControls);

  if (demo.isDemoVideoPage()) {
    setupDemoControls();
  }

  window.addEventListener('pagehide', () => {
    stopWatchingUrl();
    teardownDemoControls();
  });
})();
