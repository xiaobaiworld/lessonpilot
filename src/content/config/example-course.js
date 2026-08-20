/**
 * Bundled read-only example course.
 *
 * The UUIDs are permanent identities reserved for the bundled copy and are
 * deliberately different from the source teacher course.
 */
(function initExampleCourse(global, factory) {
  const api = factory();
  global.LessonPilotExampleCourse = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis, function createExampleCourse() {
  const EXAMPLE_COURSE_ID = '1dfaf2f0-f826-46e8-afdb-89e2d0468a22';
  const EXAMPLE_COURSE_PACKAGE = {
    schemaVersion: 2,
    courseId: EXAMPLE_COURSE_ID,
    title: '英语面试表达：把答案说得具体',
    lessons: [{
      lessonId: 'a9a6f97e-475f-47e0-8412-993cc0f14ad8',
      title: '第一课 · 用具体经历回答',
      videoRef: {
        platform: 'bilibili',
        videoId: 'BV1WW4y1e7GL'
      },
      nodes: [{
        id: 'node-1787039768985-2',
        enabled: true,
        family: 'attention',
        interaction: 'notice',
        trigger: {
          kind: 'time_cross',
          timeSeconds: 35,
          captionId: 'caption-2'
        },
        display: {
          title: '重点提醒',
          body: '请记住这一句，并注意它和上一句的区别。'
        },
        effects: { pause: true },
        evaluation: null
      }, {
        id: 'node-1787039769081-3',
        enabled: true,
        family: 'practice',
        interaction: 'choice',
        trigger: {
          kind: 'time_cross',
          timeSeconds: 51,
          captionId: 'caption-3'
        },
        display: {
          title: '选择题',
          prompt: '哪一个选项最能说明这句话的重点？',
          options: [
            { id: 'a', label: '只说自己的品质' },
            { id: 'b', label: '给出具体经历' }
          ]
        },
        evaluation: {
          answer: 'b',
          explanation: '具体经历能让答案可验证。'
        },
        effects: { pause: true }
      }, {
        id: 'node-1787039769181-5',
        enabled: true,
        family: 'practice',
        interaction: 'blank',
        trigger: {
          kind: 'time_cross',
          timeSeconds: 78,
          captionId: 'caption-5'
        },
        display: {
          title: '填空题',
          prompt: '请填入这句话中最关键的表达。'
        },
        evaluation: {
          acceptedAnswers: ['suggested'],
          normalize: ['trim', 'casefold'],
          explanation: '答案需要保留具体动作和结果。'
        },
        effects: { pause: true }
      }, {
        id: 'node-1787039769280-7',
        enabled: true,
        family: 'followup',
        interaction: 'free_text',
        trigger: {
          kind: 'time_cross',
          timeSeconds: 109,
          captionId: 'caption-7'
        },
        display: {
          title: '问答题',
          prompt: '请用自己的经历说明你如何解决一个困难情况。'
        },
        evaluation: {
          referenceFeedback: '回答应包含情境、行动和结果三个部分。'
        },
        effects: { pause: true }
      }, {
        id: 'node-1787050355527-4wdgt0',
        enabled: true,
        family: 'practice',
        interaction: 'choice',
        trigger: {
          kind: 'time_cross',
          timeSeconds: 173.2,
          captionId: 'caption-11'
        },
        display: {
          title: '具体经历判断（已编辑）',
          prompt: '哪一种回答更具体？',
          options: [
            { id: 'a', label: '我很努力' },
            { id: 'b', label: '我解决了一次项目延期' }
          ]
        },
        evaluation: {
          answer: 'b',
          explanation: '具体经历能让答案可验证。'
        },
        effects: { pause: true }
      }],
      updatedAt: '2026-08-18T12:39:29.688Z'
    }],
    updatedAt: '2026-08-18T12:39:29.688Z'
  };

  return {
    EXAMPLE_COURSE_ID,
    EXAMPLE_COURSE_PACKAGE
  };
});
