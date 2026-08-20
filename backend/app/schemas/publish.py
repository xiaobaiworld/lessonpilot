from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class PublishedModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


def _non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("标题不能为空。")
    return value


def _valid_utc_timestamp(value: str) -> str:
    try:
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        raise ValueError("时间必须是有效的 UTC 毫秒时间。") from None
    return value


class PublishedVideoRef(PublishedModel):
    platform: Literal["bilibili"]
    video_id: str = Field(alias="videoId", pattern=r"^BV[0-9A-Za-z]{10}$")


class PublishedLesson(PublishedModel):
    lesson_id: UUID = Field(alias="lessonId")
    title: str = Field(max_length=200)
    video_ref: PublishedVideoRef = Field(alias="videoRef")
    nodes: list[dict] = Field(min_length=1, max_length=100)
    updated_at: str = Field(
        alias="updatedAt",
        pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$",
    )

    _validate_title = field_validator("title")(_non_blank)
    _validate_updated_at = field_validator("updated_at")(_valid_utc_timestamp)


class PublishedCoursePackage(PublishedModel):
    schema_version: Literal[2] = Field(alias="schemaVersion")
    course_id: UUID = Field(alias="courseId")
    title: str = Field(max_length=200)
    lessons: list[PublishedLesson] = Field(min_length=1)
    updated_at: str = Field(
        alias="updatedAt",
        pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$",
    )

    _validate_title = field_validator("title")(_non_blank)
    _validate_updated_at = field_validator("updated_at")(_valid_utc_timestamp)

    @model_validator(mode="after")
    def validate_unique_ids(self) -> "PublishedCoursePackage":
        ids = [self.course_id, *(lesson.lesson_id for lesson in self.lessons)]
        if len(ids) != len(set(ids)):
            raise ValueError("课程与课节 UUID 必须唯一。")
        return self


class PublishResponse(PublishedCoursePackage):
    @model_validator(mode="before")
    @classmethod
    def unwrap_api_result(cls, value: Any) -> Any:
        if isinstance(value, dict) and "course" in value:
            return value["course"]
        return value
