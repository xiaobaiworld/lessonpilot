// 定位: 学生书包 UI、课程链接构造和可测试的授权码下载控制器。
// 入口参数: 授权码文本、runtime 下载函数、覆盖确认函数和可选超时时间。
// 返回参数: 标准化下载结果、课程记录，以及挂载到 B 站页面的 AccessPanel。
(function initAccessPanel(global, factory) {
  const api = factory();
  global.LessonPilotAccessPanel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis, function createAccessPanelModule() {
  const ACCESS_CODE_PATTERN = /^KM-[A-Z2-7]{5}(?:-[A-Z2-7]{5}){3}$/;
  const BVID_PATTERN = /^BV[a-zA-Z0-9]+$/;

  function normalizeAccessCode(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
  }

  function buildBilibiliCourseUrl(videoRef) {
    if (videoRef?.platform !== 'bilibili' || !BVID_PATTERN.test(videoRef.videoId ?? '')) return null;
    return `https://www.bilibili.com/video/${videoRef.videoId}/`;
  }

  function buildLessonRecord(course, lesson, { includeLessonTitle = false } = {}) {
    if (!Array.isArray(course?.lessons) || course.lessons.length === 0
      || typeof course.title !== 'string' || !course.title.trim()) {
      return null;
    }
    const url = lesson ? buildBilibiliCourseUrl(lesson.videoRef) : null;
    if (!url || typeof course.courseId !== 'string') return null;
    return {
      courseId: course.courseId,
      lessonId: lesson.lessonId,
      label: includeLessonTitle && typeof lesson.title === 'string' && lesson.title.trim()
        ? `${course.title.trim()} · ${lesson.title.trim()}`
        : course.title.trim(),
      url
    };
  }

  function buildCourseRecord(course) {
    return buildLessonRecord(course, course?.lessons?.[0]);
  }

  function buildCourseRecords(installedCourses) {
    const records = [];
    for (const item of installedCourses ?? []) {
      const course = item?.course ?? item;
      if (!Array.isArray(course?.lessons)) continue;
      for (const lesson of course.lessons) {
        const record = buildLessonRecord(course, lesson, {
          includeLessonTitle: course.lessons.length > 1
        });
        if (record) records.push(record);
      }
    }
    return records;
  }

  function createAccessCodeController({ download, timeoutMs = 10000 }) {
    async function request(payload) {
      let timer;
      try {
        const result = await Promise.race([
          Promise.resolve().then(() => download(payload)),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('runtime timeout')), timeoutMs);
          })
        ]);
        if (!result || typeof result !== 'object' || Array.isArray(result)
          || typeof result.ok !== 'boolean') {
          return { ok: false, error: 'EXTENSION_UNAVAILABLE' };
        }
        return result;
      } catch {
        return { ok: false, error: 'EXTENSION_UNAVAILABLE' };
      } finally {
        clearTimeout(timer);
      }
    }

    async function submit(value) {
      const authorizationCode = normalizeAccessCode(value);
      if (!ACCESS_CODE_PATTERN.test(authorizationCode)) {
        return { ok: false, error: 'INVALID_ACCESS_CODE' };
      }
      return request({ authorizationCode });
    }
    return { submit };
  }

  const ERROR_MESSAGES = {
    INVALID_ACCESS_CODE: '授权码格式或内容无效，请检查后重试。',
    COURSE_NOT_AVAILABLE: '这门课程当前不可下载，请联系老师。',
    NETWORK_FAILURE: '无法连接本地课程服务，请确认服务已启动。',
    INVALID_RESPONSE: '课程服务返回了无法识别的数据。',
    INVALID_COURSE: '课程配置未通过安全校验，未保存本次课程。',
    STORAGE_FAILURE: '课程无法保存到插件本地存储。',
    SERVICE_UNAVAILABLE: '课程服务暂时不可用。',
    EXTENSION_UNAVAILABLE: '插件后台暂时不可用，请重新加载插件和页面。'
  };

  class AccessPanel {
    constructor({ runtime, installedCourses, onCourseInstalled }) {
      this.runtime = runtime;
      this.onCourseInstalled = onCourseInstalled;
      this.root = document.createElement('aside');
      this.root.id = 'lessonpilot-access-panel';
      this.root.innerHTML = `
        <button type="button" class="lessonpilot-access-launcher" aria-label="打开 KnownMap 书包">书包</button>
        <div class="lessonpilot-access-card" role="dialog" aria-modal="false" aria-labelledby="lessonpilot-access-title" hidden>
          <header><strong id="lessonpilot-access-title">KnownMap 书包</strong><button type="button" data-action="close" aria-label="关闭">×</button></header>
          <section class="lessonpilot-course-list" aria-labelledby="lessonpilot-course-list-title">
            <strong id="lessonpilot-course-list-title">课程</strong>
            <p class="lessonpilot-course-empty">还没有课程，输入授权码领取。</p>
            <div class="lessonpilot-course-records">
              <article class="lessonpilot-course-record" hidden>
                <span class="lessonpilot-course-record-title"></span>
                <a class="lessonpilot-course-url"></a>
                <a class="lessonpilot-open-course">打开课程视频</a>
              </article>
            </div>
          </section>
          <form>
            <label for="lessonpilot-access-code">课程授权码</label>
            <input id="lessonpilot-access-code" name="access-code" autocomplete="off" spellcheck="false" maxlength="28" placeholder="KM-XXXXX-XXXXX-XXXXX-XXXXX">
            <button type="submit">下载课程</button>
          </form>
          <p class="lessonpilot-access-status" role="status"></p>
        </div>`;
      this.status = this.root.querySelector('.lessonpilot-access-status');
      this.courseEmpty = this.root.querySelector('.lessonpilot-course-empty');
      this.courseRecords = this.root.querySelector('.lessonpilot-course-records');
      this.courseRecord = this.root.querySelector('.lessonpilot-course-record');
      this.courseRecordTitle = this.root.querySelector('.lessonpilot-course-record-title');
      this.courseUrl = this.root.querySelector('.lessonpilot-course-url');
      this.openLink = this.root.querySelector('.lessonpilot-open-course');
      this.input = this.root.querySelector('input');
      this.submitButton = this.root.querySelector('button[type="submit"]');
      this.card = this.root.querySelector('.lessonpilot-access-card');
      this.controller = createAccessCodeController({
        download: (payload) => this.runtime.sendMessage({ type: 'DOWNLOAD_STUDENT_COURSE', payload })
      });
      this.bind();
      this.renderCourses(installedCourses ?? []);
    }

    bind() {
      this.root.querySelector('.lessonpilot-access-launcher').addEventListener('click', () => this.open());
      this.root.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
      this.root.querySelector('form').addEventListener('submit', async (event) => {
        event.preventDefault();
        this.submitButton.disabled = true;
        this.status.textContent = '正在下载并校验课程…';
        const result = await this.controller.submit(this.input.value);
        this.input.value = '';
        this.submitButton.disabled = false;
        if (!result.ok) {
          this.status.textContent = ERROR_MESSAGES[result.error] ?? '课程下载失败，未保存本次课程。';
          return;
        }
        this.status.textContent = result.status === 'current' ? '课程已经是最新版本。' : '课程已安全保存。';
        this.renderCourses(result.installedCourses ?? []);
        this.onCourseInstalled?.();
      });
    }

    renderCourses(installedCourses) {
      const records = buildCourseRecords(installedCourses);
      if (records.length <= 1) {
        this.renderRecord(records[0] ?? null);
        return;
      }
      this.courseRecords.replaceChildren();
      this.courseEmpty.hidden = true;
      for (const record of records) {
        const article = document.createElement('article');
        article.className = 'lessonpilot-course-record';
        const title = document.createElement('span');
        title.className = 'lessonpilot-course-record-title';
        title.textContent = record.label;
        const url = document.createElement('a');
        url.className = 'lessonpilot-course-url';
        url.textContent = record.url;
        url.href = record.url;
        url.target = '_self';
        url.rel = 'noopener';
        const openLink = document.createElement('a');
        openLink.className = 'lessonpilot-open-course';
        openLink.textContent = '打开课程视频';
        openLink.href = record.url;
        openLink.target = '_self';
        openLink.rel = 'noopener';
        article.append(title, url, openLink);
        this.courseRecords.append(article);
      }
    }

    renderCourse(course) {
      this.renderRecord(buildCourseRecord(course));
    }

    renderRecord(record) {
      if (!this.courseRecord.isConnected) {
        this.courseRecords.replaceChildren(this.courseRecord);
      }
      this.courseRecord.hidden = !record;
      this.courseEmpty.hidden = Boolean(record);
      if (record) {
        this.courseRecordTitle.textContent = record.label;
        this.courseUrl.textContent = record.url;
        this.courseUrl.href = record.url;
        this.courseUrl.target = '_self';
        this.courseUrl.rel = 'noopener';
        this.openLink.href = record.url;
        this.openLink.target = '_self';
        this.openLink.rel = 'noopener';
      } else {
        this.courseRecordTitle.textContent = '';
        this.courseUrl.textContent = '';
        this.courseUrl.removeAttribute('href');
        this.openLink.removeAttribute('href');
      }
    }

    mount() {
      if (!document.getElementById(this.root.id)) document.documentElement.appendChild(this.root);
    }
    open() { this.card.hidden = false; this.input.focus(); }
    close() { this.card.hidden = true; }
    destroy() { this.root.remove(); }
  }

  return {
    normalizeAccessCode,
    buildBilibiliCourseUrl,
    buildCourseRecord,
    buildCourseRecords,
    createAccessCodeController,
    AccessPanel
  };
});
