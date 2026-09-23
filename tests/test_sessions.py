from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def _auth_headers(client: TestClient) -> dict[str, str]:
    """Helper: register a user and return auth headers."""
    client.post(
        "/api/auth/register",
        json={"email": "sess@test.com", "password": "123456"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": "sess@test.com", "password": "123456"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestListSessions:
    def test_list_sessions_empty(self, client: TestClient):
        headers = _auth_headers(client)
        response = client.get("/api/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["sessions"] == []

    def test_list_sessions_after_create(self, client: TestClient):
        headers = _auth_headers(client)
        client.post("/api/sessions", headers=headers, json={})
        response = client.get("/api/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["sessions"]) == 1

    def test_list_sessions_requires_auth(self, client: TestClient):
        response = client.get("/api/sessions")
        assert response.status_code == 403


class TestCreateSession:
    def test_create_session(self, client: TestClient):
        headers = _auth_headers(client)
        response = client.post("/api/sessions", headers=headers, json={})
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["title"] is None

    def test_create_session_requires_auth(self, client: TestClient):
        response = client.post("/api/sessions", headers={}, json={})
        assert response.status_code == 403


class TestDeleteSession:
    def test_delete_session(self, client: TestClient):
        headers = _auth_headers(client)
        create_resp = client.post("/api/sessions", headers=headers, json={})
        session_id = create_resp.json()["id"]

        response = client.delete(f"/api/sessions/{session_id}", headers=headers)
        assert response.status_code == 204

        # Verify it's gone
        list_resp = client.get("/api/sessions", headers=headers)
        assert len(list_resp.json()["sessions"]) == 0

    def test_delete_nonexistent_session(self, client: TestClient):
        headers = _auth_headers(client)
        response = client.delete("/api/sessions/nonexistent-id", headers=headers)
        assert response.status_code == 404

    def test_delete_session_requires_auth(self, client: TestClient):
        response = client.delete("/api/sessions/some-id")
        assert response.status_code == 403


class TestGetSessionMessages:
    def test_get_messages_empty(self, client: TestClient):
        headers = _auth_headers(client)
        create_resp = client.post("/api/sessions", headers=headers, json={})
        session_id = create_resp.json()["id"]

        response = client.get(f"/api/sessions/{session_id}/messages", headers=headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_messages_nonexistent_session(self, client: TestClient):
        headers = _auth_headers(client)
        response = client.get("/api/sessions/nonexistent-id/messages", headers=headers)
        assert response.status_code == 404