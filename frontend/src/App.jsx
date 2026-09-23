const { useEffect, useMemo, useRef, useState, useCallback } = React;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* Tela de Login / Cadastro */
function AuthScreen({ onAuth }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = isRegister ? register : login;
      const data = await fn(email, password);
      onAuth(data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">ChatLLM Lab</h1>
        <p className="auth-subtitle">{isRegister ? "Criar conta" : "Entrar"}</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <button type="submit" disabled={loading}>{loading ? "Aguarde..." : isRegister ? "Cadastrar" : "Entrar"}</button>
        </form>
        <p className="auth-toggle">
          {isRegister ? "Ja tem conta?" : "Nao tem conta?"}{" "}
          <button type="button" className="link-btn" onClick={() => { setIsRegister(!isRegister); setError(""); }}>
            {isRegister ? "Fazer login" : "Cadastrar"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* Sidebar */
function Sidebar({ sessions, activeId, onSelect, onCreate, onDelete }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onCreate} title="Nova conversa">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/></svg>
          Nova conversa
        </button>
      </div>
      <div className="sidebar-list">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`sidebar-item ${s.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <span className="sidebar-item-title">{s.title || "Nova conversa"}</span>
            <button
              className="sidebar-item-delete"
              onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
              title="Excluir"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22z"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* App principal */
function App() {
  const [token, setToken] = useState(() => localStorage.getItem("chatllm_token"));
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (token) {
      getMe(token)
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem("chatllm_token");
          setToken(null);
        });
    }
  }, [token]);

  useEffect(() => {
    if (token && user) {
      listSessions(token).then((data) => {
        setSessions(data.sessions);
        if (data.sessions.length > 0 && !activeSessionId) {
          switchSession(data.sessions[0].id);
        }
      }).catch(() => {});
    }
  }, [token, user]);

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

  const switchSession = useCallback(async (sessionId) => {
    setActiveSessionId(sessionId);
    setMessages([]);
    setError("");
    if (token) {
      try {
        const history = await getSessionMessages(token, sessionId);
        setMessages([
          { id: createMessageId(), role: "assistant", content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?" },
          ...history.map((m) => ({ id: createMessageId(), role: m.role, content: m.content })),
        ]);
      } catch {
        setMessages([{ id: createMessageId(), role: "assistant", content: "Bem-vindo ao ChatLLM Lb. Como posso ajudar oce hoje?" }]);
      }
    }
  }, [token]);

  const handleNewSession = useCallback(async () => {
    if (token) {
      try {
        const session = await createSession(token);
        setSessions((prev) => [session, ...prev]);
        switchSession(session.id);
      } catch (err) {
        setError(err.message);
      }
    }
  }, [token, switchSession]);

  const handleDeleteSession = useCallback(async (sessionId) => {
    if (!token) return;
    try {
      await deleteSession(token, sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {          switchSession(remaining[0].id);
        } else {
          handleNewSession();
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }, [token, activeSessionId, sessions, switchSession, handleNewSession]);

  const onStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);
  };

  const onSubmit = async (event, inputRef) => {
    event.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || busy) return;

    let sessionId = activeSessionId;
    if (!sessionId && token) {
      try {
        const session = await createSession(token);
        setSessions((prev) => [session, ...prev]);
        sessionId = session.id;
        setActiveSessionId(session.id);
      } catch (err) {
        setError(err.message);
        return;
      }
    }

    setError("");    const userMessage = { id: createMessageId(), role: "user", content: cleaned };
    const assistantMessageId = createMessageId();

    setMessages((prev) => [...prev, userMessage, { id: assistantMessageId, role: "assistant", content: "" }]);
    setText("");    setBusy(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await sendMessageStream({
        message: cleaned,
        sessionId,        history: chatHistory,
        signal: abortController.signal,
        onDelta: (delta) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: \x60\x24{msg.content}\x24{delta}\x60 } : msg
            )
          );
        },
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId && !msg.content.trim()
            ? { ...msg, content: "Nao foi possivel obter resposta do modelo agora." }
            : msg
        )
      );

      if (token) {
        try {
          const data = await listSessions(token);
          setSessions(data.sessions);
        } catch {}
      }
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

  const handleAuth = (newToken) => {
    localStorage.setItem("chatllm_token", newToken);
    setToken(newToken);
  };

  const handleLogout = async () => {
    try { await logout(token); } catch {}
    localStorage.removeItem("chatllm_token");
    setToken(null);
    setUser(null);
    setSessions([]);
    setActiveSessionId(null);
    setMessages([]);
  };

  if (!token || !user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        activeId={activeSessionId}
        onSelect={switchSession}
        onCreate={handleNewSession}
        onDelete={handleDeleteSession}
      />
      <main className="app-shell">
        <header className="app-header">
          <div className="brand">ChatLLM Lab</div>
          <div className="header-right">
            <span className="user-email">{user.email}</span>
            <button type="button" className="logout-btn" onClick={handleLogout}>Sair</button>
          </div>
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

        <Composer text={text} busy={busy} error={error} onChangeText={setText} onSubmit={onSubmit} onStop={onStop} />

        <div className="warning-banner">Lembre-se, voce precisa focar no experimento!!!</div>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
