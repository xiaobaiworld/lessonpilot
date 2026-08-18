from collections.abc import Generator

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.db_base import Base
from app.models.course import Course  # noqa: F401
from app.models.lesson import Lesson  # noqa: F401
from app.models.operation_log import OperationLog  # noqa: F401
from app.models.script_draft import ScriptDraft  # noqa: F401
from app.models.teacher import Teacher  # noqa: F401
from app.models.teacher_session import TeacherSession  # noqa: F401
from app.models.workspace import Workspace  # noqa: F401

def create_database_engine(settings: Settings) -> Engine:
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    engine_kwargs = {"connect_args": connect_args, "future": True}
    if settings.database_url in {"sqlite:///:memory:", "sqlite+pysqlite:///:memory:"}:
        engine_kwargs["poolclass"] = StaticPool
    return create_engine(settings.database_url, **engine_kwargs)


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def create_tables(engine: Engine) -> None:
    Base.metadata.create_all(engine)


def get_db(request: Request) -> Generator[Session, None, None]:
    session_factory = request.app.state.session_factory
    with session_factory() as session:
        yield session
