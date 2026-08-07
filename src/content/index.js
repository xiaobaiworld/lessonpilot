/**
 * LessonPilot content script entry.
 */
(function initContentScript() {
  if (window.__lessonPilotContentLoaded) {
    return;
  }
  window.__lessonPilotContentLoaded = true;

  const demo = window.LessonPilotDemoConfig;
  if (!demo.isDemoVideoPage()) {
    return;
  }

  const player = window.LessonPilotBiliPlayer;
  const { MascotWidget } = window.LessonPilotMascot;

  const mascot = new MascotWidget();
  mascot.mount();

  let dialogShownAt35 = false;

  /**
   * @param {'playing' | 'paused' | 'missing'} state
   */
  function syncState(state) {
    if (state === 'playing') {
      mascot.setState('playing');
    } else if (state === 'paused') {
      mascot.setState('paused');
    } else {
      mascot.setState('idle');
    }
  }

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

  const stopWatching = player.watchPlayback((state) => {
    syncState(state);
  });

  const stopTimeWatch = player.watchTime((currentTime) => {
    if (currentTime < demo.DIALOG_AT_SECONDS - 0.5) {
      dialogShownAt35 = false;
      return;
    }

    if (currentTime >= demo.DIALOG_AT_SECONDS && !dialogShownAt35) {
      dialogShownAt35 = true;
      mascot.showDialog();
    }
  });

  window.addEventListener('pagehide', () => {
    stopWatching();
    stopTimeWatch();
    mascot.destroy();
  });
})();
