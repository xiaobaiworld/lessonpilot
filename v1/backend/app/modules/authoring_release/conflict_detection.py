"""v1 ConflictDetection and RightsConfirmation - Stage 2E

Detects stale publishes and validates rights confirmation.
"""

from typing import Tuple, Optional
from datetime import datetime, timezone


class ConflictDetectionService:
    """Detect publish conflicts and stale edits."""

    @staticmethod
    def detect_course_conflict(
        current_revision: int,
        source_revision: int,
        current_title: str,
        source_title: str,
    ) -> Tuple[bool, Optional[str]]:
        """Detect if course has been edited since publication attempt.

        Args:
            current_revision: Current course revision number
            source_revision: Revision when publish started
            current_title: Current course title
            source_title: Title when publish started

        Returns:
            (has_conflict, reason)
        """
        if current_revision != source_revision:
            return True, f"Course updated: revision {source_revision} → {current_revision}"

        # Title is a proxy for meaningful edits
        # In a full implementation, would check script_drafts too
        if current_title != source_title:
            return True, f"Course title changed: '{source_title}' → '{current_title}'"

        return False, None

    @staticmethod
    def detect_lesson_conflict(
        lesson_revisions: dict,
        source_revisions: dict,
    ) -> Tuple[bool, Optional[str]]:
        """Detect if lessons have been edited since snapshot.

        Args:
            lesson_revisions: Current { lesson_id: revision_number, ... }
            source_revisions: Captured { lesson_id: revision_number, ... }

        Returns:
            (has_conflict, reason)
        """
        for lesson_id, current_rev in lesson_revisions.items():
            source_rev = source_revisions.get(lesson_id)
            if source_rev is None:
                return True, f"New lesson added after publish: {lesson_id}"
            if current_rev != source_rev:
                return True, f"Lesson {lesson_id} revised: {source_rev} → {current_rev}"

        # Check for deleted lessons
        for lesson_id in source_revisions.keys():
            if lesson_id not in lesson_revisions:
                return True, f"Lesson deleted after publish: {lesson_id}"

        return False, None


class RightsConfirmationService:
    """Validate rights confirmation before publishing."""

    CONFIRMATION_SOURCES = {
        "teacher_checkbox": "Teacher explicitly checked rights confirmation checkbox",
        "admin_override": "Administrator approved without teacher confirmation",
        "auto_approve": "Automatically approved (placeholder for policy)",
    }

    @staticmethod
    def validate_rights_confirmation(
        rights_confirmed: bool,
        confirmation_source: Optional[str],
    ) -> Tuple[bool, Optional[str]]:
        """Validate rights confirmation for publish.

        Args:
            rights_confirmed: Boolean flag
            confirmation_source: How confirmation was obtained

        Returns:
            (is_valid, error)
        """
        if not rights_confirmed:
            return False, "Rights confirmation required before publishing"

        if confirmation_source not in RightsConfirmationService.CONFIRMATION_SOURCES:
            return False, f"Unknown confirmation source: {confirmation_source}"

        return True, None

    @staticmethod
    def create_confirmation_fact(
        course_id: str,
        teacher_id: str,
        rights_confirmed: bool,
        confirmation_source: str,
    ) -> dict:
        """Create immutable fact record of rights confirmation.

        Returns:
            { course_id, teacher_id, confirmed_at, source, ... }
        """
        return {
            "course_id": course_id,
            "teacher_id": teacher_id,
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
            "rights_confirmed": rights_confirmed,
            "confirmation_source": confirmation_source,
            "confirmation_source_description": RightsConfirmationService.CONFIRMATION_SOURCES.get(
                confirmation_source, "Unknown"
            ),
        }
