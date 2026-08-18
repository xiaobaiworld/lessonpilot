from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AccessCodeCreated(StrictModel):
    access_code: str
    course_id: str
    course_title: str


class CourseDownloadRequest(StrictModel):
    access_code: str = Field(min_length=1, max_length=100)


class CourseDownloadResponse(StrictModel):
    course: dict
