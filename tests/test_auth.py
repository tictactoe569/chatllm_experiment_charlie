from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


class TestRegister:
    def test_register_success(self, client: TestClient):
        response = client.post(
            "/api/auth/register",
            json={"email": "teste@example.com", "password": "123456"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_email(self, client: TestClient):
        # Primeiro cadastro
        client.post(
            "/api/auth/register",
            json={"email": "dup@example.com", "password": "123456"},
        )
        # Segundo cadastro mesmo email
        response = client.post(
            "/api/auth/register",
            json={"email": "dup@example.com", "password": "654321"},
        )
        assert response.status_code == 409
        assert "ja cadastrado" in response.json()["detail"]

    def test_register_short_password(self, client: TestClient):
        response = client.post(
            "/api/auth/register",
            json={"email": "short@example.com", "password": "12345"},
        )
        assert response.status_code == 422


class TestLogin:
    def test_login_success(self, client: TestClient):
        # Cadastra primeiro
        client.post(
            "/api/auth/register",
            json={"email": "login@example.com", "password": "123456"},
        )
        # Login
        response = client.post(
            "/api/auth/login",
            json={"email": "login@example.com", "password": "123456"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient):
        client.post(
            "/api/auth/register",
            json={"email": "wrongpw@example.com", "password": "123456"},
        )
        response = client.post(
            "/api/auth/login",
            json={"email": "wrongpw@example.com", "password": "senha_errada"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client: TestClient):
        response = client.post(
            "/api/auth/login",
            json={"email": "naoexiste@example.com", "password": "123456"},
        )
        assert response.status_code == 401


class TestMe:
    def test_me_authenticated(self, client: TestClient):
        # Cadastra e pega token
        resp = client.post(
            "/api/auth/register",
            json={"email": "me@example.com", "password": "123456"},
        )
        token = resp.json()["access_token"]

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "me@example.com"
        assert data["is_active"] is True
        assert "id" in data

    def test_me_unauthenticated(self, client: TestClient):
        response = client.get("/api/auth/me")
        assert response.status_code == 403  # Sem token


class TestLogout:
    def test_logout_returns_message(self, client: TestClient):
        resp = client.post(
            "/api/auth/register",
            json={"email": "logout@example.com", "password": "123456"},
        )
        token = resp.json()["access_token"]

        response = client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Logout realizado com sucesso"