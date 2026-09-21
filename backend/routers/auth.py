from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas.auth import (
    PasswordReset,
    PasswordResetRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserOut,
)
from backend.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    # Verificar se o email ja existe
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email ja cadastrado")

    # Criar usuario
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=200)
def logout(current_user: User = Depends(get_current_user)):
    # JWT é stateless — o logout é feito pelo frontend descartando o token
    return {"message": "Logout realizado com sucesso"}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at.isoformat(),
    )


@router.post("/reset-password/request")
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    """Simula envio de email de recuperacao. Em producao, enviaria um email real."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        # Nao revelar se o email existe ou nao (seguranca)
        return {"message": "Se o email estiver cadastrado, voce recebera um link para redefinir sua senha"}
    return {"message": "Se o email estiver cadastrado, voce recebera um link para redefinir sua senha"}


@router.post("/reset-password/confirm")
def confirm_password_reset(payload: PasswordReset, db: Session = Depends(get_db)):
    """Redefine a senha (simula um link de reset clicado)."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email nao encontrado")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Senha redefinida com sucesso"}