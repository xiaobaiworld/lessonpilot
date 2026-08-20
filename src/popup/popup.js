// 定位: Chrome 工具栏 KnownMap 首页的学生领取、当前课程和教师入口交互。
// 入口参数: popup DOM、chrome.runtime 消息响应和用户输入的课程授权码。
// 返回参数: 更新后的 popup 可见状态，并通过后台原子保存课程和本地学习状态。
(function initKnownMapPopup() {
  const {
    buildCourseRecord,
    createAccessCodeController
  } = globalThis.LessonPilotAccessPanel;

  const form = document.querySelector('#access-form');
  const input = document.querySelector('#access-code');
  const downloadButton = document.querySelector('#download-button');
  const status = document.querySelector('#status');
  const courseCount = document.querySelector('#course-count');
  const courseEmpty = document.querySelector('#course-empty');
  const courseRecord = document.querySelector('#course-record');
  const courseTitle = document.querySelector('#course-title');
  const courseUrl = document.querySelector('#course-url');
  const openCourse = document.querySelector('#open-course');

  const ERROR_MESSAGES = {
    INVALID_ACCESS_CODE: '授权码格式或内容无效，请检查后重试。',
    COURSE_NOT_AVAILABLE: '这门课程当前不可下载，请联系老师。',
    NETWORK_FAILURE: '无法连接本地课程服务，请确认服务已启动。',
    INVALID_RESPONSE: '课程服务返回了无法识别的数据。',
    INVALID_COURSE: '课程配置未通过安全校验，原课程未被替换。',
    STORAGE_FAILURE: '课程无法保存到插件本地存储。',
    SERVICE_UNAVAILABLE: '课程服务暂时不可用。',
    COURSE_REPLACEMENT_CANCELLED: '已取消替换，原课程保持不变。',
    EXTENSION_UNAVAILABLE: '插件后台未响应，请在扩展管理页重新加载 KnownMap 后重试。'
  };

  function renderCourse(course) {
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

  const controller = createAccessCodeController({
    download: (payload) => chrome.runtime.sendMessage({ type: 'DOWNLOAD_STUDENT_COURSE', payload }),
    confirmReplace: () => window.confirm('当前只能保存一门课程。确定替换原课程和本地学习状态吗？')
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    downloadButton.disabled = true;
    status.textContent = '正在下载并校验课程…';
    const result = await controller.submit(input.value);
    input.value = '';
    downloadButton.disabled = false;
    if (!result.ok) {
      status.textContent = ERROR_MESSAGES[result.error] ?? '课程下载失败，原课程未被替换。';
      return;
    }
    status.textContent = result.status === 'current' ? '课程已经是最新版本。' : '课程已保存，可以开始学习。';
    renderCourse(result.course);
  });

  async function loadInstalledCourse() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_INSTALLED_STUDENT_COURSE' });
      if (!response || response.ok !== true) {
        status.textContent = ERROR_MESSAGES[response?.error] ?? ERROR_MESSAGES.EXTENSION_UNAVAILABLE;
        return;
      }
      renderCourse(response.installedCourse?.course ?? null);
    } catch {
      status.textContent = ERROR_MESSAGES.EXTENSION_UNAVAILABLE;
    }
  }

  loadInstalledCourse();
})();
