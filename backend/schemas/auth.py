from __future__ import annotations

from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=3, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


class UserOut(BaseModel):
    id: int
    email: str

    model_config = {"from_attributes": True}