/**
 * Guardrails for the W0 teacher workspace and student course shell.
 * Run: node tests/page-information-architecture.test.js
 */

const fs = require('fs');

const teacherPage = fs.readFileSync('teacher-web/index.html', 'utf8');
const studentPage = fs.readFileSync('student-web/index.html', 'utf8');
const studentApp = fs.readFileSync('student-web/app.js', 'utf8');

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
    label: 'teacher W0 workspace does not offer local video import',
    run: () => teacherPage.includes('查看固定课程来源') && !teacherPage.includes('选择视频文件')
  },
  {
    label: 'student entry presents one course and a direct original-course fallback',
    run: () => studentPage.includes('本节学习') && studentPage.includes('在 B 站打开原课') && studentPage.includes('id="bilibili-player"')
  },
  {
    label: 'W0 student page has no local-video or timed-interaction runtime controls',
    run: () => !studentPage.includes('video-file-input') && !studentPage.includes('测试者工具') && !studentPage.includes('question-card') && !studentApp.includes('ObjectURL')
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

console.log('All W0 page information architecture checks passed.');
