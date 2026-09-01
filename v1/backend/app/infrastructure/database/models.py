"""导入全部模型，使 Alembic 和运行时共享同一份 SQLAlchemy metadata。"""

from app.modules.admin_support.models import RightsAttestation, TrialApplication, TrialFollowup
from app.modules.authoring_release.models import PreviewSession, ScriptDraft
from app.modules.authoring_release.release_models import (
    CourseRelease,
    CourseVersionOperation,
    ReleaseAvailability,
    ReleaseLessonSnapshot,
)
from app.modules.entitlement_delivery.models import AccessCode, GrantItem, Redemption
from app.modules.identity.models import (
    AdminAccount,
    AdminSession,
    TeacherAccount,
    TeacherSession,
)
from app.modules.runtime_audit.models import OperationAudit
from app.modules.workspace_course.models import Course, Lesson, VideoReference, Workspace

__all__ = [
    "AccessCode",
    "AdminAccount",
    "AdminSession",
    "Course",
    "CourseRelease",
    "CourseVersionOperation",
    "GrantItem",
    "Lesson",
    "OperationAudit",
    "PreviewSession",
    "Redemption",
    "ReleaseAvailability",
    "ReleaseLessonSnapshot",
    "ScriptDraft",
    "RightsAttestation",
    "TrialApplication",
    "TeacherAccount",
    "TeacherSession",
    "TrialFollowup",
    "VideoReference",
    "Workspace",
]
