import { CourseView, LibraryView } from '../shared/library-view';

export interface CompanionCourseRecord {
  courseId: string;
  lessonId: string;
  label: string;
  url: string;
}

export function normalizeAccessCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function buildBilibiliLessonUrl(videoId: unknown): string | null {
  if (typeof videoId !== 'string' || !/^BV[a-zA-Z0-9]+$/.test(videoId)) return null;
  return `https://www.bilibili.com/video/${videoId}/`;
}

export function buildCompanionCourseRecords(
  courses: CourseView[] | LibraryView['courses']
): CompanionCourseRecord[] {
  const records: CompanionCourseRecord[] = [];
  for (const course of courses) {
    if (!course || typeof course.title !== 'string') continue;
    for (const lesson of course.lessons ?? []) {
      const url = buildBilibiliLessonUrl(lesson.videoId);
      if (!url) continue;
      const label =
        course.lessons.length > 1
          ? `${course.title.trim()} · ${lesson.title.trim()}`
          : course.title.trim();
      if (!label) continue;
      records.push({
        courseId: course.courseId,
        lessonId: lesson.lessonId,
        label,
        url,
      });
    }
  }
  return records;
}
