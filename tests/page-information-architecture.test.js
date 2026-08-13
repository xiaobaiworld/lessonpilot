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
    label: 'teacher home explains the four product capabilities before course editing',
    run: () => teacherPage.includes('把一节录播课变成可练习的学习') && ['接入已有课程', '按字幕设计动作', '预览学生体验', '查看学习结果'].every((label) => teacherPage.includes(label))
  },
  {
    label: 'teacher home keeps a direct student preview action',
    run: () => teacherPage.includes('预览学生课程') && teacherPage.includes('id="preview-home"')
  },
  {
    label: 'teacher W0 workspace does not offer local video import',
    run: () => teacherPage.includes('确认 B 站课程链接') && !teacherPage.includes('选择视频文件')
  },
  {
    label: 'teacher W0 workspace accepts a Bilibili link and a subtitle file',
    run: () => teacherPage.includes('id="course-url-input"') && teacherPage.includes('id="subtitle-file-input"')
  },
  {
    label: 'teacher home is honest that learning-result recording is not delivered in W0',
    run: () => teacherPage.includes('不记录学习会话，也不生成报告') && !teacherPage.includes('新建课程')
  },
  {
    label: 'student entry presents learning goals, a dominant source video, and learning results',
    run: () => studentPage.includes('学习目标') && studentPage.includes('学习结果展示') && studentPage.includes('id="bilibili-player"')
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
