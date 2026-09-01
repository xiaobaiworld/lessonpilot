from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.infrastructure.database.session import get_db
from app.modules.admin_support.application_service import AdminSupportApplicationService
from app.modules.admin_support.models import TrialApplication, TrialFollowup
from app.modules.admin_support.schemas import (
    TrialApplicationAdminItem,
    TrialApplicationCreate,
    TrialApplicationCreated,
)
from app.modules.admin_support.trial_intake import TrialSubmissionRateLimiter
from app.modules.identity.dependencies import require_admin
from app.modules.identity.models import AdminAccount

public_router = APIRouter(prefix="/api/v1/public/trial-applications", tags=["public-trial"])
router = APIRouter(prefix="/api/v1/admin/trial-followups", tags=["admin-support"])
applications_router = APIRouter(prefix="/api/v1/admin/trial-applications", tags=["admin-support"])


class FollowupWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["pending", "contacted", "closed"]


def _followup_public(item: TrialFollowup) -> dict:
    return {
        "id": item.id,
        "trial_application_id": item.trial_application_id,
        "status": item.status,
        "teacher_id": item.teacher_id,
        "updated_at": item.updated_at,
    }


def _application_public(item: TrialApplication) -> TrialApplicationAdminItem:
    if item.followup is None:
        raise RuntimeError("TRIAL_FOLLOWUP_MISSING")
    return TrialApplicationAdminItem(
        id=item.id,
        name=item.name,
        contact=item.contact,
        courseCategory=item.course_category,
        videoStatus=item.video_status,
        bilibiliUrl=item.bilibili_url,
        teachingProblem=item.teaching_problem,
        subtitleStatus=item.subtitle_status,
        validationQuestion=item.validation_question,
        source=item.source,
        submittedAt=item.submitted_at,
        followupId=item.followup.id,
        status=item.followup.status,
    )


@public_router.post("", response_model=TrialApplicationCreated, status_code=201)
def create_trial_application(
    payload: TrialApplicationCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> TrialApplicationCreated:
    if payload.website:
        raise ApiError(400, "ANTI_SPAM_REJECTED", "提交未通过安全检查，请返回后重试")

    limiter: TrialSubmissionRateLimiter = request.app.state.trial_submission_rate_limiter
    client_key = request.headers.get("X-Real-IP") or (
        request.client.host if request.client is not None else "unknown"
    )
    if not limiter.allow(client_key):
        raise ApiError(429, "TRIAL_RATE_LIMITED", "提交过于频繁，请稍后再试")

    application = AdminSupportApplicationService(db).create_trial_application(
        name=payload.name,
        contact=payload.contact,
        course_category=payload.course_category,
        video_status=payload.video_status,
        bilibili_url=payload.bilibili_url,
        teaching_problem=payload.teaching_problem,
        subtitle_status=payload.subtitle_status,
        validation_question=payload.validation_question,
    )
    request_id = getattr(request.state, "request_id", "")
    return TrialApplicationCreated(
        applicationId=application.id,
        status="accepted",
        requestId=request_id,
    )


@applications_router.get("", response_model=list[TrialApplicationAdminItem])
def list_trial_applications(
    _admin: AdminAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[TrialApplicationAdminItem]:
    return [
        _application_public(item)
        for item in AdminSupportApplicationService(db).list_trial_applications()
    ]


@router.get("")
def list_trial_followups(
    _admin: AdminAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    return {
        "items": [
            _followup_public(item)
            for item in AdminSupportApplicationService(db).list_trial_followups()
        ]
    }


@router.patch("/{followup_id}")
def update_trial_followup(
    followup_id: str,
    payload: FollowupWrite,
    admin: AdminAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    item = AdminSupportApplicationService(db).update_trial_followup(
        followup_id, payload.status, admin.id
    )
    if not item:
        raise ApiError(404, "TRIAL_FOLLOWUP_NOT_FOUND", "跟进记录不存在")
    return _followup_public(item)
