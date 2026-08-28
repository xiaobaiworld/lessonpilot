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

export function buildBilibiliLessonUrl(
  video: unknown,
  page = 1,
  cid: string | null = null
): string | null {
  if (typeof video !== 'string' || !/^BV[a-zA-Z0-9]{10}$/.test(video)) return null;
  if (!Number.isSafeInteger(page) || page < 1 || (cid !== null && !/^\d+$/.test(cid))) return null;
  const query = new URLSearchParams();
  if (page !== 1) query.set('p', String(page));
  if (cid !== null) query.set('cid', cid);
  const suffix = query.toString();
  return `https://www.bilibili.com/video/${video}/${suffix ? `?${suffix}` : ''}`;
}

export function buildCompanionCourseRecords(
  courses: CourseView[] | LibraryView['courses']
): CompanionCourseRecord[] {
  const records: CompanionCourseRecord[] = [];
  for (const course of courses) {
    if (!course || typeof course.title !== 'string') continue;
    for (const lesson of course.lessons ?? []) {
      const url = buildBilibiliLessonUrl(lesson.videoId, lesson.page, lesson.cid);
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
