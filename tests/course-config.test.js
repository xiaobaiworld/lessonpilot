/**
 * Contract checks for the static student-web course configuration.
 * Run: node tests/course-config.test.js
 */

const { validateCourse, getNextTrigger } = require('../student-web/runtime.js');
const configuredCourse = require('../student-web/course.json');

const validCourse = {
  id: 'bilibili-interview-demo',
  title: '英语面试表达：把答案说得具体',
  source: {
    platform: 'bilibili',
    videoId: 'BV1WW4y1e7GL',
    pageUrl: 'https://www.bilibili.com/video/BV1WW4y1e7GL/',
    embedUrl: 'https://player.bilibili.com/player.html?bvid=BV1WW4y1e7GL&autoplay=0'
  },
  nodes: [
    {
      id: 'first',
      timeSeconds: 4,
      type: 'multiple_choice',
      title: '选择题',
      prompt: '选择正确答案。',
      answer: 'b',
      success: '正确。',
      failure: '再试一次。',
      options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
    },
    {
      id: 'second',
      timeSeconds: 8,
      type: 'fill_blank',
      title: '填空题',
      prompt: '填写答案。',
      answer: 'result',
      success: '正确。',
      failure: '再试一次。'
    }
  ]
};

const checks = [
  {
    label: 'accepts the fixed Bilibili sample with ordered deterministic nodes',
    run: () => validateCourse(validCourse).ok === true
  },
  {
    label: 'accepts the shipped Bilibili sample course configuration',
    run: () => validateCourse(configuredCourse).ok === true
  },
  {
    label: 'rejects a Bilibili page URL that does not match the configured BV id',
    run: () => validateCourse({
      ...validCourse,
      source: { ...validCourse.source, pageUrl: 'https://www.bilibili.com/video/BV1abc123xyz/' }
    }).ok === false
  },
  {
    label: 'rejects duplicate node identifiers',
    run: () => validateCourse({
      ...validCourse,
      nodes: [validCourse.nodes[0], { ...validCourse.nodes[1], id: 'first' }]
    }).ok === false
  },
  {
    label: 'rejects nodes that are not ordered by time',
    run: () => validateCourse({
      ...validCourse,
      nodes: [validCourse.nodes[1], validCourse.nodes[0]]
    }).ok === false
  },
  {
    label: 'chooses the earliest unfinished node after a seek',
    run: () => getNextTrigger(validCourse.nodes, { answers: [] }, 9)?.id === 'first'
  }
];

let failed = 0;
checks.forEach((check) => {
  if (check.run()) {
    console.log(`PASS: ${check.label}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${check.label}`);
  }
});

if (failed > 0) {
  process.exit(1);
}

console.log('All course configuration checks passed.');
