(function initTeacherPrototype() {
  const lessonUrl = 'https://www.bilibili.com/video/BV1WW4y1e7GL/';
  const defaults = [
    {
      title: '理解检查',
      type: '选择题',
      minute: 0,
      second: 35,
      enabled: true,
      prompt: '视频中的回答为什么比 “I am hardworking” 更有说服力？',
      options: [
        '它使用了更复杂的单词',
        '它给出了能证明能力的具体例子',
        '它的回答时间更长'
      ],
      correct: 1,
      accepted: '',
      rubric: '',
      explanation: '具体例子能够证明能力，也让面试官更容易记住你的回答。'
    },
    {
      title: '关键表达',
      type: '填空题',
      minute: 1,
      second: 18,
      enabled: true,
      prompt: '补全句子：A strong interview answer should include a ______.',
      options: [],
      correct: 0,
      accepted: 'specific example, concrete example',
      rubric: '',
      explanation: '用具体经历支持观点，比只给出抽象形容词更可信。'
    },
    {
      title: '迁移练习',
      type: '自由回答',
      minute: 2,
      second: 6,
      enabled: false,
      prompt: '请用课程中的结构，回答一次你解决困难的真实经历。',
      options: [],
      correct: 0,
      accepted: '',
      rubric: '回答包含一个具体经历，并使用课程中的结果表达。',
      explanation: 'D1 将根据学生的真实回答给出个性化修改建议。'
    }
  ];

  let nodes = clone(defaults);
  let activeIndex = 0;
  let dirty = false;
  let toastTimer = null;

  const homeView = document.querySelector('#home-view');
  const editorView = document.querySelector('#editor-view');
  const form = document.querySelector('#node-form');
  const draftStatus = document.querySelector('#draft-status');
  const toast = document.querySelector('#toast');
  const nodeButtons = [...document.querySelectorAll('.node-item')];

  const fields = {
    enabled: document.querySelector('#node-enabled'),
    minute: document.querySelector('#node-minute'),
    second: document.querySelector('#node-second'),
    type: document.querySelector('#node-type'),
    prompt: document.querySelector('#node-prompt'),
    accepted: document.querySelector('#node-accepted'),
    rubric: document.querySelector('#node-rubric'),
    explanation: document.querySelector('#node-explanation')
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function formatTime(node) {
    return `${String(node.minute).padStart(2, '0')}:${String(node.second).padStart(2, '0')}`;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.setAttribute('aria-hidden', 'false');
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.setAttribute('aria-hidden', 'true');
    }, 2600);
  }

  function setDirty(value) {
    dirty = value;
    draftStatus.classList.toggle('is-dirty', dirty);
    draftStatus.querySelector('span:last-child').textContent = dirty ? '有未保存更改' : '所有更改已保存';
  }

  function persistCurrentForm() {
    const node = nodes[activeIndex];
    node.enabled = fields.enabled.checked;
    node.minute = Number(fields.minute.value) || 0;
    node.second = Number(fields.second.value) || 0;
    node.prompt = fields.prompt.value;
    node.accepted = fields.accepted.value;
    node.rubric = fields.rubric.value;
    node.explanation = fields.explanation.value;

    if (node.type === '选择题') {
      node.options = [...document.querySelectorAll('[data-choice-text]')].map((input) => input.value);
      const checked = document.querySelector('[name="correct-choice"]:checked');
      node.correct = checked ? Number(checked.value) : 0;
    }
  }

  function renderChoices(node) {
    const choiceList = document.querySelector('#choice-list');
    choiceList.replaceChildren();

    node.options.forEach((option, index) => {
      const row = document.createElement('div');
      row.className = 'choice-row';
      row.innerHTML = `
        <span class="choice-letter">${String.fromCharCode(65 + index)}</span>
        <input type="text" value="" data-choice-text aria-label="选项 ${index + 1}">
        <label class="choice-correct">
          <input type="radio" name="correct-choice" value="${index}">
          <span>正确答案</span>
        </label>
      `;
      row.querySelector('[data-choice-text]').value = option;
      row.querySelector('[name="correct-choice"]').checked = node.correct === index;
      choiceList.appendChild(row);
    });
  }

  function renderNode() {
    const node = nodes[activeIndex];
    document.querySelector('#node-sequence').textContent = `节点 ${activeIndex + 1} / ${nodes.length}`;
    document.querySelector('#node-title').textContent = node.title;
    document.querySelector('#dock-title').textContent = node.title;
    document.querySelector('#dock-detail').textContent = `${formatTime(node)} · ${node.type}`;

    fields.enabled.checked = node.enabled;
    fields.minute.value = node.minute;
    fields.second.value = node.second;
    fields.type.value = node.type;
    fields.prompt.value = node.prompt;
    fields.accepted.value = node.accepted;
    fields.rubric.value = node.rubric;
    fields.explanation.value = node.explanation;
    document.querySelector('#prompt-count').textContent = node.prompt.length;

    const isChoice = node.type === '选择题';
    const isFill = node.type === '填空题';
    document.querySelector('#choice-fields').hidden = !isChoice;
    document.querySelector('#accepted-field').hidden = !isFill;
    document.querySelector('#rubric-field').hidden = node.type !== '自由回答';
    document.querySelector('#explanation-label').textContent = node.type === '自由回答' ? '练习说明' : '答题解释';
    renderChoices(node);

    nodeButtons.forEach((button, index) => {
      const selected = index === activeIndex;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.querySelector('.node-time').textContent = formatTime(nodes[index]);
      const state = button.querySelector('.node-state');
      state.textContent = nodes[index].enabled ? '启用' : (index === 2 ? 'D1' : '停用');
      state.classList.toggle('node-state-muted', !nodes[index].enabled);
    });
  }

  function setRoute(route) {
    const showEditor = route === 'editor';
    homeView.hidden = showEditor;
    editorView.hidden = !showEditor;
    window.history.replaceState(null, '', showEditor ? '#editor' : '#home');
    document.title = showEditor ? '编辑互动节点 · LessonPilot' : 'LessonPilot 教师工作台';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validate() {
    persistCurrentForm();
    const errors = [];

    nodes.forEach((node, index) => {
      if (!node.prompt.trim()) errors.push(`节点 ${index + 1} 缺少题目`);
      if (node.second < 0 || node.second > 59) errors.push(`节点 ${index + 1} 的秒数应为 0–59`);
      if (node.type === '选择题' && node.options.some((option) => !option.trim())) errors.push(`节点 ${index + 1} 存在空选项`);
      if (node.type === '填空题' && !node.accepted.trim()) errors.push(`节点 ${index + 1} 缺少接受答案`);
      if (node.type === '自由回答' && !node.rubric.trim()) errors.push(`节点 ${index + 1} 缺少评价标准`);
    });

    const enabledTimes = nodes
      .filter((node) => node.enabled)
      .map((node) => node.minute * 60 + node.second);
    if (enabledTimes.some((time, index) => index > 0 && time <= enabledTimes[index - 1])) {
      errors.push('启用节点的时间必须按顺序递增');
    }

    return errors;
  }

  function saveLesson(preview) {
    const errors = validate();
    if (errors.length > 0) {
      showToast(errors[0]);
      return;
    }

    setDirty(false);
    if (preview) {
      showToast('原型已保存。真实扩展桥接将在下一步打开视频预览。');
    } else {
      showToast('原型配置已保存到当前页面状态。');
    }
  }

  document.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => setRoute(button.dataset.route));
  });

  document.querySelector('#open-finished-lesson').addEventListener('click', () => {
    showToast('即将打开固定 B 站演示视频。');
    window.setTimeout(() => window.open(lessonUrl, '_blank', 'noopener,noreferrer'), 220);
  });

  nodeButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      persistCurrentForm();
      activeIndex = index;
      renderNode();
    });
  });

  form.addEventListener('input', (event) => {
    if (event.target === fields.prompt) {
      document.querySelector('#prompt-count').textContent = fields.prompt.value.length;
    }
    persistCurrentForm();
    renderNodeListOnly();
    setDirty(true);
  });

  form.addEventListener('change', () => {
    persistCurrentForm();
    renderNodeListOnly();
    setDirty(true);
  });

  function renderNodeListOnly() {
    nodes.forEach((node, index) => {
      const button = nodeButtons[index];
      button.querySelector('.node-time').textContent = formatTime(node);
      const state = button.querySelector('.node-state');
      state.textContent = node.enabled ? '启用' : (index === 2 ? 'D1' : '停用');
      state.classList.toggle('node-state-muted', !node.enabled);
    });
    document.querySelector('#dock-detail').textContent = `${formatTime(nodes[activeIndex])} · ${nodes[activeIndex].type}`;
  }

  document.querySelector('#save-button').addEventListener('click', () => saveLesson(false));
  document.querySelector('#preview-button').addEventListener('click', () => saveLesson(true));
  document.querySelector('#reset-button').addEventListener('click', () => {
    nodes = clone(defaults);
    activeIndex = 0;
    renderNode();
    setDirty(true);
    showToast('已恢复默认模板，保存后才会生效。');
  });

  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  renderNode();
  setRoute(window.location.hash === '#editor' ? 'editor' : 'home');
})();
