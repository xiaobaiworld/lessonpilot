from datetime import datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _required_text(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("不能为空")
    return value


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _is_bilibili_url(value: str) -> bool:
    parsed = urlsplit(value)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.path in {"", "/"}:
        return False
    hostname = (parsed.hostname or "").lower().rstrip(".")
    return (
        hostname == "bilibili.com"
        or hostname.endswith(".bilibili.com")
        or hostname == "b23.tv"
        or hostname.endswith(".b23.tv")
    )


class TrialApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    contact: str = Field(min_length=1, max_length=255)
    course_category: str = Field(alias="courseCategory", min_length=1, max_length=120)
    video_status: str = Field(alias="videoStatus", min_length=1, max_length=120)
    bilibili_url: str | None = Field(default=None, alias="bilibiliUrl", max_length=500)
    teaching_problem: str = Field(alias="teachingProblem", min_length=1, max_length=4000)
    subtitle_status: str = Field(alias="subtitleStatus", min_length=1, max_length=120)
    validation_question: str | None = Field(
        default=None, alias="validationQuestion", max_length=4000
    )
    website: str | None = Field(default=None, max_length=200)

    @field_validator(
        "name",
        "contact",
        "course_category",
        "video_status",
        "teaching_problem",
        "subtitle_status",
    )
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        return _required_text(value)

    @field_validator("bilibili_url", "validation_question", "website", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _optional_text(value)

    @field_validator("bilibili_url")
    @classmethod
    def validate_bilibili_url(cls, value: str | None) -> str | None:
        if value is not None and not _is_bilibili_url(value):
            raise ValueError("请输入有效的 B 站网页链接或 b23.tv 短链接")
        return value


TrialFollowupStatus = Literal["pending", "contacted", "closed"]


class TrialApplicationCreated(BaseModel):
    application_id: str = Field(alias="applicationId")
    status: Literal["accepted"]
    request_id: str = Field(alias="requestId")

    model_config = ConfigDict(populate_by_name=True)


class TrialApplicationAdminItem(BaseModel):
    id: str
    name: str
    contact: str
    course_category: str = Field(alias="courseCategory")
    video_status: str = Field(alias="videoStatus")
    bilibili_url: str | None = Field(alias="bilibiliUrl")
    teaching_problem: str = Field(alias="teachingProblem")
    subtitle_status: str = Field(alias="subtitleStatus")
    validation_question: str | None = Field(alias="validationQuestion")
    source: str
    submitted_at: datetime = Field(alias="submittedAt")
    followup_id: str = Field(alias="followupId")
    status: TrialFollowupStatus

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
