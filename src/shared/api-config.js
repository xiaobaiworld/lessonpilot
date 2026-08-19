/** Fixed local API boundary for the unpacked-extension test stage. */
(function initApiConfig(global, factory) {
  const api = factory();
  global.LessonPilotApiConfig = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis, function createApiConfig() {
  const API_ORIGIN = 'http://127.0.0.1:8000';
  const COURSE_DOWNLOAD_ENDPOINT = `${API_ORIGIN}/api/v1/public/course-download`;
  return { API_ORIGIN, COURSE_DOWNLOAD_ENDPOINT };
});
