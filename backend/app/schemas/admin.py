from pydantic import BaseModel, ConfigDict, Field


class AdminLoginRequest(BaseModel):
    login_name: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=1, max_length=256)


class AdminPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    login_name: str
    display_name: str
    status: str


class AdminAuthResponse(BaseModel):
    admin: AdminPublic


class AdminLogoutResponse(BaseModel):
    logged_out: bool
