import { describe, expect, it } from 'vitest';
import {
  createExampleCourse,
  EXAMPLE_COURSE_ID,
  EXAMPLE_COURSE_PACKAGE,
  EXAMPLE_SOURCE_ID,
  EXAMPLE_VIDEO_ID,
} from './example-course';
import { checkCoursePackage } from './validate';

describe('内置示例课程', () => {
  it('是完整可运行的课程包，并固定到测试 BVID', () => {
    const checked = checkCoursePackage(EXAMPLE_COURSE_PACKAGE, EXAMPLE_SOURCE_ID);
    expect(checked.ok).toBe(true);
    expect(EXAMPLE_COURSE_PACKAGE.courseId).toBe(EXAMPLE_COURSE_ID);
    expect(EXAMPLE_COURSE_PACKAGE.lessons[0].videoRef.videoId).toBe(EXAMPLE_VIDEO_ID);
    expect(EXAMPLE_COURSE_PACKAGE.lessons[0].nodes.length).toBeGreaterThanOrEqual(4);
  });

  it('安装记录标记为示例且只读，不产生授权来源', () => {
    const course = createExampleCourse();
    expect(course).toMatchObject({
      courseId: EXAMPLE_COURSE_ID,
      source: 'example',
      readOnly: true,
      sourceId: EXAMPLE_SOURCE_ID,
    });
  });
});
