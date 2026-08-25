const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBvidFromLocation,
  courseMatchesLocation,
  findLessonForLocation,
  createVideoModeStore,
  createNodeTimeline,
  createCoursePageWatcher,
  evaluateNodeAnswer
} = require('../src/content/course-runtime.js');

const course = {
  courseId: 'bilibili:BV1WW4y1e7GL',
  videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
  nodes: [
    { id: 'disabled', enabled: false, trigger: { timeSeconds: 5 } },
    { id: 'first', enabled: true, trigger: { timeSeconds: 10 } },
    { id: 'second', enabled: true, trigger: { timeSeconds: 20 } }
  ]
};

test('matches only the exact BVID segment of a Bilibili video pathname', () => {
  assert.equal(getBvidFromLocation({ pathname: '/video/BV1WW4y1e7GL/' }), 'BV1WW4y1e7GL');
  assert.equal(courseMatchesLocation(course, { pathname: '/video/BV1WW4y1e7GL/' }), true);
  assert.equal(courseMatchesLocation(course, { pathname: '/video/BV1WW4y1e7GLX/' }), false);
  assert.equal(courseMatchesLocation(course, { pathname: '/other/BV1WW4y1e7GL/' }), false);
});

test('finds the matching lesson inside a multi-course library', () => {
  const installedCourses = [{
    courseId: 'd2045bc7-4ba2-4aff-8f27-3bc336be4f55',
    course: {
      courseId: 'd2045bc7-4ba2-4aff-8f27-3bc336be4f55',
      title: '示例课程',
      lessons: [{
        lessonId: 'a1cc724e-19f4-4f12-9377-8ff71753e8c4',
        title: '第一节',
        videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
        nodes: []
      }]
    }
  }];
  const learningStates = {
    'd2045bc7-4ba2-4aff-8f27-3bc336be4f55': {
      'a1cc724e-19f4-4f12-9377-8ff71753e8c4': { nodeStates: {} }
    }
  };

  const match = findLessonForLocation(
    installedCourses,
    learningStates,
    { pathname: '/video/BV1WW4y1e7GL/' }
  );

  assert.equal(match.course.title, '示例课程');
  assert.equal(match.lesson.title, '第一节');
  assert.deepEqual(match.learningState, { nodeStates: {} });
  assert.equal(
    findLessonForLocation(installedCourses, learningStates, { pathname: '/video/BV-other/' }),
    null
  );
});

test('authorized courses take priority over the bundled example for the same BVID', () => {
  const example = {
    source: 'example',
    installedAt: '2026-08-18T00:00:00.000Z',
    course: {
      courseId: '1dfaf2f0-f826-46e8-afdb-89e2d0468a22',
      title: '示例课程',
      lessons: [{
        lessonId: 'a9a6f97e-475f-47e0-8412-993cc0f14ad8',
        title: '示例课节',
        videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
        nodes: []
      }]
    }
  };
  const authorized = {
    source: 'authorization',
    installedAt: '2026-08-20T00:00:00.000Z',
    course: {
      courseId: 'd2045bc7-4ba2-4aff-8f27-3bc336be4f55',
      title: '真实授权课程',
      lessons: [{
        lessonId: 'a1cc724e-19f4-4f12-9377-8ff71753e8c4',
        title: '真实课节',
        videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
        nodes: []
      }]
    }
  };

  const match = findLessonForLocation(
    [example, authorized],
    {},
    { pathname: '/video/BV1WW4y1e7GL/' }
  );

  assert.equal(match.course.title, '真实授权课程');
});

test('timeline triggers each enabled node once when playback crosses its time', () => {
  const seen = [];
  const timeline = createNodeTimeline(course, (node) => seen.push(node.id));

  timeline.update(0);
  timeline.update(11);
  timeline.complete('first');
  timeline.update(25);
  timeline.complete('second');
  timeline.update(30);

  assert.deepEqual(seen, ['first', 'second']);
});

test('timeline releases at most one due node per update to keep interactions linear', () => {
  const seen = [];
  const timeline = createNodeTimeline(course, (node) => seen.push(node.id));

  timeline.update(25);
  assert.deepEqual(seen, ['first']);
  timeline.update(25);
  assert.deepEqual(seen, ['first']);
  timeline.complete('first');
  timeline.update(25);
  assert.deepEqual(seen, ['first', 'second']);
});

