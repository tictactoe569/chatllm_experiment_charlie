const { useEffect, useMemo, useRef, useState } = React;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Erro");
      }
      onAuth();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-overlay">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>{mode === "login" ? "Entrar" : "Cadastrar"}</h2>
        {error && <div className="auth-error">{error}</div>}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <button type="submit">{mode === "login" ? "Entrar" : "Cadastrar"}</button>
        <button type="button" className="auth-toggle" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Nao tem conta? Cadastre-se" : "Ja tem conta? Entre"}
        </button>
      </form>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState([
    {
      id: createMessageId(),
      role: "assistant",
      content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const messagesRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setAuthenticated(true);
          setUserEmail(data.email);
          loadSessions();
        }
      }
    } catch {}
  };

  const handleAuth = () => {
    setAuthenticated(true);
    loadSessions();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setUserEmail("");
    setSessions([]);
    setCurrentSessionId(null);
    setMessages([
      {
        id: createMessageId(),
        role: "assistant",
        content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
      },
    ]);
  };

  const loadSessions = async () => {
    try {
      const list = await listSessions();
      setSessions(list);
    } catch (err) {
      console.error("Erro ao carregar sessoes:", err);
    }
  };

  const loadSessionMessages = async (sessionId) => {
    try {
      const msgs = await getSessionMessages(sessionId);
      if (msgs.length === 0) {
        setMessages([
          {
            id: createMessageId(),
            role: "assistant",
            content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
          },
        ]);
      } else {
        setMessages(
          msgs.map((m) => ({
            id: createMessageId(),
            role: m.role,
            content: m.content,
          }))
        );
      }
      setCurrentSessionId(sessionId);
    } catch (err) {
      console.error("Erro ao carregar historico:", err);
    }
  };

  const handleNewSession = async () => {
    try {
      const session = await createSession();
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session.id);
      setMessages([
        {
          id: createMessageId(),
          role: "assistant",
          content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
        },
      ]);
    } catch (err) {
      console.error("Erro ao criar sessao:", err);
    }
  };

  const handleDeleteSession = async (sessionId, event) => {
    event.stopPropagation();
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([
          {
            id: createMessageId(),
            role: "assistant",
            content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
          },
        ]);
      }
    } catch (err) {
      console.error("Erro ao deletar sessao:", err);
    }
  };

  const handleSelectSession = (sessionId) => {
    if (sessionId === currentSessionId) return;
    loadSessionMessages(sessionId);
  };

  const chatHistory = useMemo(
    () => messages.filter((msg) => msg.role === "user" || msg.role === "assistant"),
    [messages]
  );

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const onStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);
  };

  const onSubmit = async (event, inputRef) => {
    event.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || busy) return;

    setError("");
    const userMessage = { id: createMessageId(), role: "user", content: cleaned };
    const assistantMessageId = createMessageId();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);
    setText("");
    setBusy(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const newSessionId = await sendMessageStream({
        message: cleaned,
        history: chatHistory,
        session_id: currentSessionId,
        signal: abortController.signal,
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: `${msg.content}${delta}` }
                : msg
            )
          );
        },
      });

      if (newSessionId && newSessionId !== currentSessionId) {
        setCurrentSessionId(newSessionId);
      }

      loadSessions();

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId && !msg.content.trim()
            ? { ...msg, content: "Nao foi possivel obter resposta do modelo agora." }
            : msg
        )
      );
    } catch (err) {
      const aborted = err?.name === "AbortError";
      if (!aborted) {
        setError(err.message || "Falha inesperada ao gerar resposta.");
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content.trim() ? msg.content : "Nao foi possivel obter resposta do modelo agora." }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId && !msg.content.trim()
              ? { ...msg, content: "Resposta interrompida." }
              : msg
          )
        );
      }
    } finally {
      abortControllerRef.current = null;
      setBusy(false);
    }
  };

  if (!authenticated) {
    return <AuthForm onAuth={handleAuth} />;
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="Fechar sidebar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="14" y1="4" x2="4" y2="14" />
              <line x1="4" y1="4" x2="14" y2="14" />
            </svg>
          </button>
          <button className="new-chat-btn" onClick={handleNewSession} aria-label="Nova sessao">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="8" y1="2" x2="8" y2="14" />
              <line x1="2" y1="8" x2="14" y2="8" />
            </svg>
            <span>Nova sessao</span>
          </button>
        </div>
        <div className="sidebar-sessions">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${s.id === currentSessionId ? "active" : ""}`}
              onClick={() => handleSelectSession(s.id)}
            >
              <span className="session-title">{s.title || "Nova sessao"}</span>
              <button
                className="session-delete"
                onClick={(e) => handleDeleteSession(s.id, e)}
                aria-label="Deletar sessao"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="3" y1="3" x2="11" y2="11" />
                  <line x1="11" y1="3" x2="3" y2="11" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <span className="sidebar-email">{userEmail}</span>
          <button className="logout-btn" onClick={handleLogout}>Sair</button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button className="sidebar-open-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir sidebar">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>
      )}

      <main className="app-shell">
        <header className="app-header">
          <div className="brand">ChatLLM Lab</div>
        </header>

        <section className="messages" aria-live="polite" ref={messagesRef}>
          <div className="messages-inner">
            {messages.map((msg) => (
              <article key={msg.id} className={`bubble ${msg.role}`}>
                <MessageContent content={msg.content} />
              </article>
            ))}
          </div>
        </section>

        <Composer
          text={text}
          busy={busy}
          error={error}
          onChangeText={setText}
          onSubmit={onSubmit}
          onStop={onStop}
        />

        <div className="warning-banner">Lembre-se, voce precisa focar no experimento!!!</div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

