from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.lesson import LessonPublic


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class CourseSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class CourseDetail(CourseSummary):
    lesson: LessonPublic | None


class CourseListResponse(BaseModel):
    items: list[CourseSummary]
