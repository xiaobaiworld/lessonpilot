from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PublishResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    course_id: str
    lesson_id: str
    version: int
    published_at: datetime
    course: dict
