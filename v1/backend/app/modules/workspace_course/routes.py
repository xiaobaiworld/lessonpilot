from fastapi import APIRouter, Depends, Request, Response

from app.api.errors import ApiError
from app.infrastructure.database.session import get_db
from app.modules.authoring_release.application_service import AuthoringReleaseApplicationService
from app.modules.entitlement_delivery.application_service import EntitlementApplicationService
from app.modules.identity.dependencies import require_teacher
from app.modules.identity.models import TeacherAccount
from app.modules.workspace_course.application_service import (
    WorkspaceCourseApplicationService,
    WorkspaceCourseError,
)
from app.modules.workspace_course.models import Course, Lesson
from app.modules.workspace_course.schemas import (
    CourseCreate,
    CourseDetail,
    CourseListItem,
    CourseMetrics,
    CourseListResponse,
    CourseSummary,
    CourseUpdate,
    LessonCreate,
    LessonOrderRequest,
    LessonPublic,
    LessonUpdate,
    VideoRef,
)
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/teacher", tags=["teacher-courses"])


def get_service(db: Session = Depends(get_db)) -> WorkspaceCourseApplicationService:
    return WorkspaceCourseApplicationService(db)


def _course(course: Course) -> CourseSummary:
    return CourseSummary(
        id=course.id,
        version_family_id=course.version_family_id,
        source_course_id=course.source_course_id,
        source_release_id=course.source_release_id,
        version_number=course.version_number,
        title=course.title,
        description=course.description,
        status=course.status,
        revision=course.revision,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


def _lesson(lesson: Lesson, has_draft: bool = False) -> LessonPublic:
    return LessonPublic(
        id=lesson.id,
        course_id=lesson.course_id,
        title=lesson.title,
        sort_order=lesson.sequence,
        revision=lesson.revision,
        video_ref=VideoRef(
            platform=lesson.video_reference.platform,
            video_id=lesson.video_reference.platform_video_id,
        ),
        has_draft=has_draft,
        status="draft",
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
    )


def _detail(course: Course, draft_lesson_ids: set[str] | None = None) -> CourseDetail:
    draft_lesson_ids = draft_lesson_ids or set()
    return CourseDetail(
        **_course(course).model_dump(),
        lessons=[
            _lesson(item, item.id in draft_lesson_ids)
            for item in sorted(course.lessons, key=lambda row: row.sequence)
        ],
    )


def _map_error(error: WorkspaceCourseError) -> ApiError:
    if error.code.endswith("REVISION_CONFLICT"):
        return ApiError(409, error.code, "内容已被其他操作修改，请刷新后重试")
    if error.code == "LESSON_ORDER_INVALID":
        return ApiError(422, error.code, "课节顺序必须完整且不能重复")
    return ApiError(404, error.code, "对象不存在或无权访问")


@router.get("/courses", response_model=CourseListResponse)
def list_courses(
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
) -> CourseListResponse:
    courses = service.list_courses(teacher.id)
    lesson_ids_by_course = {
        course.id: [lesson.id for lesson in course.lessons] for course in courses
    }
    authoring_metrics = AuthoringReleaseApplicationService(
        service.session
    ).course_dashboard_metrics(lesson_ids_by_course)
    delivery_metrics = EntitlementApplicationService(
        service.session, request.app.state.settings.access_code_secret or ""
    ).course_dashboard_metrics(teacher.id, [course.id for course in courses])
    items = []
    for course in courses:
        metrics = {
            "lesson_count": len(lesson_ids_by_course[course.id]),
            **authoring_metrics[course.id],
            **delivery_metrics[course.id],
            # 学生作答统计先冻结接口字段，具体数据源和聚合规则后续实现。
            "student_submission_count": None,
        }
        items.append(
            CourseListItem(**_course(course).model_dump(), metrics=CourseMetrics(**metrics))
        )
    return CourseListResponse(items=items)


@router.post("/courses", response_model=CourseSummary, status_code=201)
def create_course(
    payload: CourseCreate,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
) -> CourseSummary:
    return _course(service.create_course(teacher.id, payload.title, payload.description))


@router.get("/courses/{course_id}", response_model=CourseDetail)
def get_course(
    course_id: str,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
    db: Session = Depends(get_db),
) -> CourseDetail:
    try:
        course = service.get_course(teacher.id, course_id)
        draft_ids = AuthoringReleaseApplicationService(db).draft_lesson_ids(
            lesson.id for lesson in course.lessons
        )
        return _detail(course, draft_ids)
    except WorkspaceCourseError as error:
        raise _map_error(error) from error


@router.patch("/courses/{course_id}", response_model=CourseSummary)
def update_course(
    course_id: str,
    payload: CourseUpdate,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
) -> CourseSummary:
    try:
        return _course(
            service.update_course(
                teacher.id, course_id, payload.revision, payload.title, payload.description
            )
        )
    except WorkspaceCourseError as error:
        raise _map_error(error) from error


@router.post("/courses/{course_id}/archive", response_model=CourseSummary)
def archive_course(
    course_id: str,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
) -> CourseSummary:
    try:
        return _course(service.archive_course(teacher.id, course_id))
    except WorkspaceCourseError as error:
        raise _map_error(error) from error


@router.post("/courses/{course_id}/lessons", response_model=LessonPublic, status_code=201)
def create_lesson(
    course_id: str,
    payload: LessonCreate,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
) -> LessonPublic:
    try:
        return _lesson(
            service.create_lesson(
                teacher.id,
                course_id,
                payload.title,
                payload.video_ref.platform,
                payload.video_ref.video_id,
            )
        )
    except WorkspaceCourseError as error:
        raise _map_error(error) from error


@router.get("/lessons/{lesson_id}", response_model=LessonPublic)
def get_lesson(
    lesson_id: str,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
    db: Session = Depends(get_db),
) -> LessonPublic:
    try:
        lesson = service.get_lesson(teacher.id, lesson_id)
        draft_ids = AuthoringReleaseApplicationService(db).draft_lesson_ids([lesson.id])
        return _lesson(lesson, lesson.id in draft_ids)
    except WorkspaceCourseError as error:
        raise _map_error(error) from error


@router.patch("/lessons/{lesson_id}", response_model=LessonPublic)
def update_lesson(
    lesson_id: str,
    payload: LessonUpdate,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
    db: Session = Depends(get_db),
) -> LessonPublic:
    try:
        lesson = service.update_lesson(
            teacher.id,
            lesson_id,
            payload.revision,
            payload.title,
            payload.video_ref.platform if payload.video_ref else None,
            payload.video_ref.video_id if payload.video_ref else None,
        )
        draft_ids = AuthoringReleaseApplicationService(db).draft_lesson_ids([lesson.id])
        return _lesson(lesson, lesson.id in draft_ids)
    except WorkspaceCourseError as error:
        raise _map_error(error) from error


@router.delete("/lessons/{lesson_id}", status_code=204)
def delete_lesson(
    lesson_id: str,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
) -> Response:
    try:
        service.delete_lesson(teacher.id, lesson_id)
    except WorkspaceCourseError as error:
        raise _map_error(error) from error
    return Response(status_code=204)


@router.put("/courses/{course_id}/lesson-order", response_model=CourseDetail)
def reorder_lessons(
    course_id: str,
    payload: LessonOrderRequest,
    teacher: TeacherAccount = Depends(require_teacher),
    service: WorkspaceCourseApplicationService = Depends(get_service),
    db: Session = Depends(get_db),
) -> CourseDetail:
    try:
        course = service.reorder_lessons(
            teacher.id, course_id, payload.course_revision, payload.lesson_ids
        )
        draft_ids = AuthoringReleaseApplicationService(db).draft_lesson_ids(
            lesson.id for lesson in course.lessons
        )
        return _detail(course, draft_ids)
    except WorkspaceCourseError as error:
        raise _map_error(error) from error
