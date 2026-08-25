/**
 * W0 固定 B 站课程引用的契约检查。
 * 运行：node tests/course-config.test.js
 *
 * 2026-08-14：`student-web/` 已删除，学生宿主固定为装了插件的 B 站原页面。
 * 课程标识与教学文案仍是真实内容，迁到 `teacher-web/course.json` 继续被约束。
 */

const configuredCourse = require('../teacher-web/course.json');

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
