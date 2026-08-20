from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AccessCodeCreated(StrictModel):
    access_code: str
    course_id: str
    course_title: str
    code_type: Literal["short_term", "long_term"]
    created_at: datetime
    expires_at: datetime | None
    scopes: list["AccessGrantScope"]


class AccessCodeCreate(StrictModel):
    code_type: Literal["short_term", "long_term"] = "long_term"
    scopes: list["AccessGrantScope"] | None = None


class AccessGrantScope(StrictModel):
    course_id: UUID
    lesson_id: UUID | None = None
    node_id: str | None = Field(default=None, min_length=1, max_length=80)
    valid_from: datetime | None = None
    valid_until: datetime | None = None

    @field_validator("node_id")
    @classmethod
    def validate_node_id(cls, value: str | None) -> str | None:
        if value is not None and (not value.strip() or not value.isascii()):
            raise ValueError("节点 ID 必须是非空 ASCII 字符串。")
        return value

    @field_validator("valid_from", "valid_until")
    @classmethod
    def validate_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("授权时间必须包含时区。")
        return value

    @model_validator(mode="after")
    def validate_scope(self) -> "AccessGrantScope":
        if self.node_id is not None and self.lesson_id is None:
            raise ValueError("节点授权必须同时指定课节。")
        if (
            self.valid_from is not None
            and self.valid_until is not None
            and self.valid_until <= self.valid_from
        ):
            raise ValueError("授权结束时间必须晚于开始时间。")
        return self


class AccessCodeRecord(StrictModel):
    id: str
    code_hint: str
    code_type: Literal["short_term", "long_term"]
    created_at: datetime
    expires_at: datetime | None
    status: Literal["active", "expired"]
    scopes: list[AccessGrantScope]


class AccessCodeCounts(StrictModel):
    short_term: int
    long_term: int


class AccessCodeListResponse(StrictModel):
    total: int
    counts: AccessCodeCounts
    items: list[AccessCodeRecord]


class CourseDownloadRequest(StrictModel):
    access_code: str = Field(min_length=1, max_length=100)


class CourseDownloadResponse(StrictModel):
    courses: list[dict]
