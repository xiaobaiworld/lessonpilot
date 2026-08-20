import base64
import copy
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.access_code import AccessCode
from app.models.access_grant import AccessGrant
from app.models.course import Course
from app.models.lesson import Lesson
from app.models.teacher import Teacher
from app.repositories.access_code_repository import (
    add_access_code,
    get_access_code_by_digest,
    list_access_codes_by_course,
)
from app.repositories.access_grant_repository import add_access_grants
from app.repositories.lesson_repository import get_lesson_by_teacher
from app.repositories.published_script_repository import get_latest_published_script
from app.schemas.publish import PublishedCoursePackage
from app.services.course_service import get_teacher_course


ACCESS_CODE_PATTERN = re.compile(r"^KM-[A-Z2-7]{5}(?:-[A-Z2-7]{5}){3}$")


class CourseNotPublished(Exception):
    pass


class InvalidAccessCode(Exception):
    pass


class CourseNotAvailable(Exception):
    pass


class InvalidAccessScope(Exception):
    pass


def normalize_access_code(value: str) -> str:
    return value.strip().upper()


def digest_access_code(value: str, secret: str) -> str:
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def generate_access_code() -> str:
    token = base64.b32encode(secrets.token_bytes(13)).decode("ascii").rstrip("=")[:20]
    return "KM-" + "-".join(token[index : index + 5] for index in range(0, 20, 5))


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _published_lesson(
    session: Session,
    *,
    course_id: str,
    lesson_id: str,
) -> tuple[dict, str]:
    published = get_latest_published_script(session, lesson_id)
    if published is None:
        raise CourseNotAvailable
    try:
        package = PublishedCoursePackage.model_validate(published.config_json).model_dump(
            by_alias=True,
            mode="json",
        )
    except ValidationError:
        raise CourseNotAvailable from None
    if package["courseId"] != course_id:
        raise CourseNotAvailable
    lesson = next(
        (
            item
            for item in package["lessons"]
            if item["lessonId"] == lesson_id
        ),
        None,
    )
    if lesson is None:
        raise CourseNotAvailable
    return copy.deepcopy(lesson), package["updatedAt"]


def _require_published_lesson(
    session: Session,
    *,
    course_id: str,
    lesson_id: str,
) -> dict:
    try:
        lesson, _updated_at = _published_lesson(
            session,
            course_id=course_id,
            lesson_id=lesson_id,
        )
    except CourseNotAvailable:
        raise CourseNotPublished from None
    return lesson


def _normalize_grant_scopes(
    session: Session,
    teacher: Teacher,
    *,
    default_course_id: str,
    scopes: list[dict] | None,
) -> list[dict]:
    requested = scopes or [{"course_id": default_course_id}]
    normalized: list[dict] = []
    seen: set[tuple] = set()

    for requested_scope in requested:
        course_id = str(requested_scope["course_id"])
        lesson_id_value = requested_scope.get("lesson_id")
        lesson_id = str(lesson_id_value) if lesson_id_value is not None else None
        node_id = requested_scope.get("node_id")
        valid_from = _as_utc(requested_scope.get("valid_from"))
        valid_until = _as_utc(requested_scope.get("valid_until"))

        course = get_teacher_course(session, teacher, course_id)
        if node_id is not None and lesson_id is None:
            raise InvalidAccessScope
        if valid_from is not None and valid_until is not None and valid_until <= valid_from:
            raise InvalidAccessScope

        if lesson_id is None:
            if not course.lessons:
                raise CourseNotPublished
            for lesson in course.lessons:
                _require_published_lesson(
                    session,
                    course_id=course.id,
                    lesson_id=lesson.id,
                )
        else:
            lesson = get_lesson_by_teacher(session, teacher.id, lesson_id)
            if lesson is None:
                get_teacher_course(session, teacher, course_id)
                raise InvalidAccessScope
            if lesson.course_id != course.id:
                raise InvalidAccessScope
            published_lesson = _require_published_lesson(
                session,
                course_id=course.id,
                lesson_id=lesson.id,
            )
            if node_id is not None and node_id not in {
                node.get("id") for node in published_lesson["nodes"]
            }:
                raise InvalidAccessScope

        key = (
            course.id,
            lesson_id,
            node_id,
            valid_from,
            valid_until,
        )
        if key in seen:
            continue
        seen.add(key)
        normalized.append(
            {
                "course_id": course.id,
                "lesson_id": lesson_id,
                "node_id": node_id,
                "valid_from": valid_from,
                "valid_until": valid_until,
            }
        )

    return sorted(
        normalized,
        key=lambda scope: (
            scope["course_id"],
            scope["lesson_id"] or "",
            scope["node_id"] or "",
            scope["valid_from"] or datetime.min.replace(tzinfo=timezone.utc),
            scope["valid_until"] or datetime.max.replace(tzinfo=timezone.utc),
        ),
    )


