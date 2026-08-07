/**
 * LessonPilot content script entry.
 * Spike: mount 2D mascot and wire it to Bilibili playback control.
 */
(function initContentScript() {
  if (window.__lessonPilotContentLoaded) {
    return;
  }
  window.__lessonPilotContentLoaded = true;

  const player = window.LessonPilotBiliPlayer;
  const { MascotWidget } = window.LessonPilotMascot;

  const mascot = new MascotWidget();
  mascot.mount();

  mascot.root.addEventListener('lessonpilot:mascot-toggle', async () => {
    const nextState = await player.togglePlayback();
    if (nextState === 'playing') {
      mascot.setState('playing');
    } else if (nextState === 'paused') {
      mascot.setState('paused');
    } else {
      mascot.setState('idle');
    }
  });

  const stopWatching = player.watchPlayback((state) => {
    mascot.setState(state);
  });

  window.addEventListener('pagehide', () => {
    stopWatching();
    mascot.destroy();
  });
})();
