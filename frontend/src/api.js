const API_BASE = window.location.origin;

// --- Auth API ---

async function signup(email, password) {
  const response = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Erro ao criar conta");
  }
  return response.json();
}

async function login(email, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Erro ao fazer login");
  }
  return response.json();
}

async function getMe(token) {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function requestPasswordReset(email) {
  const response = await fetch(`${API_BASE}/api/auth/reset-password/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return response.json();
}

async function confirmPasswordReset(email, newPassword) {
  const response = await fetch(`${API_BASE}/api/auth/reset-password/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, new_password: newPassword }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Erro ao redefinir senha");
  }
  return response.json();
}

// --- Chat API ---

async function sendMessageStream({ message, history, sessionId, token, onDelta, signal }) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, history, session_id: sessionId }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body?.detail || "Erro ao enviar mensagem para o servidor.";
    throw new Error(detail);
  }

  if (!response.body) {
    throw new Error("Streaming nao suportado no ambiente atual.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      const line = rawEvent
        .split("\n")
        .find((part) => part.startsWith("data:"));
      if (!line) continue;

      const payloadText = line.slice(5).trim();
      if (!payloadText) continue;

      let payload;
      try {
        payload = JSON.parse(payloadText);
      } catch {
        continue;
      }

      if (payload.error) {
        throw new Error(payload.error);
      }

      if (payload.delta) {
        onDelta(payload.delta);
      }
    }
  }
}

// --- Session API ---

async function listSessions(token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/sessions`, { headers });
  if (!response.ok) throw new Error("Erro ao listar sessoes");
  const data = await response.json();
  return data.sessions;
}

async function createSession(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/sessions`, { method: "POST", headers });
  if (!response.ok) throw new Error("Erro ao criar sessao");
  return response.json();
}

async function deleteSession(sessionId, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: "DELETE", headers });
  if (!response.ok) throw new Error("Erro ao excluir sessao");
}

async function getSessionMessages(sessionId, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, { headers });
  if (!response.ok) throw new Error("Erro ao carregar mensagens da sessao");
  return response.json();
}
