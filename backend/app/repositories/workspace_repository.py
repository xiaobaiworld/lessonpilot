from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workspace import Workspace


def get_workspace_by_owner(session: Session, teacher_id: str) -> Workspace | None:
    return session.scalar(select(Workspace).where(Workspace.owner_teacher_id == teacher_id))


def add_workspace(session: Session, workspace: Workspace) -> Workspace:
    session.add(workspace)
    return workspace
