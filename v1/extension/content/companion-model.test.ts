import { describe, expect, it } from 'vitest';
import {
  buildCompanionCourseRecords,
  buildBilibiliLessonUrl,
  normalizeAccessCode,
} from './companion-model';
import { CourseView } from '../shared/library-view';

const course = (overrides: Partial<CourseView> = {}): CourseView => ({
  courseId: 'course-1',
  title: '英语面试表达',
  installedAt: '2026-08-24T00:00:00.000Z',
  nodeCount: 1,
  doneCount: 0,
  percent: 0,
  codeHint: '1234',
  lessons: [
    {
      lessonId: 'lesson-1',
      title: '第一节',
      videoId: 'BV1Ac41187Lm',
      nodeCount: 1,
      doneCount: 0,
      finished: false,
      lastPositionSeconds: 0,
    },
  ],
  ...overrides,
});

describe('学生助手课程书包模型', () => {
  it('规范化授权码，保留旧版输入体验', () => {
    expect(normalizeAccessCode(' km-abcd-1234 ')).toBe('KM-ABCD-1234');
  });

  it('为每个课节生成可打开的 B 站课程记录', () => {
    const records = buildCompanionCourseRecords([
      course({
        lessons: [
          {
            lessonId: 'lesson-1',
            title: '第一节',
            videoId: 'BV1Ac41187Lm',
            nodeCount: 0,
            doneCount: 0,
            finished: false,
            lastPositionSeconds: 0,
          },
          {
            lessonId: 'lesson-2',
            title: '第二节',
            videoId: 'BV1zz411z7zz',
            nodeCount: 0,
            doneCount: 0,
            finished: false,
            lastPositionSeconds: 0,
          },
        ],
      }),
    ]);

    expect(records).toEqual([
      {
        courseId: 'course-1',
        lessonId: 'lesson-1',
        label: '英语面试表达 · 第一节',
        url: 'https://www.bilibili.com/video/BV1Ac41187Lm/',
      },
      {
        courseId: 'course-1',
        lessonId: 'lesson-2',
        label: '英语面试表达 · 第二节',
        url: 'https://www.bilibili.com/video/BV1zz411z7zz/',
      },
    ]);
  });

  it('拒绝不合法的 BVID，避免书包生成坏链接', () => {
    expect(buildBilibiliLessonUrl('not-a-bvid')).toBeNull();
  });
});
