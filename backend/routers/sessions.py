from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ChatMessage, ChatSession, User
from backend.schemas.session import SessionCreate, SessionOut, SessionList
from backend.services.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=SessionList)
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    query = db.query(ChatSession)
    if current_user is not None:
        query = query.filter(ChatSession.user_id == current_user.id)
    else:
        query = query.filter(ChatSession.user_id.is_(None))
    sessions = query.order_by(ChatSession.updated_at.desc()).all()
    return SessionList(sessions=sessions)


@router.post("", response_model=SessionOut, status_code=201)
def create_session(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    session = ChatSession(user_id=current_user.id if current_user else None)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    session = _get_user_session(session_id, current_user, db)
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    session = _get_user_session(session_id, current_user, db)
    db.query(ChatMessage).filter(ChatMessage.session_key == str(session_id)).delete()
    db.delete(session)
    db.commit()
    return None


@router.get("/{session_id}/messages", response_model=list[dict])
def list_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    session = _get_user_session(session_id, current_user, db)
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_key == str(session_id))
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
        for m in messages
    ]


def _get_user_session(session_id: int, current_user: User | None, db: Session) -> ChatSession:
    """Retorna uma sessao verificando se pertence ao usuario."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    if current_user is not None and session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sessao nao pertence a este usuario")
    if current_user is None and session.user_id is not None:
        raise HTTPException(status_code=403, detail="Sessao nao pertence a este usuario")
    return session