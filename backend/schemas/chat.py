from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    model: str | None = None
    history: list[ChatMessageIn] = Field(default_factory=list)
    session_key: str | None = None


class ChatResponse(BaseModel):
    reply: str
    model: str


class ChatMessageOut(BaseModel):
    id: int
    session_key: str
    role: str
    content: str
    model: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionResponse(BaseModel):
    id: str
    title: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]


class SessionDeleteResponse(BaseModel):
    ok: bool
