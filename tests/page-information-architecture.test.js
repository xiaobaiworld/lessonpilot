// 定位: 验证教师销售页、工作台和学生宿主的信息架构边界。
// 入口参数: teacher-web 下的页面、样式与脚本文件。
// 返回参数: 断言结果与 Node 进程退出状态。
/**
 * 教师销售页、工作台示例页与互动课程工具的信息架构护栏。
 * 运行：node tests/page-information-architecture.test.js
 *
 * 2026-08-14：`student-web/` 已删除，学生宿主固定为装了插件的 B 站原页面，
 * 因此本文件不再断言任何网页学生端。
 */

const fs = require('fs');

const forSalesPage = fs.readFileSync('teacher-web/forsales.html', 'utf8');
const samplePage = fs.readFileSync('teacher-web/index.html', 'utf8');
const sampleCss = fs.readFileSync('teacher-web/sample.css', 'utf8');
const sharedCss = fs.readFileSync('teacher-web/styles.css', 'utf8');
const editorPage = fs.readFileSync('teacher-web/editor.html', 'utf8');
const editorApp = fs.readFileSync('teacher-web/app.js', 'utf8');
const trialIntake = require('../teacher-web/trial-intake.js');

const checks = [
  {
    label: 'forsales is a separate online sales page with a self-explanatory first screen',
    run: () => forSalesPage.includes('让用心抵达，让理解更深。') && forSalesPage.includes('我是 KnownMap 的开发者') && forSalesPage.includes('老师能看见结果') && forSalesPage.includes('你的讲解一句不改')
  },
  {
    label: 'forsales uses specific workspace proof and keeps sample evidence honest',
    run: () => forSalesPage.includes('完整课程示例') && forSalesPage.includes('八个节点') && forSalesPage.includes('节点 06') && forSalesPage.includes('示例数据')
  },
  {
    label: 'forsales closes with one low-friction real-course conversion',
    run: () => forSalesPage.includes('id="copy-request"')
      && forSalesPage.includes('data-trial-intake')
      && trialIntake.TRIAL_INTAKE.buttonLabel === '填写 1 分钟试用信息'
      && forSalesPage.includes('做一次可以实际运行的智能互动课程试用')
      && !forSalesPage.includes('立即购买')
  },
  {
    label: 'workspace sample stays separate from forsales positioning and conversion copy',
    run: () => !samplePage.includes('我是 KnownMap 的开发者') && !samplePage.includes('回复我，试一节真实课') && !samplePage.includes('复制试用话术')
  },
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
    label: 'sales sample stacks a 3/4 timeline beside the add-node rail',
    run: () => samplePage.includes('sample-stage-top') && samplePage.includes('sample-stage-bottom') && samplePage.includes('sample-timeline') && samplePage.includes('sample-add-rail') && samplePage.includes('整体介绍') && samplePage.includes('在视频中增加互动，让学习更有效。') && !samplePage.includes('sample-add-types') && samplePage.includes('＋ 增加节点') && !samplePage.includes('add-node-on-track')
  },
  {
    label: 'sales sample add-node form uses family-specific standard content fields',
    run: () => samplePage.includes('id="add-node-family"') && samplePage.includes('value="attention"') && samplePage.includes('value="voice"') && samplePage.includes('value="practice"') && samplePage.includes('value="followup"') && samplePage.includes('标出的关键词') && samplePage.includes('提醒正文') && samplePage.includes('id="add-node-preview"')
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
    label: 'sales sample keeps markup, styles, and behavior in its own files',
    run: () => samplePage.includes('href="styles.css"') && /<link rel="stylesheet" href="sample\.css\?v=[^"]+">/.test(samplePage) && /src="sample\.js\?v=[^"]+"/.test(samplePage) && sampleCss.includes('.sample-timeline') && sampleCss.includes('.sample-add-rail') && !sharedCss.includes('.sample-timeline') && !sharedCss.includes('.sample-add-rail')
  },
  {
    label: 'teacher platform centers the current course workflow without prototype framing',
    run: () => editorPage.includes('KnownMap 互动课程工具')
      && editorPage.includes('id="home-title">我的课程')
      && editorPage.includes('id="course-workspace"')
      && editorPage.includes('id="course-materials"')
      && editorPage.includes('id="continue-course"')
      && !editorPage.includes('课堂设计原型')
      && !editorPage.includes('功能原型')
      && !editorPage.includes('W0 当前范围')
  },
  {
    label: 'teacher course platform does not offer local video import',
    run: () => editorPage.includes('BV1WW4y1e7GL') && !editorPage.includes('选择视频文件')
  },
  {
    label: 'teacher course platform accepts a Bilibili link and a subtitle file',
    run: () => editorPage.includes('id="course-url-input"') && editorPage.includes('id="subtitle-file-input"')
  },
  {
    label: 'teacher platform keeps future capabilities and internal implementation notes out of the workspace',
    run: () => !editorPage.includes('学生学习过程')
      && !editorPage.includes('学习证据')
      && !editorPage.includes('不记录学习会话')
      && !editorPage.includes('本地 API')
      && !editorPage.includes('开发测试账号')
  },
  {
    label: 'teacher login protects the password while allowing a visibility toggle',
    run: () => editorPage.includes('id="login-password"')
      && editorPage.includes('id="toggle-password"')
      && editorPage.includes('aria-pressed="false"')
      && !/id="login-password"[^>]*\svalue=/.test(editorPage)
      && editorApp.includes("loginPassword.type === 'password' ? 'text' : 'password'")
  },
  {
    label: 'teacher course design view uses real course context and no fake player',
    run: () => editorPage.includes('id="timeline-title"')
      && editorPage.includes('id="timeline-lesson-title"')
      && editorPage.includes('id="timeline-source-summary"')
      && !editorPage.includes('class="overview-video"')
  },
  {
    label: 'teacher course platform script tolerates page-specific controls being absent',
    run: () => editorApp.includes("document.querySelector('#continue-course')?.addEventListener") && editorPage.includes('src="app.js?v=')
  },
  {
    label: '仓库里不存在网页学生入口（学生宿主只有 B 站原页面加插件）',
    run: () => !fs.existsSync('student-web')
  },
  {
    label: '教师端页面不引导学生用网页学习，也不承诺网页定时弹题',
    run: () => !samplePage.includes('student-web') && !editorPage.includes('student-web') && !editorApp.includes('student-web')
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

console.log('All teacher and student page information architecture checks passed.');
