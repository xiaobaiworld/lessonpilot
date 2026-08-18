from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class VideoRef(BaseModel):
    platform: Literal["bilibili"]
    video_id: str = Field(pattern=r"^BV[a-zA-Z0-9]+$")


class LessonCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    video_ref: VideoRef


class LessonPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    title: str
    sort_order: int
    video_ref: VideoRef
    has_draft: bool
    status: str
    created_at: datetime
    updated_at: datetime
