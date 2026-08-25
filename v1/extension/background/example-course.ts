import { InstalledCourse } from '../storage/types';
import { checkCoursePackage } from './validate';

/**
 * 随插件发布的只读示例课程。
 *
 * 这份数据是公开演示内容，不是授权课程，也不通过授权码安装。它故意使用
 * 与教师课程不同的固定身份，便于课程库、B 站匹配和节点运行时做完整验收。
 */
export const EXAMPLE_COURSE_ID = '1dfaf2f0-f826-46e8-afdb-89e2d0468a22';
export const EXAMPLE_VIDEO_ID = 'BV1WW4y1e7GL';
export const EXAMPLE_SOURCE_ID = `builtin:example:${EXAMPLE_COURSE_ID}`;

export const EXAMPLE_COURSE_PACKAGE = {
  schemaVersion: 2,
  courseId: EXAMPLE_COURSE_ID,
  releaseId: '4c93a3d2-7d3b-4a3d-9d5c-5a9ac56a2bc1',
  releaseNumber: 1,
  title: '英语面试表达：把答案说得具体',
  updatedAt: '2026-08-18T12:39:29.688Z',
  lessons: [
    {
      lessonId: 'a9a6f97e-475f-47e0-8412-993cc0f14ad8',
      title: '第一课 · 用具体经历回答',
      videoRef: { platform: 'bilibili', videoId: EXAMPLE_VIDEO_ID },
      nodes: [
        {
          id: 'example-overview',
          enabled: true,
          family: 'attention',
          interaction: 'notice',
          trigger: { kind: 'time_cross', timeSeconds: 1, captionId: null },
          display: {
            title: '重点提示',
            body:
              '这是一节关于“把答案说得具体”的互动课。请按下面的顺序学习：先注意示范中的表达差异，再完成选择题、填空题和问答题。重点不是背固定答案，而是用“情境—行动—结果”的方式说明自己的经历。',
          },
          effects: { pause: true },
          evaluation: null,
        },
        {
          id: 'example-notice',
          enabled: true,
          family: 'attention',
          interaction: 'notice',
          trigger: { kind: 'time_cross', timeSeconds: 10, captionId: null },
          display: {
            title: '重点提醒',
            body: '请记住：只说“我很努力”还不够，还要说清楚具体经历、采取的行动和最后的结果。',
          },
          effects: { pause: true },
          evaluation: null,
        },
        {
          id: 'example-choice',
          enabled: true,
          family: 'practice',
          interaction: 'choice',
          trigger: { kind: 'time_cross', timeSeconds: 51, captionId: null },
          display: {
            title: '选择题',
            prompt: '哪一个选项最能说明这句话的重点？',
            options: [
              { id: 'a', label: '只说自己的品质' },
              { id: 'b', label: '给出具体经历' },
            ],
          },
          evaluation: { answer: 'b', explanation: '具体经历能让答案可验证。' },
          effects: { pause: true },
        },
        {
          id: 'example-blank',
          enabled: true,
          family: 'practice',
          interaction: 'blank',
          trigger: { kind: 'time_cross', timeSeconds: 78, captionId: null },
          display: {
            title: '填空题',
            prompt: '请填入这句话中最关键的表达。',
          },
          evaluation: {
            acceptedAnswers: ['suggested'],
            normalize: ['trim', 'casefold'],
            explanation: '答案需要保留具体动作和结果。',
          },
          effects: { pause: true },
        },
        {
          id: 'example-free-text',
          enabled: true,
          family: 'practice',
          interaction: 'free_text',
          trigger: { kind: 'time_cross', timeSeconds: 109, captionId: null },
          display: {
            title: '问答题',
            prompt: '请用自己的经历说明你如何解决一个困难情况。',
          },
          evaluation: { referenceFeedback: '回答应包含情境、行动和结果三个部分。' },
          effects: { pause: true },
        },
        {
          id: 'example-choice-again',
          enabled: true,
          family: 'practice',
          interaction: 'choice',
          trigger: { kind: 'time_cross', timeSeconds: 173.2, captionId: null },
          display: {
            title: '具体经历判断',
            prompt: '哪一种回答更具体？',
            options: [
              { id: 'a', label: '我很努力' },
              { id: 'b', label: '我解决了一次项目延期' },
            ],
          },
          evaluation: { answer: 'b', explanation: '具体经历能让答案可验证。' },
          effects: { pause: true },
        },
      ],
    },
  ],
} as const;

export function createExampleCourse(): InstalledCourse {
  const checked = checkCoursePackage(EXAMPLE_COURSE_PACKAGE, EXAMPLE_SOURCE_ID);
  if (!checked.ok) throw new Error(`内置示例课程无效：${checked.reason}`);

  return {
    ...checked.value,
    source: 'example',
    readOnly: true,
    sourceId: EXAMPLE_SOURCE_ID,
  };
}
