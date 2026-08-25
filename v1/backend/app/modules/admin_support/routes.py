from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.infrastructure.database.session import get_db
from app.modules.admin_support.application_service import AdminSupportApplicationService
from app.modules.admin_support.models import TrialFollowup
from app.modules.identity.dependencies import require_admin
from app.modules.identity.models import AdminAccount

router = APIRouter(prefix="/api/v1/admin/trial-followups", tags=["admin-support"])


class FollowupWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["pending", "contacted", "closed"]


def _public(item: TrialFollowup) -> dict:
    return {
        "id": item.id,
        "feishu_record_ref": item.feishu_record_ref,
        "status": item.status,
        "teacher_id": item.teacher_id,
        "updated_at": item.updated_at,
    }


@router.get("")
def list_trial_followups(
    _admin: AdminAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    return {
        "items": [
            _public(item) for item in AdminSupportApplicationService(db).list_trial_followups()
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
    return _public(item)
