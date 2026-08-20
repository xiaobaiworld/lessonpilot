import base64
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.access_code import AccessCode
from app.models.teacher import Teacher
from app.repositories.access_code_repository import (
    add_access_code,
    get_access_code_by_digest,
    list_access_codes_by_course,
)
from app.repositories.lesson_repository import get_lesson_by_course
from app.repositories.published_script_repository import get_latest_published_script
from app.services.course_service import get_teacher_course


ACCESS_CODE_PATTERN = re.compile(r"^KM-[A-Z2-7]{5}(?:-[A-Z2-7]{5}){3}$")


class CourseNotPublished(Exception):
    pass


class InvalidAccessCode(Exception):
    pass


class CourseNotAvailable(Exception):
    pass


def normalize_access_code(value: str) -> str:
    return value.strip().upper()


def digest_access_code(value: str, secret: str) -> str:
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def generate_access_code() -> str:
    token = base64.b32encode(secrets.token_bytes(13)).decode("ascii").rstrip("=")[:20]
    return "KM-" + "-".join(token[index : index + 5] for index in range(0, 20, 5))


def create_course_access_code(
    session: Session,
    teacher: Teacher,
    *,
    course_id: str,
    secret: str,
    code_type: str = "long_term",
) -> tuple[AccessCode, str]:
    course = get_teacher_course(session, teacher, course_id)
    lesson = course.lesson
    if lesson is None or get_latest_published_script(session, lesson.id) is None:
        raise CourseNotPublished

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


def download_course_by_access_code(
    session: Session,
    *,
    raw_code: str,
    secret: str,
) -> tuple[AccessCode, dict]:
    normalized = normalize_access_code(raw_code)
    if ACCESS_CODE_PATTERN.fullmatch(normalized) is None:
        raise InvalidAccessCode

    row = get_access_code_by_digest(session, digest_access_code(normalized, secret))
    if row is None or access_code_status(row) == "expired":
        raise InvalidAccessCode

    lesson = get_lesson_by_course(session, row.course_id)
    if lesson is None:
        raise CourseNotAvailable
    published = get_latest_published_script(session, lesson.id)
    if published is None:
        raise CourseNotAvailable
    return row, published.config_json
