import { InstalledCourse } from '../storage/types';
import { checkCoursePackage } from './validate';

export const EXAMPLE_COURSE_ID = '1dfaf2f0-f826-46e8-afdb-89e2d0468a22';
export const EXAMPLE_VIDEO_ID = 'BV1WW4y1e7GL';
export const EXAMPLE_SOURCE_ID = `builtin:example:${EXAMPLE_COURSE_ID}`;

const text = (value: string) => ({
  schemaVersion: 1 as const,
  blocks: [{ type: 'paragraph' as const, children: [{ text: value }] }],
});
const base = (id: string, timeSeconds: number, title: string, interaction: string, content: ReturnType<typeof text>) => ({
  id, enabled: true as const, family: interaction === 'notice' ? 'attention' as const : 'practice' as const,
  interaction, anchor: { kind: 'time_cross' as const, timeSeconds, captionId: null }, title,
  content, presentationHints: { windowSize: 'm' as const, windowStyle: 'document' as const }, effects: { pause: true as const },
});

export const EXAMPLE_COURSE_PACKAGE = {
  schemaVersion: 3,
  courseId: EXAMPLE_COURSE_ID,
  releaseId: '4c93a3d2-7d3b-4a3d-9d5c-5a9ac56a2bc1',
  releaseNumber: 1,
  title: '英语面试表达：把答案说得具体',
  updatedAt: '2026-08-18T12:39:29.688Z',
  assets: [],
  lessons: [{
    lessonId: 'a9a6f97e-475f-47e0-8412-993cc0f14ad8',
    title: '第一课 · 用具体经历回答',
    videoRef: { platform: 'bilibili', videoId: EXAMPLE_VIDEO_ID },
    nodes: [
      { ...base('example-overview', 1, '重点提示', 'notice', text('把答案说得具体：用情境、行动和结果说明自己的经历。')), interactionData: null },
      { ...base('example-notice', 10, '重点提醒', 'notice', text('只说“我很努力”还不够，还要说清楚具体经历、采取的行动和最后的结果。')), interactionData: null },
      { ...base('example-choice', 51, '选择题', 'choice', text('哪一个选项最能说明这句话的重点？')), interactionData: { options: [{ id: 'a', label: '只说自己的品质' }, { id: 'b', label: '给出具体经历' }], answer: 'b', explanation: '具体经历能让答案可验证。' } },
      { ...base('example-blank', 78, '填空题', 'blank', text('请填入这句话中最关键的表达。')), interactionData: { acceptedAnswers: ['suggested'], normalize: ['trim', 'casefold'], explanation: '答案需要保留具体动作和结果。' } },
      { ...base('example-free-text', 109, '问答题', 'free_text', text('请用自己的经历说明你如何解决一个困难情况。')), interactionData: { referenceFeedback: '回答应包含情境、行动和结果三个部分。' } },
      { ...base('example-choice-again', 173.2, '具体经历判断', 'choice', text('哪一种回答更具体？')), interactionData: { options: [{ id: 'a', label: '我很努力' }, { id: 'b', label: '我解决了一次项目延期' }], answer: 'b', explanation: '具体经历能让答案可验证。' } },
    ],
  }],
} as const;

export function createExampleCourse(): InstalledCourse {
  const checked = checkCoursePackage(EXAMPLE_COURSE_PACKAGE, EXAMPLE_SOURCE_ID);
  if (!checked.ok) throw new Error(`内置示例课程无效：${checked.reason}`);
  return { ...checked.value, source: 'example', readOnly: true, sourceId: EXAMPLE_SOURCE_ID };
}
