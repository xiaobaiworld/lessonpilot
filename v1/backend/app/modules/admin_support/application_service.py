from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.admin_support.models import RightsAttestation, TrialFollowup
from app.modules.identity.application_service import IdentityApplicationService
from app.modules.identity.models import TeacherAccount
from app.modules.workspace_course.application_service import WorkspaceCourseApplicationService


class AdminSupportApplicationService:
    def __init__(self, session: Session, session_secret: str | None = None):
        self.session = session
        self.session_secret = session_secret

    def create_teacher(self, login_name: str, display_name: str) -> tuple[TeacherAccount, str]:
        if not self.session_secret:
            raise ValueError("SESSION_SECRET_UNAVAILABLE")
        try:
            teacher, temporary_password = IdentityApplicationService(
                self.session, self.session_secret
            ).create_teacher(login_name, display_name)
            WorkspaceCourseApplicationService(self.session).create_workspace_for_teacher(teacher)
            self.session.commit()
            return teacher, temporary_password
        except Exception:
            self.session.rollback()
            raise

    def attest_rights(
        self,
        teacher_id: str,
        course_id: str,
        statement_version: str,
        accepted: bool,
    ) -> RightsAttestation:
        if not accepted:
            raise ValueError("RIGHTS_NOT_ACCEPTED")
        attestation = RightsAttestation(
            id=str(uuid4()),
            statement_version=statement_version,
            teacher_id=teacher_id,
            scope_type="course_release",
            scope_id=course_id,
            result="accepted",
        )
        self.session.add(attestation)
        self.session.commit()
        return attestation

    def latest_rights(self, teacher_id: str, course_id: str) -> RightsAttestation | None:
        return self.session.scalar(
            select(RightsAttestation)
            .where(
                RightsAttestation.teacher_id == teacher_id,
                RightsAttestation.scope_type == "course_release",
                RightsAttestation.scope_id == course_id,
                RightsAttestation.result == "accepted",
            )
            .order_by(RightsAttestation.attested_at.desc())
        )

    def list_trial_followups(self) -> list[TrialFollowup]:
        return list(
            self.session.scalars(select(TrialFollowup).order_by(TrialFollowup.updated_at.desc()))
        )

    def update_trial_followup(
        self, followup_id: str, status: str, admin_id: str
    ) -> TrialFollowup | None:
        if status not in {"pending", "contacted", "closed"}:
            raise ValueError("TRIAL_FOLLOWUP_STATUS_INVALID")
        followup = self.session.get(TrialFollowup, followup_id)
        if not followup:
            return None
        followup.status = status
        followup.updated_by_admin_id = admin_id
        self.session.commit()
        return followup
