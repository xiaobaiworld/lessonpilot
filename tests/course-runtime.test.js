const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBvidFromLocation,
  courseMatchesLocation,
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
