from __future__ import annotations

from datetime import datetime, timezone

import pytest

from backend.models import ChatMessage, ChatSession, User


class TestUser:
    def test_create_user(self, db_session):
        """Deve criar um usuario com email e senha hash."""
        user = User(email="teste@teste.com", hashed_password="$2b$12$hashfake")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        assert user.id is not None
        assert user.email == "teste@teste.com"
        assert user.hashed_password == "$2b$12$hashfake"
        assert isinstance(user.created_at, datetime)

    def test_user_email_unique(self, db_session):
        """Email deve ser unico."""
        user1 = User(email="unique@teste.com", hashed_password="hash1")
        user2 = User(email="unique@teste.com", hashed_password="hash2")
        db_session.add(user1)
        db_session.commit()
        db_session.add(user2)
        with pytest.raises(Exception):
            db_session.commit()

    def test_query_user_by_email(self, db_session):
        """Deve buscar usuario por email."""
        user = User(email="busca@teste.com", hashed_password="hash")
        db_session.add(user)
        db_session.commit()

        found = db_session.query(User).filter(User.email == "busca@teste.com").first()
        assert found is not None
        assert found.email == "busca@teste.com"


class TestChatSession:
    def test_create_session_defaults(self, db_session):
        """Deve criar uma sessao com valores padrao."""
        session = ChatSession()
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        assert session.id is not None
        assert session.title == ""
        assert session.user_id == 0
        assert isinstance(session.created_at, datetime)
        assert isinstance(session.updated_at, datetime)

    def test_create_session_with_title(self, db_session):
        """Deve criar uma sessao com titulo customizado."""
        session = ChatSession(title="Minha conversa")
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        assert session.title == "Minha conversa"

    def test_list_sessions_order(self, db_session):
        """Sessoes devem ser ordenaveis por updated_at."""
        s1 = ChatSession(title="Primeira")
        s2 = ChatSession(title="Segunda")
        db_session.add_all([s1, s2])
        db_session.commit()

        results = db_session.query(ChatSession).order_by(ChatSession.id.asc()).all()
        assert len(results) == 2


class TestChatMessage:
    def test_create_message_defaults(self, db_session):
        """Deve criar uma mensagem com valores padrao para session_id, model e created_at."""
        msg = ChatMessage(
            role="user",
            content="Ola, mundo!",
        )
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.id is not None
        assert msg.session_id == 0
        assert msg.role == "user"
        assert msg.content == "Ola, mundo!"
        assert msg.model == "google/gemma-4-31b-it"
        assert isinstance(msg.created_at, datetime)

    def test_create_message_custom_session(self, db_session):
        """Deve criar uma mensagem com session_id customizado."""
        msg = ChatMessage(
            session_id=42,
            role="assistant",
            content="Resposta do assistente.",
        )
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.session_id == 42
        assert msg.role == "assistant"

    def test_create_message_custom_model(self, db_session):
        """Deve criar uma mensagem com modelo customizado."""
        msg = ChatMessage(
            role="user",
            content="Teste",
            model="openai/gpt-4o",
        )
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.model == "openai/gpt-4o"

    def test_query_by_session_id(self, db_session):
        """Deve filtrar mensagens por session_id."""
        msg1 = ChatMessage(session_id=1, role="user", content="a")
        msg2 = ChatMessage(session_id=2, role="user", content="b")
        db_session.add_all([msg1, msg2])
        db_session.commit()

        results = (
            db_session.query(ChatMessage)
            .filter(ChatMessage.session_id == 1)
            .all()
        )
        assert len(results) == 1
        assert results[0].content == "a"

    def test_query_by_role(self, db_session):
        """Deve filtrar mensagens pelo campo role."""
        msg1 = ChatMessage(role="user", content="pergunta")
        msg2 = ChatMessage(role="assistant", content="resposta")
        db_session.add_all([msg1, msg2])
        db_session.commit()

        users = (
            db_session.query(ChatMessage)
            .filter(ChatMessage.role == "user")
            .all()
        )
        assistants = (
            db_session.query(ChatMessage)
            .filter(ChatMessage.role == "assistant")
            .all()
        )

        assert len(users) == 1
        assert len(assistants) == 1
        assert users[0].content == "pergunta"
        assert assistants[0].content == "resposta"

    def test_created_at_auto_set(self, db_session):
        """O campo created_at deve ser preenchido automaticamente com UTC now."""
        before = datetime.now(timezone.utc).replace(tzinfo=None)
        msg = ChatMessage(role="user", content="timestamp test")
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)
        after = datetime.now(timezone.utc).replace(tzinfo=None)

        assert before <= msg.created_at <= after

    def test_content_persists_long_text(self, db_session):
        """Deve persistir conteudos longos corretamente."""
        long_text = "Lorem ipsum " * 200
        msg = ChatMessage(role="user", content=long_text)
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)

        assert msg.content == long_text
