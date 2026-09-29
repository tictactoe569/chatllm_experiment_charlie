from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ChatSession
from backend.schemas.session import SessionCreate, SessionList, SessionOut, SessionTitleUpdate


router = APIRouter()


@router.get("/api/sessions", response_model=SessionList)
def list_sessions(db: Session = Depends(get_db)) -> SessionList:
    sessions = (
        db.query(ChatSession)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return SessionList(sessions=[SessionOut.model_validate(s) for s in sessions])


@router.post("/api/sessions", response_model=SessionOut)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)) -> SessionOut:
    session = ChatSession()
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionOut.model_validate(session)


@router.get("/api/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)) -> SessionOut:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    return SessionOut.model_validate(session)


@router.patch("/api/sessions/{session_id}/title", response_model=SessionOut)
def update_session_title(
    session_id: int, payload: SessionTitleUpdate, db: Session = Depends(get_db)
) -> SessionOut:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    session.title = payload.title
    db.commit()
    db.refresh(session)
    return SessionOut.model_validate(session)


@router.delete("/api/sessions/{session_id}", status_code=204, response_model=None)
def delete_session(session_id: int, db: Session = Depends(get_db)) -> None:
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    db.delete(session)
    db.commit()