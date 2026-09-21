from __future__ import annotations

from fastapi.testclient import TestClient


class TestSessionsAPI:
    def test_list_sessions_empty(self, client: TestClient):
        """Listar sessoes deve retornar lista vazia inicialmente."""
        response = client.get("/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)

    def test_create_session(self, client: TestClient):
        """Criar uma sessao deve retornar os dados da sessao."""
        response = client.post("/api/sessions")
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["title"] == "Nova conversa"
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_and_list(self, client: TestClient):
        """Apos criar, a sessao deve aparecer na lista."""
        client.post("/api/sessions")
        response = client.get("/api/sessions")
        data = response.json()
        assert len(data["sessions"]) >= 1

    def test_get_session_by_id(self, client: TestClient):
        """Buscar sessao por ID deve retornar a sessao correta."""
        created = client.post("/api/sessions").json()
        response = client.get(f"/api/sessions/{created['id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == created["id"]
        assert data["title"] == "Nova conversa"

    def test_get_session_not_found(self, client: TestClient):
        """Buscar sessao inexistente deve retornar 404."""
        response = client.get("/api/sessions/99999")
        assert response.status_code == 404

    def test_delete_session(self, client: TestClient):
        """Excluir sessao deve retornar 204."""
        created = client.post("/api/sessions").json()
        response = client.delete(f"/api/sessions/{created['id']}")
        assert response.status_code == 204

    def test_delete_session_not_found(self, client: TestClient):
        """Excluir sessao inexistente deve retornar 404."""
        response = client.delete("/api/sessions/99999")
        assert response.status_code == 404

    def test_get_session_messages_empty(self, client: TestClient):
        """Listar mensagens de sessao vazia deve retornar lista vazia."""
        created = client.post("/api/sessions").json()
        response = client.get(f"/api/sessions/{created['id']}/messages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_session_messages_not_found(self, client: TestClient):
        """Listar mensagens de sessao inexistente deve retornar 404."""
        response = client.get("/api/sessions/99999/messages")
        assert response.status_code == 404