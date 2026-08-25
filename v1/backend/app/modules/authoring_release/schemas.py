from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DraftWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = 1
    revision: int | None = Field(default=None, ge=0)
    config: dict


class DraftPublic(BaseModel):
    schema_version: int
    revision: int
    config: dict
    lesson_id: str
    node_count: int
    updated_at: datetime


class PreviewStart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plugin_version: str | None = Field(default=None, max_length=30)


class PreviewEnd(BaseModel):
    model_config = ConfigDict(extra="forbid")
    succeeded: bool
    error_category: str | None = Field(default=None, max_length=60)


class PreviewPublic(BaseModel):
    id: str
    lesson_id: str
    draft_revision: int
    locked_content: dict | None
    expires_at: datetime
    ended_at: datetime | None
    succeeded: bool | None


class RightsWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    statement_version: str = Field(min_length=1, max_length=30)
    accepted: bool


class ReleaseWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idempotency_key: str = Field(min_length=8, max_length=64)


class AvailabilityWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    deliverable: bool
    reason: str | None = Field(default=None, max_length=100)
