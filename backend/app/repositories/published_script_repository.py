from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.published_script import PublishedScript


def get_latest_published_script(session: Session, lesson_id: str) -> PublishedScript | None:
    return session.scalar(
        select(PublishedScript)
        .where(PublishedScript.lesson_id == lesson_id)
        .order_by(desc(PublishedScript.version))
        .limit(1)
    )


def add_published_script(session: Session, script: PublishedScript) -> PublishedScript:
    session.add(script)
    return script
