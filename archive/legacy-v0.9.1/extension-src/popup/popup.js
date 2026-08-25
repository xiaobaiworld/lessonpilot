// 定位: Chrome 工具栏 KnownMap 首页的学生领取、当前课程和教师入口交互。
// 入口参数: popup DOM、chrome.runtime 消息响应和用户输入的课程授权码。
// 返回参数: 更新后的 popup 可见状态，并通过后台原子保存课程和本地学习状态。
(function initKnownMapPopup() {
  const {
    buildCourseRecord,
    buildCourseRecords,
    createAccessCodeController
  } = globalThis.LessonPilotAccessPanel;

  const form = document.querySelector('#access-form');
  const input = document.querySelector('#access-code');
  const downloadButton = document.querySelector('#download-button');
  const status = document.querySelector('#status');
  const courseCount = document.querySelector('#course-count');
  const courseEmpty = document.querySelector('#course-empty');
  const courseList = document.querySelector('#course-list');
  const courseRecord = document.querySelector('#course-record');
  const courseTitle = document.querySelector('#course-title');
  const courseUrl = document.querySelector('#course-url');
  const openCourse = document.querySelector('#open-course');
  const pluginUpdateButton = document.querySelector('#plugin-update-button');
  const pluginUpdateStatus = document.querySelector('#plugin-update-status');

  const ERROR_MESSAGES = {
    INVALID_ACCESS_CODE: '授权码格式或内容无效，请检查后重试。',
    COURSE_NOT_AVAILABLE: '这门课程当前不可下载，请联系老师。',
    NETWORK_FAILURE: '无法连接本地课程服务，请确认服务已启动。',
    INVALID_RESPONSE: '课程服务返回了无法识别的数据。',
    INVALID_COURSE: '课程配置未通过安全校验，未保存本次课程。',
    STORAGE_FAILURE: '课程无法保存到插件本地存储。',
    SERVICE_UNAVAILABLE: '课程服务暂时不可用。',
    EXTENSION_UNAVAILABLE: '插件后台未响应，请在扩展管理页重新加载 KnownMap 后重试。'
  };

  function renderCourse(course) {
    if (!courseRecord.isConnected) {
      courseList.replaceChildren(courseRecord);
    }
    const record = buildCourseRecord(course);
    courseEmpty.hidden = Boolean(record);
    courseRecord.hidden = !record;
    courseCount.textContent = record ? '当前 1 门' : '当前 0 门';
    if (!record) return;
    courseTitle.textContent = record.label;
    courseUrl.textContent = record.url;
    courseUrl.href = record.url;
    openCourse.href = record.url;
  }

  function renderCourses(installedCourses) {
    const courses = (installedCourses ?? [])
      .map((item) => item?.course ?? item)
      .filter((course) => course && typeof course.title === 'string');
    const records = buildCourseRecords(installedCourses);
    courseEmpty.hidden = records.length > 0;
    courseCount.textContent = `当前 ${courses.length} 门`;
    if (records.length <= 1) {
      if (!records[0]) {
        renderCourse(null);
        return;
      }
      if (!courseRecord.isConnected) {
        courseList.replaceChildren(courseRecord);
      }
      courseRecord.hidden = false;
      courseTitle.textContent = records[0].label;
      courseUrl.textContent = records[0].url;
      courseUrl.href = records[0].url;
      openCourse.href = records[0].url;
      return;
    }
    courseList.replaceChildren();
    for (const record of records) {
      const article = document.createElement('article');
      article.className = 'course-card';
      const title = document.createElement('span');
      title.className = 'course-title';
      title.textContent = record.label;
      const url = document.createElement('a');
      url.className = 'course-url';
      url.textContent = record.url;
      url.href = record.url;
      url.target = '_blank';
      url.rel = 'noopener';
      const openLink = document.createElement('a');
      openLink.className = 'primary-link';
      openLink.textContent = '打开课程视频';
      openLink.href = record.url;
      openLink.target = '_blank';
      openLink.rel = 'noopener';
      article.append(title, url, openLink);
      courseList.append(article);
    }
  }

  const controller = createAccessCodeController({
    download: (payload) => chrome.runtime.sendMessage({ type: 'DOWNLOAD_STUDENT_COURSE', payload })
  });

  function downloadPluginUpdate() {
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: globalThis.LessonPilotApiConfig.STUDENT_PLUGIN_DOWNLOAD_URL,
        filename: 'knownmapplugin.zip',
        saveAs: true
      }, (downloadId) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(downloadId);
      });
    });
  }

  pluginUpdateButton.addEventListener('click', async () => {
    pluginUpdateButton.disabled = true;
    pluginUpdateStatus.textContent = '正在下载最新插件…';
    try {
      await downloadPluginUpdate();
      pluginUpdateStatus.textContent = '更新包已下载，请替换插件目录后刷新 KnownMap。';
    } catch {
      pluginUpdateStatus.textContent = '更新包下载失败，请稍后重试。';
    } finally {
      pluginUpdateButton.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    downloadButton.disabled = true;
    status.textContent = '正在下载并校验课程…';
    const result = await controller.submit(input.value);
    input.value = '';
    downloadButton.disabled = false;
    if (!result.ok) {
      status.textContent = ERROR_MESSAGES[result.error] ?? '课程下载失败，未保存本次课程。';
      return;
    }
    status.textContent = result.status === 'current' ? '课程已经是最新版本。' : '课程已保存，可以开始学习。';
    renderCourses(result.installedCourses ?? []);
  });

  async function loadInstalledCourse() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_INSTALLED_STUDENT_COURSES' });
      if (!response || response.ok !== true) {
        status.textContent = ERROR_MESSAGES[response?.error] ?? ERROR_MESSAGES.EXTENSION_UNAVAILABLE;
        return;
      }
      renderCourses(response.installedCourses);
    } catch {
      status.textContent = ERROR_MESSAGES.EXTENSION_UNAVAILABLE;
    }
  }

  loadInstalledCourse();
})();
