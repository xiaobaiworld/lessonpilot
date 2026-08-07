/**
 * Demo video scope for LessonPilot spike.
 * Only the primary interview lesson is supported in this build.
 */
(function initDemoConfig(global) {
  const DEMO_BVID = 'BV1WW4y1e7GL';
  const DIALOG_AT_SECONDS = 35;
  const SEEK_30_SECONDS = 30;

  /**
   * @param {Location | { pathname: string }} loc
   * @returns {string | null}
   */
  function getBvidFromLocation(loc = window.location) {
    const match = loc.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
    return match ? match[1] : null;
  }

  /**
   * @param {Location | { pathname: string }} loc
   */
  function isDemoVideoPage(loc = window.location) {
    return getBvidFromLocation(loc) === DEMO_BVID;
  }

  /**
   * Bilibili navigates like an SPA. Watch URL changes and run callbacks
   * when entering or leaving the demo video page.
   *
   * @param {(loc: Location) => void} onEnter
   * @param {(loc: Location) => void} onLeave
   * @returns {() => void}
   */
  function watchDemoPage(onEnter, onLeave) {
    let active = isDemoVideoPage();

    function sync() {
      const next = isDemoVideoPage();
      if (next && !active) {
        onEnter(window.location);
      } else if (!next && active) {
        onLeave(window.location);
      }
      active = next;
    }

    window.addEventListener('popstate', sync);

    const wrapHistory = (method) => {
      const original = history[method];
      return function wrappedHistoryMethod(...args) {
        const result = original.apply(this, args);
        sync();
        return result;
      };
    };

    history.pushState = wrapHistory('pushState');
    history.replaceState = wrapHistory('replaceState');

    const intervalId = window.setInterval(sync, 1000);

    return () => {
      window.removeEventListener('popstate', sync);
      window.clearInterval(intervalId);
    };
  }

  global.LessonPilotDemoConfig = {
    DEMO_BVID,
    DIALOG_AT_SECONDS,
    SEEK_30_SECONDS,
    getBvidFromLocation,
    isDemoVideoPage,
    watchDemoPage
  };
})(window);
