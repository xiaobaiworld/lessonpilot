from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.script_draft import ScriptDraft


def get_script_draft(session: Session, lesson_id: str) -> ScriptDraft | None:
    return session.scalar(select(ScriptDraft).where(ScriptDraft.lesson_id == lesson_id))


def add_script_draft(session: Session, draft: ScriptDraft) -> ScriptDraft:
    session.add(draft)
    return draft
