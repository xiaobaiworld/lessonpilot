/**
 * Guardrails for the two role-specific page entry points.
 * Run: node tests/page-information-architecture.test.js
 */

const fs = require('fs');

const teacherPage = fs.readFileSync('teacher-web/index.html', 'utf8');
const studentPage = fs.readFileSync('student-web/index.html', 'utf8');

const checks = [
  {
    label: 'teacher home leads with a current-course continuation action',
    run: () => teacherPage.includes('继续完成你的课程') && teacherPage.includes('继续设计课堂')
  },
  {
    label: 'teacher home keeps a direct student preview action',
    run: () => teacherPage.includes('预览学生课程') && teacherPage.includes('id="preview-home"')
  },
  {
    label: 'student entry presents a lesson and progress instead of playback-source choices',
    run: () => studentPage.includes('本节学习') && studentPage.includes('学习进度') && !studentPage.includes('B 站原课样例')
  },
  {
    label: 'student entry keeps the existing interactive runtime controls available',
    run: () => studentPage.includes('id="lesson-video"') && studentPage.includes('id="start-button"') && studentPage.includes('id="question-card"')
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

console.log('All page information architecture checks passed.');