test('timeline ignores completion for a node other than the active interaction', () => {
  const seen = [];
  const timeline = createNodeTimeline(course, (node) => seen.push(node.id));

  timeline.update(25);
  timeline.complete('second');
  timeline.update(25);

  assert.deepEqual(seen, ['first']);
});

test('timeline skips nodes already completed in persisted learning state', () => {
  const seen = [];
  const timeline = createNodeTimeline(course, (node) => seen.push(node.id), {
    completedNodeIds: ['first']
  });

  timeline.update(25);

  assert.deepEqual(seen, ['second']);
});

test('timeline replays completed notice nodes after rewinding to the start', () => {
  const seen = [];
  const noticeCourse = {
    nodes: [{
      id: 'overview',
      enabled: true,
      interaction: 'notice',
      trigger: { timeSeconds: 2 }
    }]
  };
  const timeline = createNodeTimeline(noticeCourse, (node) => seen.push(node.id));

  timeline.update(3);
  timeline.complete('overview');
  timeline.update(0);
  timeline.update(3);

  assert.deepEqual(seen, ['overview', 'overview']);
});

test('timeline does not skip a completed notice node when initialized from saved state', () => {
  const seen = [];
  const noticeCourse = {
    nodes: [{
      id: 'overview',
      enabled: true,
      interaction: 'notice',
      trigger: { timeSeconds: 2 }
    }]
  };
  const timeline = createNodeTimeline(noticeCourse, (node) => seen.push(node.id), {
    completedNodeIds: ['overview']
  });

  timeline.update(3);

  assert.deepEqual(seen, ['overview']);
});

test('video mode store defaults to course and persists original mode', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const store = createVideoModeStore(storage);

  assert.equal(store.read(), 'course');
  store.write('original');
  assert.equal(store.read(), 'original');
});

test('timeline does not trigger nodes while disabled and can resume at the current time', () => {
  const seen = [];
  const timeline = createNodeTimeline({
    nodes: [{
      id: 'notice',
      enabled: true,
      interaction: 'notice',
      trigger: { timeSeconds: 2 }
    }]
  }, (node) => seen.push(node.id));

  timeline.setEnabled(false);
  timeline.update(3);
  assert.deepEqual(seen, []);

  timeline.setEnabled(true);
  timeline.reset();
  timeline.update(3);
  assert.deepEqual(seen, ['notice']);
});

test('evaluates choice and blank answers without mutating the course node', () => {
  const choice = {
    interaction: 'choice',
    evaluation: { answer: 'b', explanation: '说明' }
  };
  const blank = {
    interaction: 'blank',
    evaluation: { acceptedAnswers: ['Suggested'], normalize: ['trim', 'casefold'], explanation: '说明' }
  };
  assert.equal(evaluateNodeAnswer(choice, 'b').correct, true);
  assert.equal(evaluateNodeAnswer(choice, 'a').correct, false);
  assert.equal(evaluateNodeAnswer(blank, '  suggested ').correct, true);
  assert.equal(evaluateNodeAnswer(blank, 'other').correct, false);
  assert.equal(evaluateNodeAnswer({ interaction: 'free_text', evaluation: { referenceFeedback: '参考' } }, '任意回答').correct, true);
});

test('SPA watcher enters, leaves and stops without duplicate callbacks', () => {
  const listeners = new Map();
  const intervals = new Map();
  let nextInterval = 1;
  const win = {
    location: { pathname: '/video/BV-other/' },
    history: {
      pushState() {},
      replaceState() {}
    },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
    setInterval(fn) { const id = nextInterval++; intervals.set(id, fn); return id; },
    clearInterval(id) { intervals.delete(id); }
  };
  let enters = 0;
  let leaves = 0;
  const stop = createCoursePageWatcher({
    window: win,
    course,
    onEnter: () => { enters += 1; },
    onLeave: () => { leaves += 1; }
  });

  win.location.pathname = '/video/BV1WW4y1e7GL/';
  win.history.pushState({}, '', win.location.pathname);
  win.history.replaceState({}, '', win.location.pathname);
  assert.equal(enters, 1);

  win.location.pathname = '/video/BV-other/';
  listeners.get('popstate')();
  assert.equal(leaves, 1);

  stop();
  assert.equal(listeners.size, 0);
  assert.equal(intervals.size, 0);
});
