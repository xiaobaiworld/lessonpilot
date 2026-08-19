/** Student bookbag UI and its testable download controller. */
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

  function createAccessCodeController({ download, confirmReplace }) {
    async function submit(value) {
      const authorizationCode = normalizeAccessCode(value);
      if (!ACCESS_CODE_PATTERN.test(authorizationCode)) {
        return { ok: false, error: 'INVALID_ACCESS_CODE' };
      }
      let first;
      try {
        first = await download({ authorizationCode });
      } catch {
        return { ok: false, error: 'EXTENSION_UNAVAILABLE' };
      }
      if (first.error !== 'COURSE_REPLACEMENT_REQUIRED') return first;
      const confirmed = await confirmReplace({
        currentCourseId: first.currentCourseId,
        incomingCourseId: first.incomingCourseId
      });
      if (!confirmed) return { ...first, error: 'COURSE_REPLACEMENT_CANCELLED' };
      try {
        return await download({
          authorizationCode,
          replaceCourse: true,
          expectedCourseId: first.currentCourseId
        });
      } catch {
        return { ok: false, error: 'EXTENSION_UNAVAILABLE' };
      }
    }
    return { submit };
  }

  const ERROR_MESSAGES = {
    INVALID_ACCESS_CODE: '授权码格式或内容无效，请检查后重试。',
    COURSE_NOT_AVAILABLE: '这门课程当前不可下载，请联系老师。',
    NETWORK_FAILURE: '无法连接本地课程服务，请确认服务已启动。',
    INVALID_RESPONSE: '课程服务返回了无法识别的数据。',
    INVALID_COURSE: '课程配置未通过安全校验，旧课程未被替换。',
    STORAGE_FAILURE: '课程无法保存到插件本地存储。',
    SERVICE_UNAVAILABLE: '课程服务暂时不可用。',
    COURSE_REPLACEMENT_CANCELLED: '已取消替换，原课程和学习状态保持不变。',
    EXTENSION_UNAVAILABLE: '插件后台暂时不可用，请重新加载插件和页面。'
  };

  class AccessPanel {
    constructor({ runtime, installedCourse, onCourseInstalled }) {
      this.runtime = runtime;
      this.installedCourse = installedCourse;
      this.onCourseInstalled = onCourseInstalled;
      this.root = document.createElement('aside');
      this.root.id = 'lessonpilot-access-panel';
      this.root.innerHTML = `
        <button type="button" class="lessonpilot-access-launcher" aria-label="打开 KnownMap 书包">书包</button>
        <div class="lessonpilot-access-card" role="dialog" aria-modal="false" aria-labelledby="lessonpilot-access-title" hidden>
          <header><strong id="lessonpilot-access-title">KnownMap 书包</strong><button type="button" data-action="close" aria-label="关闭">×</button></header>
          <p class="lessonpilot-current-course"></p>
          <form>
            <label for="lessonpilot-access-code">课程授权码</label>
            <input id="lessonpilot-access-code" name="access-code" autocomplete="off" spellcheck="false" maxlength="28" placeholder="KM-XXXXX-XXXXX-XXXXX-XXXXX">
            <button type="submit">下载课程</button>
          </form>
          <p class="lessonpilot-access-status" role="status"></p>
          <a class="lessonpilot-open-course" hidden>打开课程视频</a>
        </div>`;
      this.status = this.root.querySelector('.lessonpilot-access-status');
      this.courseLabel = this.root.querySelector('.lessonpilot-current-course');
      this.openLink = this.root.querySelector('.lessonpilot-open-course');
      this.input = this.root.querySelector('input');
      this.submitButton = this.root.querySelector('button[type="submit"]');
      this.card = this.root.querySelector('.lessonpilot-access-card');
      this.controller = createAccessCodeController({
        download: (payload) => this.runtime.sendMessage({ type: 'DOWNLOAD_STUDENT_COURSE', payload }),
        confirmReplace: () => window.confirm('插件当前只能保存一门课程。确定替换原课程和本地学习状态吗？')
      });
      this.bind();
      this.renderCourse(installedCourse?.course ?? null);
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
          this.status.textContent = ERROR_MESSAGES[result.error] ?? '课程下载失败，旧课程未被替换。';
          return;
        }
        this.status.textContent = result.status === 'current' ? '课程已经是最新版本。' : '课程已安全保存。';
        this.renderCourse(result.course);
        this.onCourseInstalled?.(result.course, result.learningState);
      });
    }

    renderCourse(course) {
      this.courseLabel.textContent = course ? `当前课程：${course.courseId}` : '当前还没有课程';
      const url = course ? buildBilibiliCourseUrl(course.videoRef) : null;
      this.openLink.hidden = !url;
      if (url) {
        this.openLink.href = url;
        this.openLink.target = '_self';
        this.openLink.rel = 'noopener';
      } else {
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

  return { normalizeAccessCode, buildBilibiliCourseUrl, createAccessCodeController, AccessPanel };
});
