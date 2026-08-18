import base64
import hashlib
import hmac
import re
import secrets

from sqlalchemy.orm import Session

from app.models.access_code import AccessCode
from app.models.teacher import Teacher
from app.repositories.access_code_repository import (
    add_access_code,
    get_access_code_by_digest,
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
) -> tuple[AccessCode, str]:
    course = get_teacher_course(session, teacher, course_id)
    lesson = course.lesson
    if lesson is None or get_latest_published_script(session, lesson.id) is None:
        raise CourseNotPublished

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
                ),
            )
            session.flush()
            return row, raw_code
    raise RuntimeError("Unable to generate a unique access code.")


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
    if row is None:
        raise InvalidAccessCode

    lesson = get_lesson_by_course(session, row.course_id)
    if lesson is None:
        raise CourseNotAvailable
    published = get_latest_published_script(session, lesson.id)
    if published is None:
        raise CourseNotAvailable
    return row, published.config_json
