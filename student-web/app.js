/**
 * Student web runtime shell. It keeps Bilibili as the sample course source and
 * uses a selected local HTML5 video for the browser-controlled interaction demo.
 */
(function initStudentRuntime() {
  const STORAGE_KEY_PREFIX = 'lessonpilot.studentWebSession.v2';
  const runtime = window.LessonPilotStudentRuntime;
  const video = document.querySelector('#lesson-video');
  const sessionState = document.querySelector('#session-state');
  const timeLabel = document.querySelector('#time-label');
  const progressLabel = document.querySelector('#progress-label');
  const bilibiliStage = document.querySelector('#bilibili-stage');
  const localStage = document.querySelector('#local-stage');
  const bilibiliCard = document.querySelector('#bilibili-card');
  const introCard = document.querySelector('#intro-card');
  const questionCard = document.querySelector('#question-card');
  const feedbackCard = document.querySelector('#feedback-card');
  const summaryCard = document.querySelector('#summary-card');
  const loadErrorCard = document.querySelector('#load-error-card');
  const loadErrorCopy = document.querySelector('#load-error-copy');
  const questionKicker = document.querySelector('#question-kicker');
  const questionTitle = document.querySelector('#question-title');
  const questionPrompt = document.querySelector('#question-prompt');
  const answerArea = document.querySelector('#answer-area');
  const feedbackKicker = document.querySelector('#feedback-kicker');
  const feedbackTitle = document.querySelector('#feedback-title');
  const feedbackCopy = document.querySelector('#feedback-copy');
  const summaryList = document.querySelector('#summary-list');
  const startButton = document.querySelector('#start-button');
  const skipButton = document.querySelector('#skip-button');
  const continueButton = document.querySelector('#continue-button');
  const restartButton = document.querySelector('#restart-button');
  const showBilibiliButton = document.querySelector('#show-bilibili-button');
  const showLocalButton = document.querySelector('#show-local-button');
  const switchToLocalButton = document.querySelector('#switch-to-local-button');
  const fileInput = document.querySelector('#video-file-input');
  const localEmptyState = document.querySelector('#local-empty-state');
  const localReadyState = document.querySelector('#local-ready-state');
  const localFileName = document.querySelector('#local-file-name');
  const localFileError = document.querySelector('#local-file-error');
  const replaceVideoButton = document.querySelector('#replace-video-button');

  let course = null;
  let session = null;
  let activeNode = null;
  let localVideoUrl = null;
  let mode = 'bilibili';

  function storageKey() {
    return `${STORAGE_KEY_PREFIX}.${course.id}`;
  }

  function createSession() {
    return {
      id: `web-${Date.now()}`,
      courseId: course.id,
      videoRef: course.source,
      sessionType: 'student-web-local-video-demo',
      startedAt: new Date().toISOString(),
      completedAt: null,
      answers: []
    };
  }

  function saveSession() {
    if (session) {
      localStorage.setItem(storageKey(), JSON.stringify(session));
    }
  }

  function loadSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()));
      if (saved?.courseId === course.id && Array.isArray(saved.answers)) {
        return saved;
      }
    } catch (error) {
      localStorage.removeItem(storageKey());
    }
    return createSession();
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const rest = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
  }

  function getAnswer(nodeId) {
    return runtime.getAnswer(session, nodeId);
  }

  function updateProgress() {
    const completed = session ? session.answers.length : 0;
    const count = course ? course.nodes.length : 0;
    progressLabel.textContent = `${completed} / ${count} 已完成`;
    if (mode === 'bilibili') {
      sessionState.textContent = 'B 站来源样例';
    } else if (!video.currentSrc) {
      sessionState.textContent = '等待本地视频';
    } else {
      sessionState.textContent = completed === count ? '学习完成' : '本地可控课堂';
    }
  }

  function showOnly(card) {
    [bilibiliCard, introCard, questionCard, feedbackCard, summaryCard, loadErrorCard].forEach((item) => {
      item.hidden = item !== card;
    });
  }

  function setMode(nextMode) {
    mode = nextMode;
    const isBilibili = mode === 'bilibili';
    bilibiliStage.hidden = !isBilibili;
    localStage.hidden = isBilibili;
    showBilibiliButton.classList.toggle('is-active', isBilibili);
    showLocalButton.classList.toggle('is-active', !isBilibili);
    showBilibiliButton.setAttribute('aria-pressed', String(isBilibili));
    showLocalButton.setAttribute('aria-pressed', String(!isBilibili));
    if (isBilibili) {
      video.pause();
      activeNode = null;
      showOnly(bilibiliCard);
    } else if (video.currentSrc) {
      showOnly(introCard);
    } else {
      showOnly(null);
    }
    updateProgress();
  }

  function triggerNode(node) {
    activeNode = node;
    video.pause();
    questionKicker.textContent = `互动节点 · ${formatTime(node.timeSeconds)}`;
    questionTitle.textContent = node.title;
    questionPrompt.textContent = node.prompt;
    renderAnswerInput(node);
    showOnly(questionCard);
  }

  function renderAnswerInput(node) {
    answerArea.replaceChildren();
    if (node.type === 'multiple_choice') {
      node.options.forEach((option) => {
        const label = document.createElement('label');
        label.className = 'choice-option';
        const input = document.createElement('input');
        const text = document.createElement('span');
        input.type = 'radio';
        input.name = 'answer';
        input.value = option.id;
        input.required = true;
        text.textContent = option.label;
        label.append(input, text);
        answerArea.appendChild(label);
      });
      return;
    }

    const input = document.createElement('input');
    input.className = 'text-answer';
    input.name = 'answer';
    input.placeholder = '输入你的答案';
    input.autocomplete = 'off';
    input.required = true;
    answerArea.appendChild(input);
  }

  function readResponse(node) {
    if (node.type === 'multiple_choice') {
      return answerArea.querySelector('input[name="answer"]:checked')?.value || '';
    }
    return answerArea.querySelector('input[name="answer"]')?.value || '';
  }

  function recordAnswer(node, response, status = 'answered') {
    const previous = getAnswer(node.id);
    const correct = status === 'answered' ? runtime.evaluate(node, response) : false;
    const answer = {
      nodeId: node.id,
      status,
      response,
      correct,
      attempts: (previous?.attempts || 0) + 1,
      feedback: status === 'skipped' ? '学生跳过了这个节点。' : (correct ? node.success : node.failure),
      submittedAt: new Date().toISOString()
    };
    session.answers = session.answers.filter((item) => item.nodeId !== node.id);
    session.answers.push(answer);
    if (session.answers.length === course.nodes.length) {
      session.completedAt = new Date().toISOString();
    }
    saveSession();
    updateProgress();
    return answer;
  }

  function showFeedback(answer) {
    feedbackCard.classList.toggle('is-correct', answer.correct);
    feedbackCard.classList.toggle('is-wrong', !answer.correct);
    feedbackKicker.textContent = answer.status === 'skipped' ? '已跳过' : (answer.correct ? '回答正确' : '继续练习');
    feedbackTitle.textContent = answer.status === 'skipped' ? '这个节点已记录为跳过。' : (answer.correct ? '答对了。' : '这次还没答准。');
    feedbackCopy.textContent = answer.feedback;
    showOnly(feedbackCard);
  }

  function maybeTriggerNextNode() {
    if (mode !== 'local' || activeNode || video.paused || !session) {
      return;
    }
    const nextNode = runtime.getNextTrigger(course.nodes, session, video.currentTime);
    if (nextNode) {
      triggerNode(nextNode);
    }
  }

  function renderSummary() {
    summaryList.replaceChildren();
    course.nodes.forEach((node) => {
      const answer = getAnswer(node.id);
      const item = document.createElement('div');
      const title = document.createElement('strong');
      const copy = document.createElement('span');
      item.className = 'summary-item';
      title.textContent = node.title;
      copy.textContent = answer ? answer.feedback : '未完成';
      item.append(title, copy);
      summaryList.appendChild(item);
    });
    showOnly(summaryCard);
  }

  function setLocalVideo(file) {
    if (!file) {
      return;
    }
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov)$/i.test(file.name)) {
      localFileError.textContent = '请选择 MP4、WebM 或 MOV 视频文件。';
      localFileError.hidden = false;
      return;
    }
    if (localVideoUrl) {
      URL.revokeObjectURL(localVideoUrl);
    }
    localVideoUrl = URL.createObjectURL(file);
    localStage.classList.add('has-local-video');
    video.hidden = false;
    video.src = localVideoUrl;
    video.load();
    localFileError.hidden = true;
    localFileName.textContent = file.name;
    localEmptyState.hidden = true;
    localReadyState.hidden = false;
    startButton.disabled = false;
    session = createSession();
    saveSession();
    showOnly(introCard);
    updateProgress();
  }

  async function loadCourse() {
    try {
      const response = await fetch('./course.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`配置读取失败（${response.status}）。`);
      }
      const candidate = await response.json();
      const result = runtime.validateCourse(candidate);
      if (!result.ok) {
        throw new Error(result.message);
      }
      course = result.course;
      session = loadSession();
      document.title = `LessonPilot · ${course.title}`;
      document.querySelector('#lesson-title').textContent = course.title;
      document.querySelector('#lesson-summary').textContent = course.summary;
      document.querySelector('#bilibili-page-link').href = course.source.pageUrl;
      document.querySelector('#bilibili-player').src = course.source.embedUrl;
      updateProgress();
      setMode('bilibili');
    } catch (error) {
      loadErrorCopy.textContent = error.message || '未知错误。';
      showOnly(loadErrorCard);
      sessionState.textContent = '课程未启动';
    }
  }

  startButton.addEventListener('click', async () => {
    showOnly(null);
    try {
      await video.play();
    } catch (error) {
      sessionState.textContent = '请手动播放';
      showOnly(introCard);
    }
  });

  questionCard.addEventListener('submit', (event) => {
    event.preventDefault();
    if (activeNode) {
      showFeedback(recordAnswer(activeNode, readResponse(activeNode)));
    }
  });

  skipButton.addEventListener('click', () => {
    if (activeNode) {
      showFeedback(recordAnswer(activeNode, '', 'skipped'));
    }
  });

  continueButton.addEventListener('click', async () => {
    activeNode = null;
    if (session.answers.length === course.nodes.length) {
      renderSummary();
      return;
    }
    showOnly(null);
    try {
      await video.play();
    } catch (error) {
      showOnly(introCard);
    }
  });

  restartButton.addEventListener('click', () => {
    session = createSession();
    saveSession();
    activeNode = null;
    video.currentTime = 0;
    video.pause();
    updateProgress();
    showOnly(introCard);
  });

  showBilibiliButton.addEventListener('click', () => setMode('bilibili'));
  showLocalButton.addEventListener('click', () => setMode('local'));
  switchToLocalButton.addEventListener('click', () => setMode('local'));
  fileInput.addEventListener('change', () => setLocalVideo(fileInput.files[0]));
  replaceVideoButton.addEventListener('click', () => fileInput.click());
  video.addEventListener('timeupdate', () => {
    timeLabel.textContent = formatTime(video.currentTime);
    maybeTriggerNextNode();
  });
  video.addEventListener('loadedmetadata', updateProgress);
  video.addEventListener('ended', () => {
    if (session?.answers.length === course?.nodes.length) {
      renderSummary();
    }
  });
  video.hidden = true;
  window.addEventListener('pagehide', () => {
    if (localVideoUrl) {
      URL.revokeObjectURL(localVideoUrl);
    }
  });

  loadCourse();
})();
