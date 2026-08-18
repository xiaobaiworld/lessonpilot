from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import api_error_handler
from app.api.errors import ApiError
from app.api.v1.auth import router as auth_router
from app.api.v1.access_codes import router as access_codes_router
from app.api.v1.health import router as health_router
from app.api.v1.public_courses import router as public_courses_router
from app.api.v1.teacher_courses import router as teacher_courses_router
from app.api.v1.teacher_lessons import router as teacher_lessons_router
from app.api.v1.teacher_scripts import router as teacher_scripts_router
from app.config import Settings
from app.db import create_database_engine, create_session_factory, create_tables
from app.logging import configure_logging
from app.middleware import RequestIdMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings()
    resolved_settings.validate_runtime_secrets()
    configure_logging(resolved_settings)

    engine = create_database_engine(resolved_settings)
    if resolved_settings.app_env in {"development", "test"}:
        create_tables(engine)

    app = FastAPI(
        title="KnownMap Teacher Platform API",
        version=resolved_settings.app_version,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    app.state.settings = resolved_settings
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(ApiError, api_error_handler)
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(access_codes_router)
    app.include_router(public_courses_router)
    app.include_router(teacher_courses_router)
    app.include_router(teacher_lessons_router)
    app.include_router(teacher_scripts_router)
    return app


app = create_app()
