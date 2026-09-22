from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from backend.config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET_KEY
from backend.database import get_db
from backend.models import User
from backend.schemas.auth import AuthResponse, LoginRequest, SignupRequest, UserOut

router = APIRouter()
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
        )
        user_id: int = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    return user


@router.post("/api/auth/signup", response_model=AuthResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email ja cadastrado",
        )

    hashed = pwd_context.hash(payload.password)
    user = User(email=payload.email, hashed_password=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id})
    return AuthResponse(access_token=token, email=user.email)


@router.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not pwd_context.verify(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha invalidos",
        )

    token = create_access_token({"sub": user.id})
    return AuthResponse(access_token=token, email=user.email)


@router.post("/api/auth/logout", status_code=200)
def logout():
    return {"message": "Logout realizado com sucesso"}


@router.get("/api/auth/me", response_model=UserOut | None)
def me(current_user: User | None = Depends(get_current_user)):
    if current_user is None:
        return None
    return current_user