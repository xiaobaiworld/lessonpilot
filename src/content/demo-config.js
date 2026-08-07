/**
 * Demo video scope for LessonPilot spike.
 * Only the primary interview lesson is supported in this build.
 */
(function initDemoConfig(global) {
  const DEMO_BVID = 'BV1WW4y1e7GL';
  const DIALOG_AT_SECONDS = 35;
  const SEEK_30_SECONDS = 30;

  function isDemoVideoPage() {
    return window.location.pathname.includes(`/video/${DEMO_BVID}`);
  }

  global.LessonPilotDemoConfig = {
    DEMO_BVID,
    DIALOG_AT_SECONDS,
    SEEK_30_SECONDS,
    isDemoVideoPage
  };
})(window);
