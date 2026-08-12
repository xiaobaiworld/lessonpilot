/**
 * Contract checks for the W0 static Bilibili course reference.
 * Run: node tests/course-config.test.js
 */

const configuredCourse = require('../student-web/course.json');

const checks = [
  {
    label: 'contains the fixed Bilibili course identity and learner-facing copy',
    run: () => configuredCourse.id === 'bilibili-interview-demo' && Boolean(configuredCourse.title) && Boolean(configuredCourse.summary)
  },
  {
    label: 'keeps the configured original-page and embed URLs on the fixed BV id',
    run: () => configuredCourse.source?.platform === 'bilibili'
      && configuredCourse.source?.videoId === 'BV1WW4y1e7GL'
      && configuredCourse.source?.pageUrl === 'https://www.bilibili.com/video/BV1WW4y1e7GL/'
      && configuredCourse.source?.embedUrl.includes('bvid=BV1WW4y1e7GL')
  },
  {
    label: 'does not carry W0 local-player interaction nodes',
    run: () => !Object.hasOwn(configuredCourse, 'nodes')
  },
  {
    label: 'contains learning goals and expected results without completed-session data',
    run: () => Array.isArray(configuredCourse.learningGoals) && configuredCourse.learningGoals.length > 0
      && Array.isArray(configuredCourse.expectedResults) && configuredCourse.expectedResults.length > 0
      && !Object.hasOwn(configuredCourse, 'completedResults')
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

console.log('All W0 course configuration checks passed.');
