(function initTeacherWorkspace() {
  const lessonUrl = 'https://www.bilibili.com/video/BV1WW4y1e7GL/';
  const fixedBvid = 'BV1WW4y1e7GL';
  let captions = [
    { id: 'caption-1', time: '00:00', end: '00:18', startSeconds: 0, endSeconds: 18, text: 'Today we are going to talk about strong interview answers.' },
    { id: 'caption-2', time: '00:18', end: '00:35', startSeconds: 18, endSeconds: 35, text: 'Many candidates say: I am hardworking and I am a team player.' },
    { id: 'caption-3', time: '00:35', end: '00:51', startSeconds: 35, endSeconds: 51, text: 'A strong answer needs a specific example.' },
    { id: 'caption-4', time: '00:51', end: '01:08', startSeconds: 51, endSeconds: 68, text: 'The example should show what you did and what changed.' },
    { id: 'caption-5', time: '01:08', end: '01:18', startSeconds: 68, endSeconds: 78, text: 'Listen to the structure one more time.' },
    { id: 'caption-6', time: '01:18', end: '01:34', startSeconds: 78, endSeconds: 94, text: 'I noticed a problem, so I suggested a different approach.' },
    { id: 'caption-7', time: '01:34', end: '01:49', startSeconds: 94, endSeconds: 109, text: 'This is much more memorable than a general adjective.' },
    { id: 'caption-8', time: '01:49', end: '02:06', startSeconds: 109, endSeconds: 126, text: 'Now try to connect the structure to your own experience.' },
    { id: 'caption-9', time: '02:06', end: '02:25', startSeconds: 126, endSeconds: 145, text: 'Think of one difficult situation you have solved.' },
    { id: 'caption-10', time: '02:25', end: '02:48', startSeconds: 145, endSeconds: 168, text: 'Start with the situation, then explain your action.' },
    { id: 'caption-11', time: '02:48', end: '03:12', startSeconds: 168, endSeconds: 192, text: 'Finally, tell us the result and what you learned.' },
    { id: 'caption-12', time: '03:12', end: '03:42', startSeconds: 192, endSeconds: 222, text: 'That is how a recorded lesson becomes practice.' }
  ];
  const state = {
    course: null,
    lesson: null,
    nodes: [],
    publishVersion: null,
    editor: null
  };

  const api = window.KnownMapApi;
  const session = window.KnownMapSession;
  const homeView = document.querySelector('#home-view');
  const timelineView = document.querySelector('#timeline-view');
  const authView = document.querySelector('#auth-view');
  const toast = document.querySelector('#toast');
  const courseUrlInput = document.querySelector('#course-url-input');
  const courseUrlError = document.querySelector('#course-url-error');
  const subtitleFileInput = document.querySelector('#subtitle-file-input');
  const subtitleFileName = document.querySelector('#subtitle-file-name');
  const subtitleFileError = document.querySelector('#subtitle-file-error');
  const timelineSourceSummary = document.querySelector('#timeline-source-summary');
  const captionImportStatus = document.querySelector('#caption-import-status');
  const courseTitleInput = document.querySelector('#course-title-input');
  const lessonTitleInput = document.querySelector('#lesson-title-input');
  const apiStatusLabel = document.querySelector('#api-status-label');
  const apiStatusDot = document.querySelector('#api-status-dot');
  const saveLabel = document.querySelector('#save-label');

  let toastTimer = null;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toast.setAttribute('aria-hidden', 'false');
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.setAttribute('aria-hidden', 'true');
    }, 2800);
  };
  const setApiStatus = (message, healthy) => {
    apiStatusLabel.textContent = message;
    apiStatusDot.classList.toggle('is-healthy', healthy);
  };
  const setRoute = (route) => {
    const timeline = route === 'timeline';
    homeView.hidden = timeline;
    timelineView.hidden = !timeline;
    document.querySelectorAll('[data-route]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.route === route);
    });
    window.history.replaceState(null, '', timeline ? '#timeline' : '#home');
    document.title = timeline ? '课堂设计 · KnownMap Studio' : 'KnownMap Studio · 我的课程';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const showAuth = (message = '') => {
    authView.hidden = false;
    homeView.hidden = true;
    timelineView.hidden = true;
    document.querySelector('#logout-button').hidden = true;
    setApiStatus('请先登录本地 API', false);
    const error = document.querySelector('#login-error');
    error.textContent = message;
    error.hidden = !message;
  };
  const showWorkspace = () => {
    authView.hidden = true;
    document.querySelector('#logout-button').hidden = false;
    setRoute(window.location.hash === '#timeline' ? 'timeline' : 'home');
  };
  const updateNodeCount = () => {
    document.querySelector('#node-count').textContent = String(state.nodes.length).padStart(2, '0');
  };
  const syncEditor = () => {
    if (!state.editor) return;
    state.editor.setCaptions(captions);
    state.editor.setNodes(state.nodes);
    updateNodeCount();
  };

  state.editor = window.KnownMapVisualNodeEditor.createEditor({
    document,
    captions,
    nodes: [],
    logger: window.KnownMapEditorLogger.createEditorLogger(),
    onChange(nodes) {
      state.nodes = nodes;
      updateNodeCount();
      saveLabel.textContent = '草稿未保存';
    },
    onDirty() {
      saveLabel.textContent = '草稿未保存';
    }
  });

  const buildDraftPayload = () => ({
    schema_version: 1,
    config: {
      nodes: clone(state.nodes).sort((left, right) => (
        left.trigger.timeSeconds - right.trigger.timeSeconds
        || left.id.localeCompare(right.id)
      ))
    }
  });
  const saveDraft = async (silent = false) => {
    if (!state.lesson) throw new Error('请先创建课程和课节。');
    const saved = await api.saveDraft(state.lesson.id, buildDraftPayload());
    state.nodes = saved.config.nodes;
    state.lesson.has_draft = true;
    state.editor.setNodes(state.nodes);
    saveLabel.textContent = '草稿已保存';
    updateNodeCount();
    if (!silent) showToast(`草稿已保存，共 ${saved.node_count} 个节点。`);
    return saved;
  };
  const confirmCourseUrl = () => {
    let candidate;
    try { candidate = new URL(courseUrlInput.value.trim()); } catch (error) { candidate = null; }
    const valid = candidate?.hostname === 'www.bilibili.com'
      && candidate.pathname.replace(/\/$/, '') === `/video/${fixedBvid}`;
    courseUrlError.hidden = valid;
    if (!valid) {
      courseUrlError.textContent = '当前阶段只接受固定 B 站测试视频。';
      return false;
    }
    courseUrlInput.value = lessonUrl;
    showToast('课程链接已确认。现在可以导入字幕并进入设计。');
    return true;
  };
  const importSubtitleFile = async () => {
    const file = subtitleFileInput.files[0];
    if (!file) return;
    const result = window.LessonPilotSubtitleParser.parseSubtitle(await file.text(), file.name);
    subtitleFileError.hidden = result.ok;
    if (!result.ok) {
      subtitleFileError.textContent = result.message;
      return;
    }
    captions = result.captions;
    subtitleFileName.textContent = `${file.name} · ${captions.length} 段已导入`;
    timelineSourceSummary.textContent = `${fixedBvid} · ${captions.length} 段字幕已整理成可设计的课堂时间线`;
    captionImportStatus.textContent = `已导入 ${captions.length} 段字幕`;
    state.editor.setCaptions(captions);
    setRoute('timeline');
    showToast(`已导入 ${captions.length} 段字幕。选择上方组件开始放置。`);
  };
  const ensureCourse = async () => {
    if (!confirmCourseUrl()) throw new Error('课程链接未通过校验。');
    if (!state.course) {
      state.course = await api.createCourse({
        title: courseTitleInput.value.trim(),
        description: '由教师工作台创建的本地测试课程'
      });
    }
    if (!state.lesson) {
      state.lesson = await api.createLesson(state.course.id, {
        title: lessonTitleInput.value.trim(),
        video_ref: { platform: 'bilibili', video_id: fixedBvid }
      });
    }
    document.querySelector('#timeline-course-title').textContent = state.course.title;
    timelineSourceSummary.textContent = `${fixedBvid} · ${state.lesson.title}`;
    if (state.lesson.has_draft) {
      const draft = await api.getDraft(state.lesson.id);
      state.nodes = draft.config.nodes;
      saveLabel.textContent = '草稿已保存';
    } else {
      state.nodes = [];
      saveLabel.textContent = '草稿未保存';
    }
    syncEditor();
    setRoute('timeline');
  };
  const loadWorkspace = async () => {
    const result = await api.listCourses();
    const existing = result.items[0];
    if (!existing) {
      setApiStatus('本地 API 已连接 · 创建第一门课程', true);
      return;
    }
    state.course = await api.getCourse(existing.id);
    state.lesson = state.course.lesson;
    courseTitleInput.value = state.course.title;
    if (state.lesson?.has_draft) {
      lessonTitleInput.value = state.lesson.title;
      const draft = await api.getDraft(state.lesson.id);
      state.nodes = draft.config.nodes;
      saveLabel.textContent = '草稿已保存';
    } else if (state.lesson) {
      lessonTitleInput.value = state.lesson.title;
      state.nodes = [];
      saveLabel.textContent = '草稿未保存';
    }
    document.querySelector('#timeline-course-title').textContent = state.course.title;
    timelineSourceSummary.textContent = state.lesson
      ? `${fixedBvid} · ${state.lesson.title}`
      : '尚未创建课节';
    syncEditor();
    setApiStatus(`已登录 · ${session.current().display_name}`, true);
  };
  const createAccessCode = async () => {
    if (!state.course) return;
    const result = await api.createAccessCode(state.course.id);
    document.querySelector('#access-code-value').textContent = result.access_code;
    document.querySelector('#copy-access-code').disabled = false;
    document.querySelector('#create-access-code').disabled = true;
    showToast('授权码已创建，只在当前页面显示。');
  };
  const publishCourse = async () => {
    await saveDraft(true);
    const result = await api.publishCourse(state.course.id);
    state.publishVersion = result.version;
    document.querySelector('#publish-version').textContent = `v${result.version}`;
    document.querySelector('#access-code-panel').hidden = false;
    showToast(`课程已发布，版本 v${result.version}。现在可以创建授权码。`);
  };
  const login = async (event) => {
    event.preventDefault();
    const error = document.querySelector('#login-error');
    error.hidden = true;
    try {
      await session.login(
        document.querySelector('#login-name').value.trim(),
        document.querySelector('#login-password').value
      );
      await loadWorkspace();
      showWorkspace();
    } catch (reason) {
      error.textContent = reason.message || '登录失败，请确认本地 API 和测试账号。';
      error.hidden = false;
      setApiStatus('本地 API 未完成登录', false);
    }
  };

  document.querySelector('#login-form').addEventListener('submit', login);
  document.querySelector('#logout-button').addEventListener('click', async () => {
    await session.logout().catch(() => {});
    state.course = null;
    state.lesson = null;
    state.nodes = [];
    state.editor.setNodes([]);
    showAuth();
  });
  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => setRoute(button.dataset.route));
  });
  document.querySelector('#continue-course')?.addEventListener('click', async () => {
    try {
      await ensureCourse();
    } catch (error) {
      showToast(error.message || '课程初始化失败。');
    }
  });
  document.querySelector('#confirm-course-url').addEventListener('click', confirmCourseUrl);
  subtitleFileInput.addEventListener('change', importSubtitleFile);
  document.querySelector('#preview-timeline').addEventListener('click', () => {
    window.open(lessonUrl, '_blank', 'noopener,noreferrer');
  });
  document.querySelector('#refresh-analysis').addEventListener('click', () => {
    showToast('已根据当前字幕重新计算时间轴。');
  });
  document.querySelector('#save-timeline').addEventListener('click', async () => {
    try { await saveDraft(); } catch (error) { showToast(error.message); }
  });
  document.querySelector('#publish-course').addEventListener('click', async () => {
    try { await publishCourse(); } catch (error) { showToast(error.message); }
  });
  document.querySelector('#create-access-code').addEventListener('click', async () => {
    try { await createAccessCode(); } catch (error) { showToast(error.message); }
  });
  document.querySelector('#copy-access-code').addEventListener('click', async () => {
    const value = document.querySelector('#access-code-value').textContent;
    await navigator.clipboard?.writeText(value);
    showToast('授权码已复制。');
  });
  document.querySelector('#zoom-in').addEventListener('click', () => state.editor.adjustZoom(0.25));
  document.querySelector('#zoom-out').addEventListener('click', () => state.editor.adjustZoom(-0.25));

  updateNodeCount();
  showAuth();
  if (session.shouldRestore()) {
    session.restore()
      .then(async () => {
        await loadWorkspace();
        showWorkspace();
      })
      .catch(() => sessionStorage.removeItem('knownmap_teacher_session'));
  }
})();
