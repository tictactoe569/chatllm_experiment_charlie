from __future__ import annotations

from fastapi.testclient import TestClient


class TestSignup:
    def test_signup_success(self, client: TestClient):
        """Cadastro com dados validos deve retornar token."""
        response = client.post(
            "/api/auth/signup",
            json={"email": "teste@example.com", "password": "senha123"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_signup_duplicate_email(self, client: TestClient):
        """Cadastro com email ja existente deve retornar 409."""
        client.post(
            "/api/auth/signup",
            json={"email": "dup@example.com", "password": "senha123"},
        )
        response = client.post(
            "/api/auth/signup",
            json={"email": "dup@example.com", "password": "outrasenha"},
        )
        assert response.status_code == 409
        assert "ja cadastrado" in response.json()["detail"]

    def test_signup_invalid_email(self, client: TestClient):
        """Cadastro com email invalido deve retornar 422."""
        response = client.post(
            "/api/auth/signup",
            json={"email": "invalido", "password": "senha123"},
        )
        assert response.status_code == 422

    def test_signup_short_password(self, client: TestClient):
        """Cadastro com senha curta deve retornar 422."""
        response = client.post(
            "/api/auth/signup",
            json={"email": "valido@example.com", "password": "123"},
        )
        assert response.status_code == 422


class TestLogin:
    def test_login_success(self, client: TestClient):
        """Login com credenciais validas deve retornar token."""
        client.post(
            "/api/auth/signup",
            json={"email": "login@example.com", "password": "senha123"},
        )
        response = client.post(
            "/api/auth/login",
            json={"email": "login@example.com", "password": "senha123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_login_wrong_password(self, client: TestClient):
        """Login com senha incorreta deve retornar 401."""
        client.post(
            "/api/auth/signup",
            json={"email": "wrong@example.com", "password": "senha123"},
        )
        response = client.post(
            "/api/auth/login",
            json={"email": "wrong@example.com", "password": "senhaerrada"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_email(self, client: TestClient):
        """Login com email nao cadastrado deve retornar 401."""
        response = client.post(
            "/api/auth/login",
            json={"email": "naoexiste@example.com", "password": "senha123"},
        )
        assert response.status_code == 401

    def test_login_empty_password(self, client: TestClient):
        """Login com senha vazia deve retornar 422."""
        response = client.post(
            "/api/auth/login",
            json={"email": "teste@example.com", "password": ""},
        )
        assert response.status_code == 422


class TestMe:
    def test_me_authenticated(self, client: TestClient):
        """GET /me com token valido deve retornar dados do usuario."""
        resp = client.post(
            "/api/auth/signup",
            json={"email": "me@example.com", "password": "senha123"},
        )
        token = resp.json()["access_token"]

        response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "me@example.com"
        assert "id" in data
        assert "created_at" in data

    def test_me_without_token(self, client: TestClient):
        """GET /me sem token deve retornar 403 (HTTPBearer padrao)."""
        response = client.get("/api/auth/me")
        assert response.status_code == 403

    def test_me_with_invalid_token(self, client: TestClient):
        """GET /me com token invalido deve retornar 401."""
        response = client.get("/api/auth/me", headers={"Authorization": "Bearer token_invalido"})
        assert response.status_code == 401


class TestLogout:
    def test_logout_authenticated(self, client: TestClient):
        """Logout com token valido deve retornar sucesso."""
        resp = client.post(
            "/api/auth/signup",
            json={"email": "logout@example.com", "password": "senha123"},
        )
        token = resp.json()["access_token"]

        response = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json()["message"] == "Logout realizado com sucesso"

    def test_logout_without_token(self, client: TestClient):
        """Logout sem token deve retornar 403 (HTTPBearer padrao)."""
        response = client.post("/api/auth/logout")
        assert response.status_code == 403


class TestPasswordReset:
    def test_reset_request_returns_message(self, client: TestClient):
        """Solicitacao de reset deve retornar mensagem generica (seguranca)."""
        response = client.post(
            "/api/auth/reset-password/request",
            json={"email": "qualquer@example.com"},
        )
        assert response.status_code == 200
        assert "message" in response.json()

    def test_reset_confirm_success(self, client: TestClient):
        """Reset de senha com email valido deve funcionar."""
        client.post(
            "/api/auth/signup",
            json={"email": "reset@example.com", "password": "senha123"},
        )
        response = client.post(
            "/api/auth/reset-password/confirm",
            json={"email": "reset@example.com", "new_password": "novaSenha456"},
        )
        assert response.status_code == 200

        # Verificar que a nova senha funciona
        login_resp = client.post(
            "/api/auth/login",
            json={"email": "reset@example.com", "password": "novaSenha456"},
        )
        assert login_resp.status_code == 200

    def test_reset_confirm_nonexistent_email(self, client: TestClient):
        """Reset de senha com email inexistente deve retornar 404."""
        response = client.post(
            "/api/auth/reset-password/confirm",
            json={"email": "inexistente@example.com", "new_password": "novaSenha456"},
        )
        assert response.status_code == 404