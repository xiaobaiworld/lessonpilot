from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.teacher_session import TeacherSession


def get_active_session(
    session: Session,
    token_digest: str,
    now: datetime | None = None,
) -> TeacherSession | None:
    current_time = now or datetime.now(timezone.utc)
    return session.scalar(
        select(TeacherSession).where(
            TeacherSession.token_digest == token_digest,
            TeacherSession.revoked_at.is_(None),
            TeacherSession.expires_at > current_time,
        )
    )
