/**
 * W0 student course shell. It presents one fixed Bilibili lesson and does not
 * attempt to control the cross-origin player or replace it with a local file.
 */
(function initStudentCourseShell() {
  const title = document.querySelector('#lesson-title');
  const summary = document.querySelector('#lesson-summary');
  const player = document.querySelector('#bilibili-player');
  const pageLink = document.querySelector('#bilibili-page-link');
  const startLink = document.querySelector('#start-course-link');
  const loadError = document.querySelector('#load-error');
  const loadErrorCopy = document.querySelector('#load-error-copy');

  function validUrl(value) {
    try {
      return Boolean(new URL(value));
    } catch (error) {
      return false;
    }
  }

  function showLoadError(message) {
    loadErrorCopy.textContent = message;
    loadError.hidden = false;
  }

  async function loadCourse() {
    try {
      const response = await fetch('./course.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`课程配置读取失败（${response.status}）。`);
      }
      const course = await response.json();
      if (!course?.title || !course?.summary || !validUrl(course?.source?.pageUrl) || !validUrl(course?.source?.embedUrl)) {
        throw new Error('课程配置缺少可用的标题、简介或视频地址。');
      }
      title.textContent = course.title;
      summary.textContent = course.summary;
      player.src = course.source.embedUrl;
      pageLink.href = course.source.pageUrl;
      startLink.href = course.source.pageUrl;
      document.title = `LessonPilot · ${course.title}`;
    } catch (error) {
      showLoadError(error.message || '未知错误。');
    }
  }

  loadCourse();
})();
