(function initTeacherWorkspace() {
  const lessonUrl = 'https://www.bilibili.com/video/BV1WW4y1e7GL/';
  const fixedBvid = 'BV1WW4y1e7GL';
  let captions = [
    { time: '00:00', end: '00:18', text: 'Today we are going to talk about strong interview answers.' },
    { time: '00:18', end: '00:35', text: 'Many candidates say: I am hardworking and I am a team player.' },
    { time: '00:35', end: '00:51', text: 'A strong answer needs a specific example.' },
    { time: '00:51', end: '01:08', text: 'The example should show what you did and what changed.' },
    { time: '01:08', end: '01:18', text: 'Listen to the structure one more time.' },
    { time: '01:18', end: '01:34', text: 'I noticed a problem, so I suggested a different approach.' },
    { time: '01:34', end: '01:49', text: 'This is much more memorable than a general adjective.' },
    { time: '01:49', end: '02:06', text: 'Now try to connect the structure to your own experience.' },
    { time: '02:06', end: '02:25', text: 'Think of one difficult situation you have solved.' },
    { time: '02:25', end: '02:48', text: 'Start with the situation, then explain your action.' },
    { time: '02:48', end: '03:12', text: 'Finally, tell us the result and what you learned.' },
    { time: '03:12', end: '03:42', text: 'That is how a recorded lesson becomes practice.' }
  ];
  const eventCopy = {
    attention: ['重点提醒', '让这一句被记住', '播放到这里时，课程会暂停并显示这条提醒。'],
    voice: ['选择题', '让学生判断理解', '播放到这里时，课程会暂停并显示两个选项。'],
    activity: ['填空题', '让学生回忆关键词', '播放到这里时，课程会暂停并要求学生输入答案。'],
    ai: ['问答题', '让学生组织自己的回答', '播放到这里时，课程会暂停并显示老师的参考反馈。']
  };
  const interactionByEvent = {
    attention: 'notice',
    voice: 'choice',
    activity: 'blank',
    ai: 'free_text'
  };
  const eventByInteraction = {
    notice: 'attention',
    choice: 'voice',
    blank: 'activity',
    free_text: 'ai'
  };
  const state = {
    course: null,
    lesson: null,
    nodes: [],
    publishVersion: null,
    selectedCaption: 2,
    selectedEvent: 'attention'
  };
  let toastTimer = null;

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
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const inputField = (id, label, value, type = 'text') => {
    const wrapper = el('label', 'node-field');
    wrapper.append(el('span', '', label));
    const input = el('input');
    input.id = id;
    input.type = type;
    input.value = value || '';
    wrapper.append(input);
    return wrapper;
  };
  const textareaField = (id, label, value) => {
    const wrapper = el('label', 'node-field node-field-wide');
    wrapper.append(el('span', '', label));
    const input = el('textarea');
    input.id = id;
    input.value = value || '';
    wrapper.append(input);
    return wrapper;
  };
  const secondsFromTime = (value) => {
    const parts = value.split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
  };
  const currentNode = () => state.nodes.find((node) => {
    const captionId = node.trigger?.captionId;
    return captionId === `caption-${state.selectedCaption}`;
  });
  const nodeEvent = (node) => eventByInteraction[node?.interaction] || null;
  const nodeForCaption = (index) => state.nodes.find(
    (node) => node.trigger?.captionId === `caption-${index}`
  );

  const renderNodeFields = (type, node = null) => {
    const fields = document.querySelector('#node-fields');
    fields.replaceChildren();
    const display = node?.display || {};
    const evaluation = node?.evaluation || {};
    fields.append(inputField('event-label-input', '标题', display.title || eventCopy[type][0]));
    if (type === 'attention') {
      fields.append(textareaField('node-body-input', '提醒内容', display.body || '请记住这一句，并注意它和上一句的区别。'));
    }
    if (type === 'voice') {
      fields.append(textareaField('node-prompt-input', '题目', display.prompt || '哪一个选项最能说明这句话的重点？'));
      fields.append(inputField('node-option-a', '选项 A', display.options?.[0]?.label || '只说自己的品质'));
      fields.append(inputField('node-option-b', '选项 B', display.options?.[1]?.label || '给出具体经历'));
      const answer = el('label', 'node-field');
      answer.append(el('span', '', '正确答案'));
      const select = el('select');
      select.id = 'node-answer';
      [['a', '选项 A'], ['b', '选项 B']].forEach(([value, label]) => {
        const option = el('option', '', label);
        option.value = value;
        option.selected = (evaluation.answer || 'b') === value;
        select.append(option);
      });
      answer.append(select);
      fields.append(answer);
      fields.append(textareaField('node-explanation-input', '答案解释', evaluation.explanation || '具体经历能让答案可验证。'));
    }
    if (type === 'activity') {
      fields.append(textareaField('node-prompt-input', '题目', display.prompt || '请填入这句话中最关键的表达。'));
      fields.append(inputField('node-answers-input', '可接受答案', (evaluation.acceptedAnswers || ['suggested']).join(', ')));
      fields.append(textareaField('node-explanation-input', '答案解释', evaluation.explanation || '答案需要保留具体动作和结果。'));
    }
    if (type === 'ai') {
      fields.append(textareaField('node-prompt-input', '问题', display.prompt || '请用自己的经历说明你如何解决一个困难情况。'));
      fields.append(textareaField('node-feedback-input', '参考反馈', evaluation.referenceFeedback || '回答应包含情境、行动和结果三个部分。'));
    }
  };
  const selectEvent = (type) => {
    state.selectedEvent = type;
    const [label, title, copy] = eventCopy[type];
    const node = currentNode();
    document.querySelector('#event-detail').hidden = false;
    document.querySelector('#event-detail-label').textContent = label;
    document.querySelector('#event-detail-title').textContent = title;
    document.querySelector('#event-detail-copy').textContent = copy;
    renderNodeFields(type, node);
    document.querySelectorAll('.event-option').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.event === type);
    });
  };
  const setCaptionContext = (index) => {
    state.selectedCaption = index;
    document.querySelector('#selected-caption').textContent = `“${captions[index].text}”`;
    document.querySelector('.event-panel-head .eyebrow').textContent = `当前字幕 · ${captions[index].time}`;
    selectEvent(state.nodes.length && nodeEvent(nodeForCaption(index))
      ? nodeEvent(nodeForCaption(index))
      : state.selectedEvent);
  };
  const renderCaptions = () => {
    const list = document.querySelector('#caption-list');
    list.replaceChildren();
    captions.forEach((caption, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `caption-row${index === state.selectedCaption ? ' is-selected' : ''}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === state.selectedCaption));
      const body = el('span', 'caption-body');
      body.append(el('span', 'caption-text', caption.text));
      if (index === 2) body.append(el('small', '', '知识点：用具体经历替代抽象形容词'));
      item.append(el('span', 'caption-time', caption.time), body);
      const node = nodeForCaption(index);
      if (node) {
        item.append(el('span', `caption-event event-${nodeEvent(node)}`, eventCopy[nodeEvent(node)][0]));
      } else if ([0, 6, 8, 9].includes(index)) {
        item.append(el('span', 'ai-suggestion', 'AI 建议'));
      } else {
        item.append(el('span', 'caption-add', '＋'));
      }
      item.addEventListener('click', () => {
        setCaptionContext(index);
        renderCaptions();
      });
      list.appendChild(item);
    });
    document.querySelector('#node-count').textContent = String(state.nodes.length).padStart(2, '0');
  };
  const collectNode = () => {
    const type = interactionByEvent[state.selectedEvent];
    const title = document.querySelector('#event-label-input')?.value.trim();
    const base = {
      id: `node-${Date.now()}-${state.selectedCaption}`,
      enabled: true,
      family: type === 'notice' ? 'attention' : type === 'free_text' ? 'followup' : 'practice',
      interaction: type,
      trigger: {
        kind: 'time_cross',
        timeSeconds: secondsFromTime(captions[state.selectedCaption].time),
        captionId: `caption-${state.selectedCaption}`
      },
      display: { title },
      evaluation: null,
      effects: { pause: true }
    };
    if (type === 'notice') {
      base.display.body = document.querySelector('#node-body-input').value.trim();
    }
    if (type === 'choice') {
      base.display.prompt = document.querySelector('#node-prompt-input').value.trim();
      base.display.options = [
        { id: 'a', label: document.querySelector('#node-option-a').value.trim() },
        { id: 'b', label: document.querySelector('#node-option-b').value.trim() }
      ];
      base.evaluation = {
        answer: document.querySelector('#node-answer').value,
        explanation: document.querySelector('#node-explanation-input').value.trim()
      };
    }
    if (type === 'blank') {
      base.display.prompt = document.querySelector('#node-prompt-input').value.trim();
      base.evaluation = {
        acceptedAnswers: document.querySelector('#node-answers-input').value
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        normalize: ['trim', 'casefold'],
        explanation: document.querySelector('#node-explanation-input').value.trim()
      };
    }
    if (type === 'free_text') {
      base.display.prompt = document.querySelector('#node-prompt-input').value.trim();
      base.evaluation = {
        referenceFeedback: document.querySelector('#node-feedback-input').value.trim()
      };
    }
    return base;
  };
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
    document.querySelector('#save-label').textContent = '草稿已保存';
    renderCaptions();
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
    state.selectedCaption = 0;
    renderCaptions();
    setCaptionContext(0);
    setRoute('timeline');
    showToast(`已导入 ${captions.length} 段字幕。选择一段开始设计。`);
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
    } else {
      state.nodes = [];
    }
    renderCaptions();
    setCaptionContext(state.selectedCaption);
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
    } else if (state.lesson) {
      lessonTitleInput.value = state.lesson.title;
    }
    document.querySelector('#timeline-course-title').textContent = state.course.title;
    setApiStatus(`已登录 · ${session.current().display_name}`, true);
    renderCaptions();
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
    showAuth();
  });
  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => setRoute(button.dataset.route));
  });
  document.querySelector('#continue-course')?.addEventListener('click', async () => {
    try {
      await ensureCourse();
      setRoute('timeline');
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
    showToast('已根据当前字幕重新整理建议。');
  });
  document.querySelector('#accept-suggestion').addEventListener('click', () => {
    selectEvent('activity');
    showToast('建议已转成可修改的填空题。');
  });
  document.querySelector('#ignore-suggestion').addEventListener('click', () => {
    showToast('已忽略这条建议。');
  });
  document.querySelector('#simulate-class').addEventListener('click', () => {
    showToast('学生课堂模拟将在插件接入后使用已发布课程。');
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
  document.querySelectorAll('.event-option').forEach((button) => {
    button.addEventListener('click', () => selectEvent(button.dataset.event));
  });
  document.querySelector('#add-event').addEventListener('click', () => {
    try {
      const node = collectNode();
      state.nodes = state.nodes.filter((item) => item.trigger.captionId !== node.trigger.captionId);
      state.nodes.push(node);
      renderCaptions();
      showToast(`${eventCopy[state.selectedEvent][0]}已加入 ${captions[state.selectedCaption].time}。点击“保存草稿”写入本地 API。`);
    } catch (error) {
      showToast('节点内容不完整，请补齐表单。');
    }
  });
  document.querySelector('#zoom-in').addEventListener('click', () => showToast('时间线缩放到 125%。'));
  document.querySelector('#zoom-out').addEventListener('click', () => showToast('时间线缩放到 80%。'));

  renderCaptions();
  selectEvent('attention');
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
