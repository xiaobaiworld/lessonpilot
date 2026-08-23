"""v1 Course Package Generator - Stage 2D

Generates v1 course-package.schema.json v2.0.0 from CourseRelease snapshot.

Pattern: Release owns immutable snapshot; package generator reads snapshot.
Never writes to database; only reads and generates JSON output.
"""

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
from authoring_release.release_models import CourseRelease, ReleaseLessonSnapshot


class CoursePackageGenerator:
    """Generate v1 course package from immutable release snapshot."""

    SCHEMA_VERSION = "2.0.0"

    def __init__(self, session_factory):
        self.session_factory = session_factory

    def generate_from_release(self, release_id: str) -> Dict:
        """Generate course package from a published release.

        Args:
            release_id: UUID of CourseRelease

        Returns:
            dict: course-package.schema.json v2.0.0 structure
        """
        with self.session_factory() as db:
            release = db.query(CourseRelease).filter_by(id=release_id).first()
            if not release:
                raise ValueError(f"Release not found: {release_id}")

            # Load all lesson snapshots for this release
            snapshots = db.query(ReleaseLessonSnapshot).filter_by(
                release_id=release_id
            ).order_by(ReleaseLessonSnapshot.lesson_sequence).all()

            # Generate package structure
            package = {
                "schemaVersion": self.SCHEMA_VERSION,
                "courseId": release.course_id,
                "releaseId": release.id,
                "releaseNumber": release.release_number,
                "title": "Course Title",  # TODO: fetch from course
                "lessons": self._generate_lessons(snapshots),
                "metadata": {
                    "publishedAt": release.published_at.isoformat(),
                    "previewAvailable": release.preview_available,
                    "rightsConfirmed": release.rights_confirmed,
                },
            }

            return package

    def _generate_lessons(self, snapshots: List[ReleaseLessonSnapshot]) -> List[Dict]:
        """Generate lesson array from snapshots."""
        lessons = []
        for snapshot in snapshots:
            lesson = {
                "lessonId": snapshot.lesson_id,
                "sequence": snapshot.lesson_sequence,
                "title": snapshot.title,
                "description": snapshot.description,
                "videoReference": {
                    "platform": snapshot.video_platform,
                    "videoPlatformId": snapshot.video_platform_id,
                },
                "nodes": self._extract_nodes(snapshot.nodes_json),
            }
            lessons.append(lesson)
        return lessons

    def _extract_nodes(self, nodes_json: Optional[str]) -> List[Dict]:
        """Extract nodes from snapshot JSON."""
        if not nodes_json:
            return []

        try:
            data = json.loads(nodes_json) if isinstance(nodes_json, str) else nodes_json
            return data.get("nodes", [])
        except Exception:
            return []

    @staticmethod
    def validate_package(package: Dict) -> Tuple[bool, Optional[str]]:
        """Validate generated package against schema.

        Args:
            package: course-package.schema.json structure

        Returns:
            (is_valid, error_message)
        """
        errors = []

        # Check required fields
        required = ["schemaVersion", "courseId", "releaseId", "releaseNumber", "lessons"]
        for field in required:
            if field not in package:
                errors.append(f"Missing required field: {field}")

        # Check schema version
        if package.get("schemaVersion") != "2.0.0":
            errors.append(f"Invalid schema version: {package.get('schemaVersion')}")

        # Check lessons
        if not isinstance(package.get("lessons"), list) or len(package["lessons"]) == 0:
            errors.append("Lessons must be non-empty array")

        if errors:
            return False, "; ".join(errors)

        return True, None
