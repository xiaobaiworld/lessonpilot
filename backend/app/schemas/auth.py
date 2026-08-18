from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    login_name: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=1, max_length=256)


class TeacherPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    login_name: str
    display_name: str
    status: str


class AuthResponse(BaseModel):
    teacher: TeacherPublic


class LogoutResponse(BaseModel):
    logged_out: bool
