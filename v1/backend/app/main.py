from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import ApiError, api_error_handler
from app.config import Settings
from app.infrastructure.database.session import create_database_engine, create_session_factory
from app.infrastructure.logging.config import configure_logging
from app.middleware import RequestIdMiddleware
from app.modules.identity.routes import (
    admin_auth_router,
    admin_teacher_router,
    teacher_auth_router,
)
from app.modules.authoring_release.routes import (
    admin_router as admin_course_package_router,
    router as authoring_release_router,
)
from app.modules.authoring_release.asset_storage import AssetStorage
from app.modules.admin_support.routes import (
    applications_router as admin_trial_applications_router,
    public_router as public_trial_router,
    router as admin_support_router,
)
from app.modules.admin_support.trial_intake import TrialSubmissionRateLimiter
from app.modules.entitlement_delivery.routes import student_router, teacher_router
from app.modules.runtime_audit.routes import router as runtime_router
from app.modules.workspace_course.routes import router as workspace_course_router


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings()
    resolved_settings.validate_runtime()
    configure_logging(resolved_settings)
    engine = create_database_engine(resolved_settings)

    app = FastAPI(
        title="KnownMap v1 API",
        version=resolved_settings.app_version,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    app.state.settings = resolved_settings
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)
    app.state.trial_submission_rate_limiter = TrialSubmissionRateLimiter(
        resolved_settings.trial_submission_rate_limit_count,
        resolved_settings.trial_submission_rate_limit_window_seconds,
    )
    app.state.asset_storage = AssetStorage(
        resolved_settings.asset_storage_dir,
        max_bytes=resolved_settings.asset_max_bytes,
        timeout_seconds=resolved_settings.asset_link_timeout_seconds,
    )
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(ApiError, api_error_handler)
    app.include_router(runtime_router)
    app.include_router(admin_auth_router)
    app.include_router(admin_teacher_router)
    app.include_router(teacher_auth_router)
    app.include_router(workspace_course_router)
    app.include_router(authoring_release_router)
    app.include_router(admin_course_package_router)
    app.include_router(admin_support_router)
    app.include_router(admin_trial_applications_router)
    app.include_router(public_trial_router)
    app.include_router(teacher_router)
    app.include_router(student_router)
    return app


app = create_app()
