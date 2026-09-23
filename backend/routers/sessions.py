from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ChatMessage, ChatSession
from backend.routers.auth import _get_current_user
from backend.schemas.chat import ChatMessageIn
from backend.schemas.session import SessionCreate, SessionListResponse, SessionResponse
from backend.services.openrouter import OpenRouterConfigError, generate_reply


router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    _payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(_get_current_user),
) -> SessionResponse:
    session = ChatSession(user_id=current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionResponse.model_validate(session)


@router.get("", response_model=SessionListResponse)
def list_sessions(
    db: Session = Depends(get_db),
    current_user=Depends(_get_current_user),
) -> SessionListResponse:
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return SessionListResponse(
        sessions=[SessionResponse.model_validate(s) for s in sessions]
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(_get_current_user),
) -> None:
    session = (
        db.query(ChatSession)
        .filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    # Remove mensagens da sessao
    db.query(ChatMessage).filter(ChatMessage.session_key == session_id).delete()
    db.delete(session)
    db.commit()


@router.get("/{session_id}/messages", response_model=list[ChatMessageIn])
def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(_get_current_user),
) -> list[ChatMessageIn]:
    session = (
        db.query(ChatSession)
        .filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_key == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        ChatMessageIn(role=msg.role, content=msg.content) for msg in messages
    ]


async def generate_session_title(
    *,
    user_message: str,
    reply: str,
) -> str | None:
    """Gera um titulo curto para a sessao baseado na primeira conversa."""
    prompt = (
        "Generate a very short title (max 6 words) for a chat conversation "
        "based on the first exchange below. Return ONLY the title, no quotes, no extra text.\n\n"
        f"User: {user_message}\n"
        f"Assistant: {reply}"
    )
    try:
        title, _ = await generate_reply(
            user_message=prompt,
            history=[],
            model=None,
        )
        # Clean up: remove quotes and trim
        title = title.strip().strip('"').strip("'").strip()
        # Limit length
        if len(title) > 60:
            title = title[:60]
        return title if title else None
    except (OpenRouterConfigError, RuntimeError):
        return None