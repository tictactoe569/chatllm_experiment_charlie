const { useEffect, useMemo, useRef, useState } = React;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- Auth Screen ---

function AuthScreen({ onAuth, onResetPassword }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const data = await login(email, password);
        onAuth(data.access_token);
      } else if (mode === "signup") {
        const data = await signup(email, password);
        onAuth(data.access_token);
      } else if (mode === "reset") {
        await requestPasswordReset(email);
        setResetSent(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (resetSent) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>ChatLLM Lab</h1>
          <p className="auth-note">Se o email estiver cadastrado, voce recebera um link para redefinir sua senha.</p>
          <button className="auth-link" onClick={() => { setMode("login"); setResetSent(false); }}>
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>ChatLLM Lab</h1>
        <p className="auth-subtitle">{mode === "login" ? "Entre na sua conta" : mode === "signup" ? "Crie sua conta" : "Redefinir senha"}</p>

        {error && <div className="note error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
            autoFocus
          />
          {mode !== "reset" && (
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={busy}
            />
          )}
          <button type="submit" disabled={busy || !email.trim() || (mode !== "reset" && !password.trim())}>
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar email"}
          </button>
        </form>

        <div className="auth-links">
          {mode === "login" && (
            <>
              <button className="auth-link" onClick={() => setMode("signup")}>Criar conta</button>
              <button className="auth-link" onClick={() => setMode("reset")}>Esqueci a senha</button>
            </>
          )}
          {mode === "signup" && (
            <button className="auth-link" onClick={() => setMode("login")}>Ja tenho conta</button>
          )}
          {mode === "reset" && (
            <button className="auth-link" onClick={() => setMode("login")}>Voltar ao login</button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Chat App (logged in) ---

function ChatApp({ token, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Carregar sessoes ao montar
  useEffect(() => {
    listSessions(token).then((sess) => {
      setSessions(sess);
      if (sess.length > 0) {
        setActiveSessionId(sess[0].id);
      }
    }).catch(() => {});
  }, [token]);

  // Carregar mensagens da sessao ativa
  useEffect(() => {
    if (activeSessionId === null) {
      setMessages([]);
      return;
    }
    getSessionMessages(activeSessionId, token).then((msgs) => {
      setMessages(msgs.length > 0
        ? msgs
        : [{
            id: createMessageId(),
            role: "assistant",
            content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
          }]
      );
    }).catch(() => {
      setMessages([{
        id: createMessageId(),
        role: "assistant",
        content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
      }]);
    });
  }, [activeSessionId, token]);

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

  const handleNewSession = async () => {
    try {
      const session = await createSession(token);
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteSession(sessionId, token);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectSession = (sessionId) => {
    if (busy) return;
    setActiveSessionId(sessionId);
  };

  const onSubmit = async (event, inputRef) => {
    event.preventDefault();
    const cleaned = text.trim();
    if (!cleaned || busy) return;

    let sessionId = activeSessionId;
    if (sessionId === null) {
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
      await sendMessageStream({
        message: cleaned,
        history: chatHistory,
        sessionId,
        token,
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

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId && !msg.content.trim()
            ? { ...msg, content: "Nao foi possivel obter resposta do modelo agora." }
            : msg
        )
      );

      const updated = await listSessions(token);
      setSessions(updated);
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

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={handleNewSession} title="Nova conversa">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="8" y1="1" x2="8" y2="15" />
              <line x1="1" y1="8" x2="15" y2="8" />
            </svg>
            Nova conversa
          </button>
        </div>
        <nav className="sidebar-sessions">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item ${s.id === activeSessionId ? "active" : ""}`}
              onClick={() => handleSelectSession(s.id)}
            >
              <span className="session-title" title={s.title}>{s.title}</span>
              <button
                className="session-delete"
                onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                title="Excluir conversa"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="2" y1="2" x2="12" y2="12" />
                  <line x1="12" y1="2" x2="2" y2="12" />
                </svg>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      <main className="app-shell">
        <header className="app-header">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="Alternar sidebar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="4" x2="16" y2="4" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="14" x2="16" y2="14" />
            </svg>
          </button>
          <div className="brand">ChatLLM Lab</div>
          <button className="logout-btn" onClick={onLogout} title="Sair">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="13" y1="4" x2="13" y2="14" />
              <polyline points="9,6 13,9 9,12" />
              <line x1="4" y1="9" x2="13" y2="9" />
            </svg>
          </button>
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

// --- Root App ---

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("chatllm_token"));

  // Verificar se o token ainda e valido ao montar
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (token) {
      getMe(token).then((user) => {
        if (!user) {
          localStorage.removeItem("chatllm_token");
          setToken(null);
        }
      }).catch(() => {
        localStorage.removeItem("chatllm_token");
        setToken(null);
      }).finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const handleAuth = (newToken) => {
    localStorage.setItem("chatllm_token", newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("chatllm_token");
    setToken(null);
  };

  if (checking) return null;

  if (!token) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return <ChatApp token={token} onLogout={handleLogout} />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

