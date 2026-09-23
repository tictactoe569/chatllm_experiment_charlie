from __future__ import annotations

import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.config import OPENROUTER_API_KEY, OPENROUTER_API_URL, OPENROUTER_MODEL_DEFAULT
from backend.database import get_db
from backend.models import ChatMessage, ChatSession, User
from backend.routers.auth import require_auth
from backend.schemas.chat import SessionDeleteResponse, SessionListResponse, SessionResponse

router = APIRouter()


@router.get("/api/sessions", response_model=SessionListResponse)
def list_sessions(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return SessionListResponse(sessions=sessions)


@router.post("/api/sessions", response_model=SessionResponse, status_code=201)
def create_session(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    session = ChatSession(id=str(uuid.uuid4()), user_id=current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/api/sessions/{session_id}", response_model=SessionDeleteResponse)
def delete_session(session_id: str, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    db.query(ChatMessage).filter(ChatMessage.session_key == session_id).delete()
    db.delete(session)
    db.commit()
    return SessionDeleteResponse(ok=True)


@router.get("/api/sessions/{session_id}/messages")
def get_session_messages(session_id: str, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_key == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return messages


@router.post("/api/sessions/{session_id}/title")
async def auto_title(session_id: str, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    first_msg = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_key == session_id, ChatMessage.role == "user")
        .order_by(ChatMessage.created_at.asc())
        .first()
    )

    if not first_msg:
        raise HTTPException(status_code=400, detail="Nenhuma mensagem de usuario para gerar titulo")

    if not OPENROUTER_API_KEY:
        session.title = first_msg.content[:50].strip()
        db.commit()
        return {"title": session.title}

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost",
        "X-Title": "ChatLLM Experiment",
    }

    title_payload = {
        "model": OPENROUTER_MODEL_DEFAULT,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant that generates VERY SHORT chat titles. "
                    "Based on the user's message below, generate a concise title in Portuguese "
                    "(max 6 words). Return ONLY the title text, no quotes, no extra punctuation."
                ),
            },
            {"role": "user", "content": first_msg.content},
        ],
        "max_tokens": 20,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(OPENROUTER_API_URL, json=title_payload, headers=headers)
        if resp.status_code < 400:
            data = resp.json()
            title = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
                .strip('"')
                .strip("'")
            )
            if title:
                session.title = title
                db.commit()
                return {"title": title}
    except Exception:
        pass

    fallback = first_msg.content[:50].strip()
    if len(first_msg.content) > 50:
        fallback = fallback[:47] + "..."
    session.title = fallback
    db.commit()
    return {"title": fallback}