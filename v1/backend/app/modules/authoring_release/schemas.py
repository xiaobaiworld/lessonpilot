from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SubtitleDocument(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    schema_version: Literal[1] = Field(alias="schemaVersion")
    filename: str = Field(min_length=1, max_length=255)
    format: Literal["srt", "vtt"]
    content: str = Field(min_length=1)


class SubtitleRepairPublic(BaseModel):
    valid: Literal[True] = True
    repaired: bool
    changes: list[str]
    subtitle: SubtitleDocument


class DraftConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodes: list[dict]
    assets: list[dict] = Field(default_factory=list)
    subtitle: SubtitleDocument | None = None


class DraftWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = 1
    revision: int | None = Field(default=None, ge=0)
    config: DraftConfig


class WindowSizeWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    width_percent: float = Field(alias="widthPercent")
    height_percent: float = Field(alias="heightPercent")


class WindowPositionWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    x_percent: float = Field(alias="xPercent")
    y_percent: float = Field(alias="yPercent")


class PresentationHintsWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    window_size: WindowSizeWrite = Field(alias="windowSize")
    window_position: WindowPositionWrite = Field(alias="windowPosition")
    window_style: Literal["card", "document"] = Field(alias="windowStyle")


class NodePresentationWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    revision: int = Field(ge=0)
    presentation_hints: PresentationHintsWrite = Field(alias="presentationHints")


class NodePresentationPublic(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    lesson_id: str = Field(alias="lessonId")
    node_id: str = Field(alias="nodeId")
    revision: int
    presentation_hints: dict = Field(alias="presentationHints")


class DraftPublic(BaseModel):
    schema_version: int
    revision: int
    config: dict
    lesson_id: str
    node_count: int
    updated_at: datetime


class AssetLinkWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=1, max_length=2048)


class AssetPublic(BaseModel):
    asset_id: str = Field(alias="assetId")
    kind: Literal["image", "audio", "video"]
    mime_type: str = Field(alias="mimeType")
    byte_size: int = Field(alias="byteSize", ge=0)
    sha256: str
    source_type: Literal["uploaded", "licensed"] = Field(alias="sourceType")

    model_config = ConfigDict(populate_by_name=True)


class CourseFileWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file: dict
    confirm: bool = False


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


class VersionDraftWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["modify", "add"]
    idempotency_key: str = Field(min_length=8, max_length=64)


class AvailabilityWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    deliverable: bool
    reason: str | None = Field(default=None, max_length=100)
