from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class AuthRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class AuthLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthOut(BaseModel):
    id: int
    email: str
    message: str


class AuthSession(BaseModel):
    user_id: int
    email: str