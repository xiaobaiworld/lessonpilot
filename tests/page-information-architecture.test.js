/**
 * Guardrails for the teacher sales sample, W0 editor, and student course shell.
 * Run: node tests/page-information-architecture.test.js
 */

const fs = require('fs');

const samplePage = fs.readFileSync('teacher-web/index.html', 'utf8');
const editorPage = fs.readFileSync('teacher-web/editor.html', 'utf8');
const editorApp = fs.readFileSync('teacher-web/app.js', 'utf8');
const studentPage = fs.readFileSync('student-web/index.html', 'utf8');
const studentApp = fs.readFileSync('student-web/app.js', 'utf8');

const checks = [
  {
    label: 'sales sample uses the course title as the page heading',
    run: () => samplePage.includes('英语面试表达：把答案说得具体') && samplePage.includes('id="course-title"') && samplePage.includes('英语职业课') && samplePage.includes('英文面试表达') && !samplePage.includes('沿着字幕，设计学生真正需要的课堂动作')
  },
  {
    label: 'sales sample header avoids prototype actions and duplicate sample status',
    run: () => !samplePage.includes('预览学生课程') && !samplePage.includes('保存课堂设计') && !samplePage.includes('示例未保存') && !samplePage.includes('<small>示例课程</small>') && !samplePage.includes('<span>示例课程</span>')
  },
  {
    label: 'sales page contains no implementation caveats or prototype disclaimers',
    run: () => !samplePage.includes('B 站来源') && !samplePage.includes('网页不控制播放') && !samplePage.includes('用来对时间点') && !samplePage.includes('示例图里的修改') && !samplePage.includes('只演示入口') && !samplePage.includes('每个节点同一行同时看到制作内容和学生端效果')
  },
  {
    label: 'sales sample stacks video above a full-width timeline',
    run: () => samplePage.includes('sample-stage-top') && samplePage.includes('sample-timeline') && samplePage.includes('整体介绍')
  },
  {
    label: 'sales sample timeline marks typed interaction points with visible labels',
    run: () => samplePage.includes('01 重点提醒') && samplePage.includes('02 互动练习') && samplePage.includes('03 点评追问') && samplePage.includes('sample-track-progress') && samplePage.includes('sample-playhead') && samplePage.includes('00:39') && samplePage.includes('02:16') && samplePage.includes('05:45') && samplePage.includes('08:33')
  },
  {
    label: 'sales sample uses teaching content grounded in the supplied interview subtitles',
    run: () => samplePage.includes('hard-working, diligent, loyal, flexible and knowledgeable') && samplePage.includes('assessing my own words and actions') && samplePage.includes('remain calm, ask questions, assess my options, and take action') && !samplePage.includes('补全 STAR 表达中的 Action')
  },
  {
    label: 'sales sample shows three node rows with student-effect previews',
    run: () => samplePage.includes('id="node-1"') && samplePage.includes('id="node-2"') && samplePage.includes('id="node-3"') && samplePage.includes('学生端效果预览')
  },
  {
    label: 'sales sample keeps completion as labeled example data',
    run: () => samplePage.includes('示例数据') && samplePage.includes('学生课程完成情况') && samplePage.includes('最需要关注')
  },
  {
    label: 'sales sample busts stale stylesheet caches after visual changes',
    run: () => /<link rel="stylesheet" href="styles\.css\?v=[^"]+">/.test(samplePage)
  },
  {
    label: 'teacher W0 editor still centers the classroom-design task',
    run: () => editorPage.includes('沿着字幕，设计学生真正需要的课堂动作') && editorPage.includes('主要任务') && editorPage.includes('id="continue-course"') && editorPage.includes('进入课堂设计')
  },
  {
    label: 'teacher W0 editor does not offer local video import',
    run: () => editorPage.includes('BV1WW4y1e7GL') && !editorPage.includes('选择视频文件')
  },
  {
    label: 'teacher W0 editor accepts a Bilibili link and a subtitle file',
    run: () => editorPage.includes('id="course-url-input"') && editorPage.includes('id="subtitle-file-input"')
  },
  {
    label: 'teacher W0 editor keeps learning results as a small honest process note',
    run: () => editorPage.includes('学生学习过程') && editorPage.includes('不记录学习会话，也不生成报告') && !editorPage.includes('新建课程')
  },
  {
    label: 'teacher W0 editor script tolerates page-specific controls being absent',
    run: () => editorApp.includes("document.querySelector('#continue-course')?.addEventListener") && editorPage.includes('src="app.js?v=')
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