def create_course_access_code(
    session: Session,
    teacher: Teacher,
    *,
    course_id: str,
    secret: str,
    code_type: str = "long_term",
    scopes: list[dict] | None = None,
) -> tuple[AccessCode, str]:
    course = get_teacher_course(session, teacher, course_id)
    normalized_scopes = _normalize_grant_scopes(
        session,
        teacher,
        default_course_id=course.id,
        scopes=scopes,
    )

    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(days=7) if code_type == "short_term" else None

    for _ in range(5):
        raw_code = generate_access_code()
        digest = digest_access_code(raw_code, secret)
        if get_access_code_by_digest(session, digest) is None:
            row = add_access_code(
                session,
                AccessCode(
                    course_id=course.id,
                    code_digest=digest,
                    code_hint=raw_code[-5:],
                    code_type=code_type,
                    created_at=created_at,
                    expires_at=expires_at,
                ),
            )
            session.flush()
            add_access_grants(
                session,
                [
                    AccessGrant(
                        access_code=row,
                        course_id=scope["course_id"],
                        lesson_id=scope["lesson_id"],
                        node_id=scope["node_id"],
                        valid_from=scope["valid_from"],
                        valid_until=scope["valid_until"],
                        created_at=created_at,
                    )
                    for scope in normalized_scopes
                ],
            )
            session.flush()
            return row, raw_code
    raise RuntimeError("Unable to generate a unique access code.")


def list_course_access_codes(session: Session, course_id: str) -> list[AccessCode]:
    return list_access_codes_by_course(session, course_id)


def access_code_status(row: AccessCode, *, now: datetime | None = None) -> str:
    if row.expires_at is None:
        return "active"
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    current_time = now or datetime.now(timezone.utc)
    return "expired" if expires_at <= current_time else "active"


def access_grant_is_active(
    grant: AccessGrant,
    *,
    now: datetime | None = None,
) -> bool:
    current_time = _as_utc(now) or datetime.now(timezone.utc)
    valid_from = _as_utc(grant.valid_from)
    valid_until = _as_utc(grant.valid_until)
    return (valid_from is None or valid_from <= current_time) and (
        valid_until is None or current_time < valid_until
    )


def _course_lessons(session: Session, course_id: str) -> list[Lesson]:
    return list(
        session.scalars(
            select(Lesson)
            .where(Lesson.course_id == course_id)
            .order_by(Lesson.sort_order, Lesson.id)
        ).all()
    )


def _build_authorized_courses(
    session: Session,
    grants: list[AccessGrant],
) -> list[dict]:
    grants_by_course: dict[str, list[AccessGrant]] = {}
    for grant in grants:
        grants_by_course.setdefault(grant.course_id, []).append(grant)

    courses: list[dict] = []
    for course_id in sorted(grants_by_course):
        course = session.get(Course, course_id)
        if course is None:
            continue
        course_grants = grants_by_course[course_id]
        whole_course = any(grant.lesson_id is None for grant in course_grants)
        lesson_permissions: dict[str, set[str] | None] = {}

        if whole_course:
            for lesson in _course_lessons(session, course_id):
                lesson_permissions[lesson.id] = None
        else:
            for grant in course_grants:
                if grant.lesson_id is None:
                    continue
                current = lesson_permissions.get(grant.lesson_id)
                if grant.node_id is None:
                    lesson_permissions[grant.lesson_id] = None
                elif grant.lesson_id not in lesson_permissions:
                    lesson_permissions[grant.lesson_id] = {grant.node_id}
                elif current is not None:
                    current.add(grant.node_id)

        selected_lessons = {
            lesson.id: lesson
            for lesson in _course_lessons(session, course_id)
            if lesson.id in lesson_permissions
        }
        lessons: list[dict] = []
        updated_values: list[str] = []
        for lesson_id in sorted(
            selected_lessons,
            key=lambda value: (selected_lessons[value].sort_order, value),
        ):
            try:
                lesson_payload, course_updated_at = _published_lesson(
                    session,
                    course_id=course_id,
                    lesson_id=lesson_id,
                )
            except CourseNotAvailable:
                continue
            permitted_nodes = lesson_permissions[lesson_id]
            if permitted_nodes is not None:
                lesson_payload["nodes"] = [
                    node
                    for node in lesson_payload["nodes"]
                    if node.get("id") in permitted_nodes
                ]
            if not lesson_payload["nodes"]:
                continue
            lessons.append(lesson_payload)
            updated_values.extend([course_updated_at, lesson_payload["updatedAt"]])

        if lessons:
            courses.append(
                {
                    "schemaVersion": 2,
                    "courseId": course.id,
                    "title": course.title,
                    "lessons": lessons,
                    "updatedAt": max(updated_values),
                }
            )
    return courses


def download_course_by_access_code(
    session: Session,
    *,
    raw_code: str,
    secret: str,
) -> tuple[AccessCode, list[dict]]:
    normalized = normalize_access_code(raw_code)
    if ACCESS_CODE_PATTERN.fullmatch(normalized) is None:
        raise InvalidAccessCode

    row = get_access_code_by_digest(session, digest_access_code(normalized, secret))
    if row is None or access_code_status(row) == "expired":
        raise InvalidAccessCode

    active_grants = [grant for grant in row.grants if access_grant_is_active(grant)]
    courses = _build_authorized_courses(session, active_grants)
    if not courses:
        raise CourseNotAvailable
    return row, courses
