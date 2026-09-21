from __future__ import annotations

from pydantic import BaseModel, Field, EmailStr


class UserCreate(BaseModel):
    email: str = Field(min_length=5, max_length=255, pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str
    created_at: str

    model_config = {"from_attributes": True}


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)


class PasswordReset(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    new_password: str = Field(min_length=6, max_length=128)