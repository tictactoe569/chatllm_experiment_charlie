const API_BASE = window.location.origin;

// --- Auth ---

function getToken() {
  return localStorage.getItem("chatllm_token");
}

function setToken(token) {
  if (token) localStorage.setItem("chatllm_token", token);
  else localStorage.removeItem("chatllm_token");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRegister(email, password) {
  const resp = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.detail || "Erro ao registrar");
  setToken(data.access_token);
  return data;
}

async function apiLogin(email, password) {
  const resp = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.detail || "Erro ao fazer login");
  setToken(data.access_token);
  return data;
}

async function apiMe() {
  const token = getToken();
  if (!token) return null;
  const resp = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { ...authHeaders() },
  });
  if (!resp.ok) {
    setToken(null);
    return null;
  }
  return resp.json();
}

function apiLogout() {
  setToken(null);
}

// --- Chat ---

async function sendMessageStream({ message, history, session_key, onDelta, signal }) {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ message, history, session_key }),
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
  let finalSessionKey = null;

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

      if (payload.session_key) {
        finalSessionKey = payload.session_key;
      }

      if (payload.delta) {
        onDelta(payload.delta);
      }
    }
  }

  return finalSessionKey;
}

async function fetchSessions() {
  const resp = await fetch(`${API_BASE}/api/sessions`, { headers: { ...authHeaders() } });
  if (!resp.ok) throw new Error("Erro ao carregar sessoes");
  const data = await resp.json();
  return data.sessions;
}

async function createSession() {
  const resp = await fetch(`${API_BASE}/api/sessions`, { method: "POST", headers: { ...authHeaders() } });
  if (!resp.ok) throw new Error("Erro ao criar sessao");
  return resp.json();
}

async function deleteSession(sessionId) {
  const resp = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!resp.ok) throw new Error("Erro ao excluir sessao");
  return resp.json();
}

async function fetchSessionMessages(sessionId) {
  const resp = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    headers: { ...authHeaders() },
  });
  if (!resp.ok) throw new Error("Erro ao carregar mensagens");
  return resp.json();
}

async function generateSessionTitle(sessionId) {
  const resp = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/title`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.title;
}
