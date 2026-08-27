from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class VideoRef(BaseModel):
    platform: Literal["bilibili"]
    video_id: str = Field(pattern=r"^BV[a-zA-Z0-9]{10}$")


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class CourseUpdate(BaseModel):
    revision: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class CourseSummary(BaseModel):
    id: str
    title: str
    description: str | None
    status: str
    revision: int
    created_at: datetime
    updated_at: datetime


class CourseMetrics(BaseModel):
    lesson_count: int
    draft_lesson_count: int
    draft_node_count: int
    published_node_count: int
    access_code_count: int
    redeemed_count: int
    student_submission_count: int | None
    release_number: int | None
    published_at: datetime | None


class CourseListItem(CourseSummary):
    metrics: CourseMetrics


class LessonCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    video_ref: VideoRef


class LessonUpdate(BaseModel):
    revision: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    video_ref: VideoRef | None = None


class LessonPublic(BaseModel):
    id: str
    course_id: str
    title: str
    sort_order: int
    revision: int
    video_ref: VideoRef
    has_draft: bool
    status: str
    created_at: datetime
    updated_at: datetime


class CourseDetail(CourseSummary):
    lessons: list[LessonPublic]


class CourseListResponse(BaseModel):
    items: list[CourseListItem]


class LessonOrderRequest(BaseModel):
    course_revision: int = Field(ge=1)
    lesson_ids: list[str] = Field(min_length=1)
