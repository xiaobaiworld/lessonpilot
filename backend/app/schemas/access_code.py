from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AccessCodeCreated(StrictModel):
    access_code: str
    course_id: str
    course_title: str
    code_type: Literal["short_term", "long_term"]
    created_at: datetime
    expires_at: datetime | None


class AccessCodeCreate(StrictModel):
    code_type: Literal["short_term", "long_term"] = "long_term"


class AccessCodeRecord(StrictModel):
    id: str
    code_hint: str
    code_type: Literal["short_term", "long_term"]
    created_at: datetime
    expires_at: datetime | None
    status: Literal["active", "expired"]


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
    course: dict
