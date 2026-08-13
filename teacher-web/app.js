(function initTeacherWorkspace() {
  const lessonUrl = 'https://www.bilibili.com/video/BV1WW4y1e7GL/';
  const fixedBvid = 'BV1WW4y1e7GL';
  let captions = [
    { time: '00:00', end: '00:18', text: 'Today we are going to talk about strong interview answers.', event: null },
    { time: '00:18', end: '00:35', text: 'Many candidates say: I am hardworking and I am a team player.', event: null },
    { time: '00:35', end: '00:51', text: 'A strong answer needs a specific example.', event: { type: 'attention', label: '这里很重要' } },
    { time: '00:51', end: '01:08', text: 'The example should show what you did and what changed.', event: null },
    { time: '01:08', end: '01:18', text: 'Listen to the structure one more time.', event: { type: 'voice', label: '老师补充' } },
    { time: '01:18', end: '01:34', text: 'I noticed a problem, so I suggested a different approach.', event: { type: 'activity', label: '填空练习' } },
    { time: '01:34', end: '01:49', text: 'This is much more memorable than a general adjective.', event: null },
    { time: '01:49', end: '02:06', text: 'Now try to connect the structure to your own experience.', event: { type: 'ai', label: '迁移追问' } },
    { time: '02:06', end: '02:25', text: 'Think of one difficult situation you have solved.', event: null },
    { time: '02:25', end: '02:48', text: 'Start with the situation, then explain your action.', event: null },
    { time: '02:48', end: '03:12', text: 'Finally, tell us the result and what you learned.', event: null },
    { time: '03:12', end: '03:42', text: 'That is how a recorded lesson becomes practice.', event: null }
  ];
  const eventCopy = {
    attention: ['注意力爆发', '让这一句被记住', '播放到这里时，关键词会短暂放大并出现星星效果。', '这里很重要'],
    voice: ['老师语音', '在这里补一句', '播放到这里时，视频原声会降低，学生听到老师提前录好的提醒。', '老师补充'],
    activity: ['互动练习', '让学生马上动手', '在这里暂停视频，出现一个老师预先配置好的练习题。', '填空练习'],
    ai: ['点评与追问', '只沿着一个方向追问', '系统只检查老师选定的维度，不会变成没有边界的聊天框。', '迁移追问']
  };
  let selectedCaption = 2;
  let selectedEvent = 'attention';
  let toastTimer = null;
  const homeView = document.querySelector('#home-view');
  const timelineView = document.querySelector('#timeline-view');
  const toast = document.querySelector('#toast');
  const courseUrlInput = document.querySelector('#course-url-input');
  const courseUrlError = document.querySelector('#course-url-error');
  const subtitleFileInput = document.querySelector('#subtitle-file-input');
  const subtitleFileName = document.querySelector('#subtitle-file-name');
  const subtitleFileError = document.querySelector('#subtitle-file-error');
  const timelineSourceSummary = document.querySelector('#timeline-source-summary');
  const captionImportStatus = document.querySelector('#caption-import-status');

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const showToast = (message) => {
    window.clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('is-visible'); toast.setAttribute('aria-hidden', 'false');
    toastTimer = window.setTimeout(() => { toast.classList.remove('is-visible'); toast.setAttribute('aria-hidden', 'true'); }, 2600);
  };
  const setRoute = (route) => {
    const timeline = route === 'timeline'; homeView.hidden = timeline; timelineView.hidden = !timeline;
    document.querySelectorAll('[data-route]').forEach((button) => button.classList.toggle('is-active', button.dataset.route === route));
    window.history.replaceState(null, '', timeline ? '#timeline' : '#home');
    document.title = timeline ? '课堂设计 · LessonPilot Studio' : 'LessonPilot Studio · 我的课程'; window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const renderCaptions = () => {
    const list = document.querySelector('#caption-list'); list.replaceChildren();
    captions.forEach((caption, index) => {
      const item = document.createElement('button'); item.type = 'button'; item.className = `caption-row${index === selectedCaption ? ' is-selected' : ''}`; item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(index === selectedCaption));
      const suggestion = !caption.event && [0, 6, 8, 9].includes(index) ? '<span class="ai-suggestion">AI 建议</span>' : '';
      item.innerHTML = `<span class="caption-time">${caption.time}</span><span class="caption-body"><span class="caption-text">${caption.text}</span>${index === 2 ? '<small>知识点：用具体经历替代抽象形容词 · 易错点：只描述品质，没有证据</small>' : ''}</span>${caption.event ? `<span class="caption-event event-${caption.event.type}">${caption.event.label}</span>` : suggestion || '<span class="caption-add">＋</span>'}`;
      item.addEventListener('click', () => { setCaptionContext(index); renderCaptions(); }); list.appendChild(item);
    });
  };
  const selectEvent = (type) => {
    selectedEvent = type; const [label, title, copy, input] = eventCopy[type];
    document.querySelector('#event-detail').hidden = false; document.querySelector('#event-detail-label').textContent = label; document.querySelector('#event-detail-title').textContent = title; document.querySelector('#event-detail-copy').textContent = copy; document.querySelector('#event-label-input').value = input;
    document.querySelectorAll('.event-option').forEach((button) => button.classList.toggle('is-active', button.dataset.event === type));
  };
  const setCaptionContext = (index) => {
    selectedCaption = index;
    document.querySelector('#selected-caption').textContent = `“${captions[index].text}”`;
    document.querySelector('.event-panel-head .eyebrow').textContent = `当前字幕 · ${captions[index].time}`;
  };
  const confirmCourseUrl = () => {
    let candidate;
    try { candidate = new URL(courseUrlInput.value.trim()); } catch (error) { candidate = null; }
    const isExpectedCourse = candidate?.hostname === 'www.bilibili.com' && candidate.pathname.replace(/\/$/, '') === `/video/${fixedBvid}`;
    courseUrlError.hidden = isExpectedCourse;
    if (!isExpectedCourse) {
      courseUrlError.textContent = '当前 W0 只接受固定 B 站样例链接。';
      return;
    }
    courseUrlInput.value = lessonUrl;
    showToast('课程链接已确认。下一步导入这节课的字幕文件。');
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
    timelineSourceSummary.textContent = `BV1WW4y1e7GL · ${captions.length} 段导入字幕已整理成可设计的课堂时间线`;
    captionImportStatus.textContent = `已导入 ${captions.length} 段字幕`;
    setCaptionContext(0);
    renderCaptions();
    setRoute('timeline');
    showToast(`已导入 ${captions.length} 段字幕。选择一段开始设计课堂动作。`);
  };
  document.querySelectorAll('[data-route]').forEach((button) => button.addEventListener('click', () => setRoute(button.dataset.route)));
  document.querySelector('#continue-course').addEventListener('click', () => setRoute('timeline'));
  document.querySelector('#confirm-course-url').addEventListener('click', confirmCourseUrl);
  subtitleFileInput.addEventListener('change', importSubtitleFile);
  document.querySelector('#preview-timeline').addEventListener('click', () => { showToast('课堂模拟会展示学生视角，真实扩展桥将在下一步接入。'); window.open(lessonUrl, '_blank', 'noopener,noreferrer'); });
  document.querySelector('#refresh-analysis').addEventListener('click', () => showToast('原型演示：会根据已导入字幕重新整理课堂建议。'));
  document.querySelector('#accept-suggestion').addEventListener('click', () => { selectEvent('activity'); document.querySelector('#event-label-input').value = '先暂停，再让学生联系自己的经历'; showToast('AI 建议已转成可修改的课堂设计。'); });
  document.querySelector('#ignore-suggestion').addEventListener('click', () => showToast('已忽略这条建议，其他课堂设计不会受影响。'));
  document.querySelector('#simulate-class').addEventListener('click', () => showToast('课堂模拟将展示不同学生回答后的课程反馈，当前为界面原型。'));
  document.querySelector('#save-timeline').addEventListener('click', () => { document.querySelector('#save-label').textContent = '刚刚保存'; showToast('课程时间线已保存到当前页面状态。'); });
  document.querySelectorAll('.event-option').forEach((button) => button.addEventListener('click', () => selectEvent(button.dataset.event)));
  document.querySelector('#add-event').addEventListener('click', () => { captions[selectedCaption].event = { type: selectedEvent, label: document.querySelector('#event-label-input').value || eventCopy[selectedEvent][3] }; renderCaptions(); showToast(`AI 已生成${eventCopy[selectedEvent][0]}，并加入 ${captions[selectedCaption].time} 的课堂设计。`); });
  document.querySelector('#zoom-in').addEventListener('click', () => showToast('时间线缩放到 125%（原型状态）。'));
  document.querySelector('#zoom-out').addEventListener('click', () => showToast('时间线缩放到 80%（原型状态）。'));
  renderCaptions(); selectEvent('attention'); setRoute(window.location.hash === '#timeline' ? 'timeline' : 'home');
})();
