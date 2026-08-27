from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GrantWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    course_id: str
    scope: Literal["course", "lessons", "nodes"] = "course"
    lesson_ids: list[str] = Field(default_factory=list)
    node_ids: list[str] = Field(default_factory=list)
    valid_from: datetime | None = None
    valid_until: datetime | None = None


class AccessCodeWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idempotency_key: str = Field(min_length=8, max_length=64)
    grants: list[GrantWrite] = Field(min_length=1)
    redeem_from: datetime | None = None
    redeem_until: datetime | None = None


class AccessCodeBatchWrite(AccessCodeWrite):
    count: int = Field(ge=1, le=100)


class StudentBase(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    schema_version: int = Field(alias="schemaVersion")
    idempotency_key: str = Field(alias="idempotencyKey", min_length=8, max_length=64)
    local_identity_id: str = Field(alias="localIdentityId", min_length=8, max_length=200)
    local_proof: str = Field(alias="localProof", min_length=16, max_length=300)


class RedemptionWrite(StudentBase):
    access_code: str = Field(alias="accessCode", min_length=8, max_length=80)
    client: dict = Field(default_factory=dict)


class UpdateWrite(StudentBase):
    course_ids: list[str] = Field(alias="courseIds", default_factory=list)
    known_releases: list[dict] = Field(alias="knownReleases", default_factory=list)
