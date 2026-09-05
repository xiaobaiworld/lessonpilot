from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    login_name: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=1, max_length=256)


class AdminPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    login_name: str
    display_name: str
    status: str


class TeacherPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    login_name: str
    display_name: str
    status: str


class AdminAuthResponse(BaseModel):
    admin: AdminPublic


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)
    confirm_password: str = Field(min_length=1, max_length=256)


class ChangePasswordResponse(BaseModel):
    changed: bool


class TeacherAuthResponse(BaseModel):
    teacher: TeacherPublic


class LogoutResponse(BaseModel):
    logged_out: bool


class CreateTeacherRequest(BaseModel):
    login_name: str = Field(min_length=3, max_length=80)
    display_name: str = Field(min_length=1, max_length=120)


class TeacherSummary(TeacherPublic):
    created_at: datetime
    updated_at: datetime
    published_course_count: int = 0


class TeacherMutationResponse(BaseModel):
    teacher: TeacherSummary
    temporary_password: str
