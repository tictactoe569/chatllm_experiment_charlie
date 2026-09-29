from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.config import OPENROUTER_MODEL_DEFAULT
from backend.database import get_db
from backend.models import ChatMessage, ChatSession
from backend.schemas.chat import ChatRequest, ChatResponse
from backend.schemas.chat import ChatMessageOut
from backend.services.openrouter import OpenRouterConfigError, generate_reply, stream_reply


router = APIRouter()


def _generate_title_from_message(message: str) -> str:
    """Generate a short title from the first user message."""
    cleaned = message.strip()
    if len(cleaned) <= 60:
        return cleaned
    return cleaned[:57] + "..."


@router.get("/api/chat/history/{session_id}")
def get_chat_history(session_id: int, db: Session = Depends(get_db)) -> list[ChatMessageOut]:
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [ChatMessageOut.model_validate(m) for m in messages]


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    # Resolve or create session
    if payload.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == payload.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    else:
        session = ChatSession()
        db.add(session)
        db.commit()
        db.refresh(session)

    try:
        reply, model_name = await generate_reply(
            user_message=payload.message,
            history=[item.model_dump() for item in payload.history],
            model=payload.model,
        )
    except OpenRouterConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    resolved_model = payload.model or model_name or OPENROUTER_MODEL_DEFAULT

    # Auto-title: set title from first user message if session has no title
    if not session.title:
        session.title = _generate_title_from_message(payload.message)
        db.add(session)

    # Persist messages
    db.add(ChatMessage(session_id=session.id, role="user", content=payload.message, model=resolved_model))
    db.add(ChatMessage(session_id=session.id, role="assistant", content=reply, model=resolved_model))
    db.commit()

    return ChatResponse(reply=reply, model=resolved_model, session_id=session.id)


@router.post("/api/chat/stream")
async def chat_stream(payload: ChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    # Resolve or create session
    if payload.session_id:
        session = db.query(ChatSession).filter(ChatSession.id == payload.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    else:
        session = ChatSession()
        db.add(session)
        db.commit()
        db.refresh(session)

    resolved_model = payload.model or OPENROUTER_MODEL_DEFAULT

    async def event_generator():
        nonlocal session
        full_reply = ""
        try:
            async for delta in stream_reply(
                user_message=payload.message,
                history=[item.model_dump() for item in payload.history],
                model=payload.model,
            ):
                full_reply += delta
                yield f"data: {json.dumps({'delta': delta}, ensure_ascii=True)}\n\n"
        except OpenRouterConfigError as exc:
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=True)}\n\n"
            return
        except RuntimeError as exc:
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=True)}\n\n"
            return

        if full_reply.strip():
            # Auto-title: set title from first user message if session has no title
            if not session.title:
                session.title = _generate_title_from_message(payload.message)
                db.add(session)

            db.add(
                ChatMessage(
                    session_id=session.id,
                    role="user",
                    content=payload.message,
                    model=resolved_model,
                )
            )
            db.add(
                ChatMessage(
                    session_id=session.id,
                    role="assistant",
                    content=full_reply,
                    model=resolved_model,
                )
            )
            db.commit()

        yield f"data: {json.dumps({'done': True, 'session_id': session.id}, ensure_ascii=True)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
