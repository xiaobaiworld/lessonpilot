(function initTeacherWorkspace() {
  const lessonUrl = 'https://www.bilibili.com/video/BV1WW4y1e7GL/';
  const fixedBvid = 'BV1WW4y1e7GL';
  let captions = [];
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
  const chooseSubtitleFileButton = document.querySelector('#choose-subtitle-file');
  const subtitleFileName = document.querySelector('#subtitle-file-name');
  const subtitleFileError = document.querySelector('#subtitle-file-error');
  const timelineSourceSummary = document.querySelector('#timeline-source-summary');
  const captionImportStatus = document.querySelector('#caption-import-status');
  const captionStatusIcon = document.querySelector('#caption-status-icon');
  const courseTitleInput = document.querySelector('#course-title-input');
  const lessonTitleInput = document.querySelector('#lesson-title-input');
  const apiStatusLabel = document.querySelector('#api-status-label');
  const apiStatusDot = document.querySelector('#api-status-dot');
  const saveLabel = document.querySelector('#save-label');
  const workspaceNav = document.querySelector('#workspace-nav');
  const workspaceAccount = document.querySelector('#workspace-account');
  const workspaceOwner = document.querySelector('#workspace-owner');
  const loginPassword = document.querySelector('#login-password');
  const togglePassword = document.querySelector('#toggle-password');
  const loginButton = document.querySelector('#login-button');
  const continueCourseButton = document.querySelector('#continue-course');
  const saveTimelineButton = document.querySelector('#save-timeline');
  const publishCourseButton = document.querySelector('#publish-course');
  const createAccessCodeButton = document.querySelector('#create-access-code');
  const accessCodePanel = document.querySelector('#access-code-panel');
  const accessCodeValue = document.querySelector('#access-code-value');
  const copyAccessCodeButton = document.querySelector('#copy-access-code');
  const publishVersionLabel = document.querySelector('#publish-version');
  const courseRecordStatus = document.querySelector('#course-record-status');
  const subtitleRecordStatus = document.querySelector('#subtitle-record-status');
  const courseActionKicker = document.querySelector('#course-action-kicker');
  const courseActionTitle = document.querySelector('#course-action-title');
  const timelineTitle = document.querySelector('#timeline-title');
  const timelineLessonTitle = document.querySelector('#timeline-lesson-title');
  const timelineDurationLabel = document.querySelector('#timeline-duration-label');
  const nodePluginBar = document.querySelector('#node-plugin-bar');
  const timelineLayout = document.querySelector('.timeline-layout');

  let toastTimer = null;
  let publishInProgress = false;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const formatTime = (seconds) => {
    const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    return `${String(minutes).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
  };
  const setButtonBusy = (button, busy, busyLabel, idleLabel) => {
    button.disabled = busy;
    button.textContent = busy ? busyLabel : idleLabel;
  };
  const syncEditorNodesToWorkspace = () => {
    state.nodes = state.editor?.getState().nodes || state.nodes;
    updateNodeCount();
  };
  const setEditorInteractionLocked = (locked) => {
    nodePluginBar.inert = locked;
    timelineLayout.inert = locked;
    nodePluginBar.setAttribute('aria-busy', String(locked));
    timelineLayout.setAttribute('aria-busy', String(locked));
  };
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
    document.title = timeline
      ? `${state.course?.title || '课程设计'} · KnownMap 互动课程工具`
      : '我的课程 · KnownMap 互动课程工具';
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const resetPasswordVisibility = () => {
    loginPassword.type = 'password';
    togglePassword.textContent = '显示';
    togglePassword.setAttribute('aria-label', '显示密码');
    togglePassword.setAttribute('aria-pressed', 'false');
  };
  const updateCourseWorkspace = () => {
    const hasCourse = Boolean(state.course);
    const hasLesson = Boolean(state.lesson);
    courseRecordStatus.textContent = hasLesson ? '已创建' : '尚未创建';
    courseRecordStatus.classList.toggle('is-ready', hasLesson);
    courseActionKicker.textContent = hasLesson ? '课程资料已保存' : '课程尚未创建';
    courseActionTitle.textContent = hasLesson
      ? `${state.course.title} · ${state.lesson.title}`
      : '准备好课程信息后开始设计';
    continueCourseButton.textContent = hasLesson ? '继续设计课程' : '创建课程并开始设计';
    courseTitleInput.readOnly = hasCourse;
    lessonTitleInput.readOnly = hasLesson;
    courseUrlInput.readOnly = hasLesson;
    document.querySelector('#confirm-course-url').hidden = hasLesson;
  };
  const updateTimelineContext = () => {
    const courseTitle = state.course?.title || courseTitleInput.value.trim();
    const lessonTitle = state.lesson?.title || lessonTitleInput.value.trim();
    timelineTitle.textContent = courseTitle || '课程设计';
    timelineLessonTitle.textContent = lessonTitle || '课节';
    document.querySelector('#timeline-course-title').textContent = courseTitle || '未命名课程';
    const duration = state.editor?.getState().durationSeconds || 0;
    timelineDurationLabel.textContent = formatTime(duration);
  };
  const resetWorkspaceSessionState = () => {
    state.course = null;
    state.lesson = null;
    state.nodes = [];
    state.publishVersion = null;
    captions = [];
    state.editor.setCaptions(captions);
    state.editor.setNodes([]);
    courseTitleInput.value = '';
    lessonTitleInput.value = '';
    courseUrlInput.value = lessonUrl;
    courseUrlError.hidden = true;
    timelineSourceSummary.textContent = '尚未创建课节';
    timelineTitle.textContent = '课程设计';
    timelineLessonTitle.textContent = '课节';
    publishVersionLabel.textContent = '—';
    accessCodePanel.hidden = true;
    accessCodeValue.textContent = '尚未创建';
    createAccessCodeButton.disabled = false;
    createAccessCodeButton.textContent = '创建授权码';
    copyAccessCodeButton.disabled = true;
    subtitleFileInput.value = '';
    subtitleFileName.textContent = '选择 SRT 或 VTT 字幕文件';
    subtitleRecordStatus.textContent = '未导入';
    subtitleRecordStatus.classList.remove('is-ready');
    captionImportStatus.textContent = '尚未导入字幕';
    captionStatusIcon.textContent = '—';
    saveLabel.textContent = '草稿未保存';
    updateCourseWorkspace();
    updateTimelineContext();
  };
  const showAuth = (message = '') => {
    authView.hidden = false;
    homeView.hidden = true;
    timelineView.hidden = true;
    workspaceNav.hidden = true;
    workspaceAccount.hidden = true;
    document.title = '登录 · KnownMap 互动课程工具';
    const error = document.querySelector('#login-error');
    error.textContent = message;
    error.hidden = !message;
  };
  const showWorkspace = () => {
    authView.hidden = true;
    workspaceNav.hidden = false;
    workspaceAccount.hidden = false;
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
    updateTimelineContext();
  };

  state.editor = window.KnownMapVisualNodeEditor.createEditor({
    document,
    captions,
    nodes: [],
    minimumDurationSeconds: 222,
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
    saveLabel.textContent = '正在保存…';
    setButtonBusy(saveTimelineButton, true, '正在保存…', '保存草稿');
    try {
      const saved = await api.saveDraft(state.lesson.id, buildDraftPayload());
      state.nodes = saved.config.nodes;
      state.lesson.has_draft = true;
      state.editor.setNodes(state.nodes);
      saveLabel.textContent = '草稿已保存';
      updateNodeCount();
      if (!silent) showToast(`草稿已保存，共 ${saved.node_count} 个节点。`);
      return saved;
    } catch (error) {
      saveLabel.textContent = '保存失败';
      throw error;
    } finally {
      if (!publishInProgress) {
        setButtonBusy(saveTimelineButton, false, '正在保存…', '保存草稿');
      } else {
        saveTimelineButton.disabled = true;
        saveTimelineButton.textContent = '保存草稿';
      }
    }
  };
  const confirmCourseUrl = () => {
    let candidate;
    try { candidate = new URL(courseUrlInput.value.trim()); } catch (error) { candidate = null; }
    const valid = candidate?.hostname === 'www.bilibili.com'
      && candidate.pathname.replace(/\/$/, '') === `/video/${fixedBvid}`;
    courseUrlError.hidden = valid;
    if (!valid) {
      courseUrlError.textContent = '当前开发阶段仅支持指定课程视频 BV1WW4y1e7GL。';
      return false;
    }
    courseUrlInput.value = lessonUrl;
    showToast('视频链接验证通过。');
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
    subtitleFileName.textContent = file.name;
    subtitleRecordStatus.textContent = `${captions.length} 段字幕`;
    subtitleRecordStatus.classList.add('is-ready');
    timelineSourceSummary.textContent = `${fixedBvid} · ${state.lesson?.title || lessonTitleInput.value.trim()}`;
    captionImportStatus.textContent = `已导入 ${captions.length} 段字幕`;
    captionStatusIcon.textContent = '✓';
    state.editor.setCaptions(captions);
    syncEditorNodesToWorkspace();
    saveLabel.textContent = '草稿未保存';
    updateTimelineContext();
    showToast(`已导入 ${captions.length} 段字幕。`);
  };
  const ensureCourse = async () => {
    if (!state.course && !courseTitleInput.reportValidity()) {
      throw new Error('请填写课程名称。');
    }
    if (!state.lesson && !lessonTitleInput.reportValidity()) {
      throw new Error('请填写课节名称。');
    }
    if (!state.lesson && !confirmCourseUrl()) throw new Error('课程链接未通过校验。');
    if (!state.course) {
      state.course = await api.createCourse({
        title: courseTitleInput.value.trim(),
        description: '由 KnownMap 互动课程工具创建'
      });
    }
    if (!state.lesson) {
      state.lesson = await api.createLesson(state.course.id, {
        title: lessonTitleInput.value.trim(),
        video_ref: { platform: 'bilibili', video_id: fixedBvid }
      });
    }
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
    updateCourseWorkspace();
    setRoute('timeline');
  };
  const loadWorkspace = async () => {
    const result = await api.listCourses();
    const existing = result.items[0];
    if (!existing) {
      setApiStatus('服务正常', true);
      workspaceOwner.textContent = session.current().display_name;
      subtitleRecordStatus.textContent = '未导入';
      subtitleRecordStatus.classList.remove('is-ready');
      captionImportStatus.textContent = '尚未导入字幕';
      captionStatusIcon.textContent = '—';
      updateCourseWorkspace();
      updateTimelineContext();
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
    timelineSourceSummary.textContent = state.lesson
      ? `${fixedBvid} · ${state.lesson.title}`
      : '尚未创建课节';
    subtitleRecordStatus.textContent = '本次浏览器未导入';
    subtitleRecordStatus.classList.remove('is-ready');
    captionImportStatus.textContent = '尚未导入字幕';
    captionStatusIcon.textContent = '—';
    syncEditor();
    updateCourseWorkspace();
    workspaceOwner.textContent = session.current().display_name;
    setApiStatus(session.current().display_name, true);
  };
  const createAccessCode = async () => {
    if (!state.course) return;
    setButtonBusy(createAccessCodeButton, true, '正在创建…', '创建授权码');
    try {
      const result = await api.createAccessCode(state.course.id);
      accessCodeValue.textContent = result.access_code;
      copyAccessCodeButton.disabled = false;
      createAccessCodeButton.textContent = '已创建';
      showToast('授权码已创建。');
    } catch (error) {
      setButtonBusy(createAccessCodeButton, false, '正在创建…', '创建授权码');
      throw error;
    }
  };
  const publishCourse = async () => {
    if (publishCourseButton.disabled) return;
    const saveWasDisabled = saveTimelineButton.disabled;
    publishInProgress = true;
    setButtonBusy(publishCourseButton, true, '正在发布…', '发布课程');
    saveTimelineButton.disabled = true;
    setEditorInteractionLocked(true);
    try {
      await saveDraft(true);
      const result = await api.publishCourse(state.course.id);
      state.publishVersion = result.version;
      publishVersionLabel.textContent = `v${result.version}`;
      accessCodePanel.hidden = false;
      showToast(`课程已发布，版本 v${result.version}。`);
    } finally {
      publishInProgress = false;
      saveTimelineButton.disabled = saveWasDisabled;
      setEditorInteractionLocked(false);
      setButtonBusy(publishCourseButton, false, '正在发布…', '发布课程');
    }
  };
  const login = async (event) => {
    event.preventDefault();
    const error = document.querySelector('#login-error');
    error.hidden = true;
    loginButton.disabled = true;
    loginButton.textContent = '正在登录…';
    try {
      await session.login(
        document.querySelector('#login-name').value.trim(),
        loginPassword.value
      );
      loginPassword.value = '';
      resetPasswordVisibility();
      await loadWorkspace();
      showWorkspace();
    } catch (reason) {
      error.textContent = reason.message || '登录失败，请检查账号和密码。';
      error.hidden = false;
      loginPassword.focus();
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = '登录';
    }
  };

  document.querySelector('#login-form').addEventListener('submit', login);
  togglePassword.addEventListener('click', () => {
    loginPassword.type = loginPassword.type === 'password' ? 'text' : 'password';
    const visible = loginPassword.type === 'text';
    togglePassword.textContent = visible ? '隐藏' : '显示';
    togglePassword.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
    togglePassword.setAttribute('aria-pressed', String(visible));
    loginPassword.focus();
  });
  document.querySelector('#logout-button').addEventListener('click', async () => {
    await session.logout().catch(() => {});
    resetWorkspaceSessionState();
    loginPassword.value = '';
    resetPasswordVisibility();
    window.history.replaceState(null, '', '#home');
    showAuth();
  });
  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => setRoute(button.dataset.route));
  });
  document.querySelector('#continue-course')?.addEventListener('click', async () => {
    setButtonBusy(continueCourseButton, true, '正在准备课程…', state.lesson ? '继续设计课程' : '创建课程并开始设计');
    try {
      await ensureCourse();
    } catch (error) {
      showToast(error.message || '课程初始化失败。');
    } finally {
      setButtonBusy(continueCourseButton, false, '正在准备课程…', state.lesson ? '继续设计课程' : '创建课程并开始设计');
    }
  });
  document.querySelector('#confirm-course-url').addEventListener('click', () => {
    if (!state.lesson) confirmCourseUrl();
  });
  chooseSubtitleFileButton.addEventListener('click', () => subtitleFileInput.click());
  subtitleFileInput.addEventListener('change', importSubtitleFile);
  document.querySelector('#preview-timeline').addEventListener('click', () => {
    window.open(lessonUrl, '_blank', 'noopener,noreferrer');
  });
  document.querySelector('#refresh-analysis').addEventListener('click', () => {
    state.editor.setCaptions(captions);
    syncEditorNodesToWorkspace();
    updateTimelineContext();
    showToast('时间线已刷新。');
  });
  document.querySelector('#save-timeline').addEventListener('click', async () => {
    if (saveTimelineButton.disabled) return;
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
    showToast('已复制授权码。');
  });
  document.querySelector('#zoom-in').addEventListener('click', () => state.editor.adjustZoom(0.25));
  document.querySelector('#zoom-out').addEventListener('click', () => state.editor.adjustZoom(-0.25));

  updateNodeCount();
  updateCourseWorkspace();
  updateTimelineContext();
  resetPasswordVisibility();
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
