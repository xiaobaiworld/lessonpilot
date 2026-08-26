from uuid import uuid4

from sqlalchemy.orm import Session

from app.modules.identity.models import TeacherAccount
from app.modules.workspace_course import repository
from app.modules.workspace_course.models import (
    Course,
    CourseStatus,
    Lesson,
    VideoReference,
    Workspace,
)


class WorkspaceCourseError(Exception):
    def __init__(self, code: str):
        self.code = code


class WorkspaceCourseApplicationService:
    def __init__(self, session: Session):
        self.session = session

    def create_workspace_for_teacher(self, teacher: TeacherAccount) -> Workspace:
        workspace = Workspace(
            id=str(uuid4()),
            owner_teacher_id=teacher.id,
            name=f"{teacher.display_name}的工作空间",
            status="active",
        )
        self.session.add(workspace)
        self.session.flush()
        return workspace

    def _workspace(self, teacher_id: str) -> Workspace:
        workspace = repository.get_workspace_by_teacher(self.session, teacher_id)
        if not workspace:
            raise WorkspaceCourseError("WORKSPACE_NOT_FOUND")
        return workspace

    def list_courses(self, teacher_id: str) -> list[Course]:
        return repository.list_courses(self.session, self._workspace(teacher_id).id)

    def create_course(self, teacher_id: str, title: str, description: str | None) -> Course:
        course = Course(
            id=str(uuid4()),
            workspace_id=self._workspace(teacher_id).id,
            title=title.strip(),
            description=description.strip() if description else None,
            status=CourseStatus.draft,
        )
        self.session.add(course)
        self.session.commit()
        return course

    def get_course(self, teacher_id: str, course_id: str) -> Course:
        course = repository.get_course(self.session, self._workspace(teacher_id).id, course_id)
        if not course:
            raise WorkspaceCourseError("COURSE_NOT_FOUND")
        return course

    def update_course(
        self,
        teacher_id: str,
        course_id: str,
        revision: int,
        title: str | None,
        description: str | None,
    ) -> Course:
        course = self.get_course(teacher_id, course_id)
        if course.revision != revision:
            raise WorkspaceCourseError("COURSE_REVISION_CONFLICT")
        if title is not None:
            course.title = title.strip()
        if description is not None:
            course.description = description.strip() or None
        course.revision += 1
        self.session.commit()
        return course

    def archive_course(self, teacher_id: str, course_id: str) -> Course:
        course = self.get_course(teacher_id, course_id)
        course.status = CourseStatus.archived
        course.revision += 1
        self.session.commit()
        return course

    def create_lesson(
        self, teacher_id: str, course_id: str, title: str, platform: str, video_id: str
    ) -> Lesson:
        course = self.get_course(teacher_id, course_id)
        lesson = Lesson(
            id=str(uuid4()),
            course_id=course.id,
            sequence=repository.next_lesson_sequence(self.session, course.id),
            title=title.strip(),
        )
        lesson.video_reference = VideoReference(
            id=str(uuid4()),
            platform=platform,
            platform_video_id=video_id,
        )
        self.session.add(lesson)
        course.revision += 1
        self.session.commit()
        return lesson

    def create_import_shell(
        self, teacher_id: str, title: str, description: str | None, lessons: list[dict]
    ) -> tuple[Course, list[Lesson]]:
        """Create only the course structure; the caller completes the aggregate transaction."""
        course = Course(
            id=str(uuid4()),
            workspace_id=self._workspace(teacher_id).id,
            title=title.strip(),
            description=description.strip() if description else None,
            status=CourseStatus.draft,
        )
        self.session.add(course)
        self.session.flush()
        created: list[Lesson] = []
        for item in sorted(lessons, key=lambda value: value["sequence"]):
            lesson = Lesson(
                id=str(uuid4()),
                course_id=course.id,
                sequence=item["sequence"],
                title=item["title"].strip(),
            )
            lesson.video_reference = VideoReference(
                id=str(uuid4()),
                lesson_id=lesson.id,
                platform=item["videoRef"]["platform"],
                platform_video_id=item["videoRef"]["videoId"],
            )
            self.session.add(lesson)
            created.append(lesson)
        self.session.flush()
        return course, created

    def get_lesson(self, teacher_id: str, lesson_id: str) -> Lesson:
        lesson = repository.get_lesson(self.session, self._workspace(teacher_id).id, lesson_id)
        if not lesson:
            raise WorkspaceCourseError("LESSON_NOT_FOUND")
        return lesson

    def update_lesson(
        self,
        teacher_id: str,
        lesson_id: str,
        revision: int,
        title: str | None,
        platform: str | None,
        video_id: str | None,
    ) -> Lesson:
        lesson = self.get_lesson(teacher_id, lesson_id)
        if lesson.revision != revision:
            raise WorkspaceCourseError("LESSON_REVISION_CONFLICT")
        if title is not None:
            lesson.title = title.strip()
        if platform is not None and video_id is not None:
            lesson.video_reference.platform = platform
            lesson.video_reference.platform_video_id = video_id
        lesson.revision += 1
        self.session.commit()
        return lesson

    def delete_lesson(self, teacher_id: str, lesson_id: str) -> None:
        lesson = self.get_lesson(teacher_id, lesson_id)
        course = self.get_course(teacher_id, lesson.course_id)
        self.session.delete(lesson)
        self.session.flush()
        self._write_lesson_order(
            course, [item.id for item in course.lessons if item.id != lesson_id]
        )
        course.revision += 1
        self.session.commit()

    def reorder_lessons(
        self, teacher_id: str, course_id: str, course_revision: int, lesson_ids: list[str]
    ) -> Course:
        course = self.get_course(teacher_id, course_id)
        if course.revision != course_revision:
            raise WorkspaceCourseError("COURSE_REVISION_CONFLICT")
        current_ids = [lesson.id for lesson in course.lessons]
        if len(lesson_ids) != len(set(lesson_ids)) or set(lesson_ids) != set(current_ids):
            raise WorkspaceCourseError("LESSON_ORDER_INVALID")
        self._write_lesson_order(course, lesson_ids)
        course.revision += 1
        self.session.commit()
        return course

    def _write_lesson_order(self, course: Course, lesson_ids: list[str]) -> None:
        by_id = {lesson.id: lesson for lesson in course.lessons}
        for index, lesson_id in enumerate(lesson_ids, start=1):
            by_id[lesson_id].sequence = -index
        self.session.flush()
        for index, lesson_id in enumerate(lesson_ids, start=1):
            lesson = by_id[lesson_id]
            lesson.sequence = index
            lesson.revision += 1
