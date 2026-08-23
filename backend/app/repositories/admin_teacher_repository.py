from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.teacher import Teacher
from app.models.workspace import Workspace


@dataclass(frozen=True)
class AdminTeacherSummaryRow:
    id: str
    login_name: str
    display_name: str
    status: str
    published_course_count: int
    created_at: datetime
    updated_at: datetime


def _teacher_summary_statement() -> Select:
    published_course_count = func.count(Course.id).label("published_course_count")
    return (
        select(
            Teacher.id,
            Teacher.login_name,
            Teacher.display_name,
            Teacher.status,
            published_course_count,
            Teacher.created_at,
            Teacher.updated_at,
        )
        .outerjoin(Workspace, Workspace.owner_teacher_id == Teacher.id)
        .outerjoin(
            Course,
            and_(
                Course.workspace_id == Workspace.id,
                Course.status == "published",
            ),
        )
        .group_by(
            Teacher.id,
            Teacher.login_name,
            Teacher.display_name,
            Teacher.status,
            Teacher.created_at,
            Teacher.updated_at,
        )
    )


def _to_summary(row) -> AdminTeacherSummaryRow:
    mapping = row._mapping
    return AdminTeacherSummaryRow(
        id=mapping["id"],
        login_name=mapping["login_name"],
        display_name=mapping["display_name"],
        status=mapping["status"],
        published_course_count=int(mapping["published_course_count"]),
        created_at=mapping["created_at"],
        updated_at=mapping["updated_at"],
    )


def list_admin_teacher_summaries(session: Session) -> list[AdminTeacherSummaryRow]:
    rows = session.execute(_teacher_summary_statement().order_by(Teacher.login_name)).all()
    return [_to_summary(row) for row in rows]


def get_admin_teacher_summary(
    session: Session,
    teacher_id: str,
) -> AdminTeacherSummaryRow | None:
    row = session.execute(
        _teacher_summary_statement().where(Teacher.id == teacher_id)
    ).one_or_none()
    return _to_summary(row) if row is not None else None
