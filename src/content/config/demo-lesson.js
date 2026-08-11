/**
 * Demo lesson customization.
 * Edit this file to change timed subtitle blockers for the first demo video.
 */
(function initDemoLesson(global) {
  global.LessonPilotDemoLesson = {
    videoBvid: 'BV1WW4y1e7GL',

    /**
     * Each item defines one timed subtitle cover bar.
     *
     * Time:
     * - start: show bar when playback time >= start (seconds)
     * - end: hide bar when playback time >= end (seconds)
     *
     * Layout (relative to the video element):
     * - bottom: distance from the video bottom edge (number = px, string = %)
     * - height: bar height (number = px, string = %)
     * - left: distance from the video left edge (number = px, string = %)
     * - width: bar width (number = px, string = %)
     * - minHeight: optional minimum height in px when using %
     * - background: CSS color
     * - opacity: 0 to 1
     */
    subtitleBlockers: [
      {
        id: 'demo-15-20',
        start: 15,
        end: 20,
        layout: {
          bottom: '8%',
          height: '12%',
          left: '0%',
          width: '100%',
          minHeight: 48,
          background: '#000000',
          opacity: 0.96
        }
      }
    ]
  };
})(window);
