from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SessionCreate(BaseModel):
    pass


class SessionResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]


class SessionReorderRequest(BaseModel):
    session_ids: list[str]