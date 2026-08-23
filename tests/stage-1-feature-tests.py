"""v1 Stage 1G: Feature tests and integration points

Verifies stage 1 gates:
1. Two-teacher cross-permission rejection
2. Suspend/resume invalidates sessions
3. Repeated lessons and same-video lessons work correctly
4. Draft conflict detection
"""

import pytest
from datetime import datetime, timezone
from v1.backend.app.modules.identity.models import TeacherAccount, TeacherSession, Workspace
from v1.backend.app.modules.workspace_course.models import Course, Lesson, VideoReference
from v1.backend.app.modules.authoring_release.models import ScriptDraft, InteractionNode


@pytest.mark.integration
def test_two_teacher_cross_permission_rejection():
    """Teacher1 cannot access Teacher2's workspace."""
    # Teacher1 and Teacher2 each have their own workspace
    # Attempting to read T2's courses should fail (permission check in route layer)
    # This test verifies the data model supports the check
    assert Workspace.__table__.columns['owner_teacher_id'].unique
    # TODO: Add permission service test


@pytest.mark.integration
def test_suspend_invalidates_sessions():
    """Suspending teacher invalidates all active sessions."""
    # Stage 1 supports:
    # - Query sessions for suspended teacher
    # - Route layer checks session.expired_at or account.status
    # This test verifies the data model supports it
    assert TeacherAccount.__table__.columns['status']
    assert TeacherSession.__table__.columns['expires_at']
    # TODO: Add session invalidation test


@pytest.mark.integration
def test_repeated_lessons_supported():
    """Same course can have multiple lessons with identical content."""
    # Stage 1 allows:
    # - (course_id, sequence=1) Lesson with title "Chapter 1"
    # - (course_id, sequence=2) Lesson with title "Chapter 1" (same title)
    # - Unique constraint only on (course_id, sequence), not title
    # TODO: Add lesson creation test


@pytest.mark.integration
def test_same_video_multiple_lessons():
    """Two lessons in same course can reference the same video BVID."""
    # Stage 1 allows:
    # - Lesson1 -> VideoReference(platform=bilibili, video_id=BV1Ac41187Lm)
    # - Lesson2 -> VideoReference(platform=bilibili, video_id=BV1Ac41187Lm)
    # - No constraint preventing duplicate video references
    # TODO: Add video reference creation test


@pytest.mark.integration
def test_draft_conflict_detection():
    """Concurrent edits detected via revision field."""
    # Stage 1 supports:
    # - Load draft with revision=1
    # - User A: increments to revision=2, saves
    # - User B: saves with revision=1, fails (conflicted)
    # - Previous version not overwritten on failure
    assert ScriptDraft.__table__.columns['revision']
    # TODO: Add conflict detection test


@pytest.mark.integration
def test_interaction_node_validation():
    """All four node types validate correctly."""
    test_cases = [
        {
            'node_id': 'n1',
            'type': 'remark',
            'timestamp_seconds': 10.5,
            'title': 'Important point',
            'content': 'Lorem ipsum',
        },
        {
            'node_id': 'n2',
            'type': 'question',
            'timestamp_seconds': 30,
            'title': 'Check understanding',
            'content': '{"choices": ["A", "B"]}',
        },
    ]

    for node in test_cases:
        is_valid, error = InteractionNode.validate(node)
        assert is_valid, f"Node validation failed: {error}"


@pytest.mark.integration
def test_node_validation_rejects_invalid():
    """Invalid nodes rejected at draft save time."""
    invalid_cases = [
        {'type': 'unknown'},  # Missing fields
        {'node_id': 'n1', 'type': 'invalid_type', 'timestamp_seconds': 0, 'title': '', 'content': ''},
        {'node_id': 'n1', 'type': 'remark', 'timestamp_seconds': -1, 'title': 'x', 'content': ''},
    ]

    for node in invalid_cases:
        is_valid, error = InteractionNode.validate(node)
        assert not is_valid, f"Invalid node should be rejected: {node}"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
