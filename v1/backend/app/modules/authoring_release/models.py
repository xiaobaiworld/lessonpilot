"""v1 Script domain models - Stage 1D

ScriptDraft: versioned aggregates containing InteractionNodes (four types)
- Optimistic concurrency via revision field
- Conflict detection and stable error responses
- Never overwrite on save failure
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean, JSON, Index, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship
import enum
import json

Base = declarative_base()


class NodeType(str, enum.Enum):
    """Four types of interaction nodes in v1."""
    remark = "remark"  # Informational highlight
    highlight = "highlight"  # Key point emphasis
    question = "question"  # Multiple choice or fill-blank
    feedback = "feedback"  # Concluding assessment


class ScriptDraft(Base):
    """v1 ScriptDraft - versioned aggregation of nodes for a lesson.

    - One active draft per lesson_id
    - revision enables optimistic concurrency
    - content_digest enables idempotency and conflict detection
    - Entire save is atomic: validates all nodes before writing
    - Save failure leaves previous version intact
    """
    __tablename__ = 'v1_script_drafts'

    id = Column(String(36), primary_key=True)  # UUID
    lesson_id = Column(String(36), ForeignKey('v1_lessons.id'), unique=True, nullable=False)
    schema_version = Column(String(10), default='2.0.0', nullable=False)  # Course package schema version
    revision = Column(Integer, default=1, nullable=False)  # Optimistic concurrency counter
    content = Column(JSON(), nullable=False)  # { nodes: [InteractionNode], metadata: {...} }
    content_digest = Column(String(64), nullable=False)  # SHA256 hex of content
    saved_by_teacher_id = Column(String(36), ForeignKey('v1_teacher_accounts.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                       onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index('ix_script_drafts_lesson_id', 'lesson_id'),
        Index('ix_script_drafts_teacher_id', 'saved_by_teacher_id'),
    )

    def get_nodes(self) -> list:
        """Extract nodes from content JSON."""
        if isinstance(self.content, dict):
            return self.content.get('nodes', [])
        return json.loads(self.content).get('nodes', [])

    def get_content_metadata(self) -> dict:
        """Extract metadata from content JSON."""
        if isinstance(self.content, dict):
            return self.content.get('metadata', {})
        return json.loads(self.content).get('metadata', {})


class InteractionNode:
    """v1 InteractionNode - domain object (not persisted directly as table row).

    - Stored within ScriptDraft.content as JSON
    - Each node has type-specific validation rules
    - state_compatibility_key used for version migration checks
    """

    VALID_TYPES = {NodeType.remark, NodeType.highlight, NodeType.question, NodeType.feedback}

    @staticmethod
    def validate(node: dict) -> tuple[bool, str | None]:
        """Validate a single node against course package schema.

        Returns (is_valid, error_message).
        Errors are stable across versions.
        """
        try:
            required = {'node_id', 'type', 'timestamp_seconds', 'title', 'content'}
            if not all(k in node for k in required):
                return False, "Missing required fields: " + ", ".join(required - set(node.keys()))

            if node['type'] not in InteractionNode.VALID_TYPES:
                return False, f"Unknown node type: {node['type']}"

            if not isinstance(node['timestamp_seconds'], (int, float)) or node['timestamp_seconds'] < 0:
                return False, "timestamp_seconds must be non-negative number"

            if not isinstance(node['title'], str) or not node['title'].strip():
                return False, "title must be non-empty string"

            return True, None
        except (KeyError, TypeError) as e:
            return False, f"Invalid node structure: {str(e)}"

    @staticmethod
    def validate_nodes(nodes: list) -> tuple[bool, list[str]]:
        """Validate all nodes in a draft.

        Returns (all_valid, list_of_errors).
        On validation failure, caller must NOT persist the draft.
        """
        errors = []
        for i, node in enumerate(nodes):
            is_valid, error = InteractionNode.validate(node)
            if not is_valid:
                errors.append(f"Node {i}: {error}")

        return len(errors) == 0, errors
