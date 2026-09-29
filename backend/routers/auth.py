from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from passlib.hash import bcrypt
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas.auth import AuthLogin, AuthOut, AuthRegister


router = APIRouter()


@router.post("/api/auth/register", response_model=AuthOut)
def register(payload: AuthRegister, db: Session = Depends(get_db)) -> AuthOut:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email ja cadastrado")

    user = User(
        email=payload.email,
        password_hash=bcrypt.hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthOut(id=user.id, email=user.email, message="Conta criada com sucesso")


@router.post("/api/auth/login")
def login(payload: AuthLogin, response: Response, db: Session = Depends(get_db)) -> JSONResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not bcrypt.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou senha invalidos")

    token = secrets.token_hex(32)
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400 * 7,  # 7 days
    )

    return JSONResponse(
        content={"id": user.id, "email": user.email, "message": "Login realizado"},
    )


@router.post("/api/auth/logout")
def logout(response: Response) -> JSONResponse:
    response.delete_cookie(key="session_token")
    return JSONResponse(content={"message": "Logout realizado"})


@router.get("/api/auth/me", response_model=None)
def get_me() -> JSONResponse:
    return JSONResponse(content={"authenticated": False})