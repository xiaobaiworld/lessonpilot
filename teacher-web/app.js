(function initTeacherWorkspace() {
  const lessonUrl = 'https://www.bilibili.com/video/BV1WW4y1e7GL/';
  const captions = [
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
    ai: ['AI 教学模板', '只沿着一个方向追问', 'AI 只检查老师选定的维度，不会变成没有边界的聊天框。', '迁移追问']
  };
  let selectedCaption = 2;
  let selectedEvent = 'attention';
  let toastTimer = null;
  const homeView = document.querySelector('#home-view');
  const timelineView = document.querySelector('#timeline-view');
  const toast = document.querySelector('#toast');

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const showToast = (message) => {
    window.clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('is-visible'); toast.setAttribute('aria-hidden', 'false');
    toastTimer = window.setTimeout(() => { toast.classList.remove('is-visible'); toast.setAttribute('aria-hidden', 'true'); }, 2600);
  };
  const setRoute = (route) => {
    const timeline = route === 'timeline'; homeView.hidden = timeline; timelineView.hidden = !timeline;
    document.querySelectorAll('[data-route]').forEach((button) => button.classList.toggle('is-active', button.dataset.route === route));
    window.history.replaceState(null, '', timeline ? '#timeline' : '#home');
    document.title = timeline ? '课程时间线 · LessonPilot' : 'LessonPilot · 我的课程'; window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const renderCaptions = () => {
    const list = document.querySelector('#caption-list'); list.replaceChildren();
    captions.forEach((caption, index) => {
      const item = document.createElement('button'); item.type = 'button'; item.className = `caption-row${index === selectedCaption ? ' is-selected' : ''}`; item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(index === selectedCaption));
      item.innerHTML = `<span class="caption-time">${caption.time}</span><span class="caption-text">${caption.text}</span>${caption.event ? `<span class="caption-event event-${caption.event.type}">${caption.event.label}</span>` : '<span class="caption-add">＋</span>'}`;
      item.addEventListener('click', () => { selectedCaption = index; document.querySelector('#selected-caption').textContent = `“${captions[index].text}”`; document.querySelector('.event-panel-head .eyebrow').textContent = `当前字幕 · ${captions[index].time}`; renderCaptions(); }); list.appendChild(item);
    });
  };
  const selectEvent = (type) => {
    selectedEvent = type; const [label, title, copy, input] = eventCopy[type];
    document.querySelector('#event-detail').hidden = false; document.querySelector('#event-detail-label').textContent = label; document.querySelector('#event-detail-title').textContent = title; document.querySelector('#event-detail-copy').textContent = copy; document.querySelector('#event-label-input').value = input;
    document.querySelectorAll('.event-option').forEach((button) => button.classList.toggle('is-active', button.dataset.event === type));
  };
  document.querySelectorAll('[data-route]').forEach((button) => button.addEventListener('click', () => setRoute(button.dataset.route)));
  document.querySelector('#open-timeline').addEventListener('click', () => setRoute('timeline'));
  document.querySelectorAll('.course-card').forEach((button) => button.addEventListener('click', () => setRoute('timeline')));
  document.querySelector('#choose-video').addEventListener('click', () => showToast('原型演示：下一步接入本地视频选择器。'));
  document.querySelector('#import-subtitle').addEventListener('click', () => showToast('原型演示：下一步接入 SRT / VTT 导入与本地 Whisper 生成。'));
  document.querySelector('#preview-timeline').addEventListener('click', () => { showToast('预览会打开学生视角，真实扩展桥将在下一步接入。'); window.open(lessonUrl, '_blank', 'noopener,noreferrer'); });
  document.querySelector('#save-timeline').addEventListener('click', () => { document.querySelector('#save-label').textContent = '刚刚保存'; showToast('课程时间线已保存到当前页面状态。'); });
  document.querySelectorAll('.event-option').forEach((button) => button.addEventListener('click', () => selectEvent(button.dataset.event)));
  document.querySelector('#add-event').addEventListener('click', () => { captions[selectedCaption].event = { type: selectedEvent, label: document.querySelector('#event-label-input').value || eventCopy[selectedEvent][3] }; renderCaptions(); showToast(`${eventCopy[selectedEvent][0]} 已添加到 ${captions[selectedCaption].time}。`); });
  document.querySelector('#zoom-in').addEventListener('click', () => showToast('时间线缩放到 125%（原型状态）。'));
  document.querySelector('#zoom-out').addEventListener('click', () => showToast('时间线缩放到 80%（原型状态）。'));
  document.querySelector('#video-dropzone').addEventListener('keydown', (event) => { if (event.key === 'Enter') showToast('原型演示：下一步接入本地视频选择器。'); });
  renderCaptions(); selectEvent('attention'); setRoute(window.location.hash === '#timeline' ? 'timeline' : 'home');
})();
