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
    recipient_label: str | None = Field(default=None, max_length=200)
    recipient_note: str | None = Field(default=None, max_length=1000)


class AccessCodeBatchWrite(AccessCodeWrite):
    count: int = Field(ge=1, le=100)


class AccessCodeRecipientWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recipient_label: str | None = Field(default=None, max_length=200)
    recipient_note: str | None = Field(default=None, max_length=1000)


class AccessCodeBatchActionWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_code_ids: list[str] = Field(min_length=1, max_length=100)
    action: Literal["freeze", "restore", "terminate"]
    idempotency_key: str = Field(min_length=8, max_length=64)


class StudentBase(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    schema_version: int = Field(alias="schemaVersion")
    idempotency_key: str = Field(alias="idempotencyKey", min_length=8, max_length=64)
    local_identity_id: str = Field(alias="localIdentityId", min_length=8, max_length=200)
    local_proof: str = Field(alias="localProof", min_length=16, max_length=300)


class RedemptionWrite(StudentBase):
    access_code: str = Field(alias="accessCode", min_length=8, max_length=80)
    client: dict = Field(default_factory=dict)


class InstalledCourseVersionWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    course_id: str = Field(alias="courseId", min_length=1, max_length=100)
    release_id: str | None = Field(default=None, alias="releaseId", max_length=100)
    release_number: int | None = Field(default=None, alias="releaseNumber", ge=1)


class StudentIdentityWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    schema_version: int = Field(alias="schemaVersion")
    local_identity_id: str = Field(alias="localIdentityId", min_length=8, max_length=200)
    local_proof: str = Field(alias="localProof", min_length=16, max_length=300)
    client: dict = Field(default_factory=dict)


class CourseUpdateCheckWrite(StudentIdentityWrite):
    installed_courses: list[InstalledCourseVersionWrite] = Field(
        alias="installedCourses", default_factory=list, max_length=1000
    )
    course_ids: list[str] = Field(alias="courseIds", default_factory=list, max_length=1000)


class CourseUpdateApplyWrite(StudentIdentityWrite):
    course_id: str = Field(alias="courseId", min_length=1, max_length=100)
    expected_release_id: str = Field(
        alias="expectedReleaseId", min_length=1, max_length=100
    )


class AssetReferenceWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    asset_id: str = Field(alias="assetId", min_length=1, max_length=100)
    sha256: str = Field(min_length=64, max_length=64)


class CourseAssetAuthorizeWrite(StudentIdentityWrite):
    course_id: str = Field(alias="courseId", min_length=1, max_length=100)
    release_id: str = Field(alias="releaseId", min_length=1, max_length=100)
    assets: list[AssetReferenceWrite] = Field(default_factory=list, max_length=1000)


class KnownReleaseWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    course_id: str = Field(alias="courseId", min_length=1, max_length=100)
    release_id: str = Field(alias="releaseId", min_length=1, max_length=100)


class UpdateWrite(StudentBase):
    course_ids: list[str] = Field(alias="courseIds", default_factory=list)
    known_releases: list[KnownReleaseWrite] = Field(
        alias="knownReleases", default_factory=list
    )
