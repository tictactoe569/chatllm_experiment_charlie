const { useEffect, useMemo, useRef, useState } = React;

let autoTitleTimer = null;

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createWelcomeMessage() {
  return {
    id: createMessageId(),
    role: "assistant",
    content: "Bem-vindo ao ChatLLM Lab. Como posso ajudar voce hoje?",
  };
}

function App() {
  const [user, setUser] = useState(null); // null = not loaded, { id, email } = logged in
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([createWelcomeMessage()]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesRef = useRef(null);
  const abortControllerRef = useRef(null);
  const loadedSessionRef = useRef(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    apiMe().then((u) => {
      setUser(u);
      setCheckingAuth(false);
    });
  }, []);

  // Load sessions when user is authenticated
  useEffect(() => {
    if (user) {
      fetchSessions()
        .then(setSessions)
        .catch(() => {});
    }
  }, [user]);

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

  // Auto-generate title after first assistant reply
  const scheduleAutoTitle = (sessionId) => {
    if (autoTitleTimer) clearTimeout(autoTitleTimer);
    autoTitleTimer = setTimeout(async () => {
      const title = await generateSessionTitle(sessionId);
      if (title) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        );
      }
    }, 500);
  };

  const loadSession = async (sessionId) => {
    if (busy) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setBusy(false);

    loadedSessionRef.current = sessionId;
    setCurrentSessionId(sessionId);
    setError("");

    if (!sessionId) {
      setMessages([createWelcomeMessage()]);
      return;
    }

    try {
      const msgs = await fetchSessionMessages(sessionId);
      if (msgs.length === 0) {
        setMessages([createWelcomeMessage()]);
      } else {
        setMessages(
          msgs.map((m) => ({
            id: createMessageId(),
            role: m.role,
            content: m.content,
          }))
        );
      }
    } catch (err) {
      setError("Erro ao carregar historico da sessao.");
      setMessages([createWelcomeMessage()]);
    }
  };

  const handleNewSession = async () => {
    if (busy) return;
    try {
      const session = await createSession();
      setSessions((prev) => [session, ...prev]);
      loadedSessionRef.current = session.id;
      setCurrentSessionId(session.id);
      setMessages([createWelcomeMessage()]);
      setError("");
    } catch (err) {
      setError("Erro ao criar nova sessao.");
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        loadedSessionRef.current = null;
        setCurrentSessionId(null);
        setMessages([createWelcomeMessage()]);
      }
    } catch (err) {
      setError("Erro ao excluir sessao.");
    }
  };

  const handleLogout = () => {
    apiLogout();
    setUser(null);
    setSessions([]);
    setCurrentSessionId(null);
    setMessages([createWelcomeMessage()]);
  };

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

    const currentKey = loadedSessionRef.current;

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
      const resultKey = await sendMessageStream({
        message: cleaned,
        history: chatHistory,
        session_key: currentKey,
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

      if (resultKey && !currentKey) {
        loadedSessionRef.current = resultKey;
        setCurrentSessionId(resultKey);
        setSessions((prev) => [
          { id: resultKey, title: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          ...prev,
        ]);
        scheduleAutoTitle(resultKey);
      } else if (currentKey) {
        scheduleAutoTitle(currentKey);
      }

      fetchSessions().then(setSessions).catch(() => {});

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

  // Auth check loading
  if (checkingAuth) {
    return (
      <main className="app-shell">
        <div className="auth-loading">Carregando...</div>
      </main>
    );
  }

  // Not authenticated — show login/register page
  if (!user) {
    return (
      <AuthPage
        onAuthSuccess={() => {
          apiMe().then(setUser);
        }}
      />
    );
  }

  // Authenticated — show chat
  return (
    <div className="app-shell">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelect={loadSession}
        onNew={handleNewSession}
        onDelete={handleDeleteSession}
        sidebarOpen={sidebarOpen}
      />

      <div className="app-main">
        <header className="app-header">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Alternar barra lateral"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="4" x2="15" y2="4" />
              <line x1="3" y1="9" x2="15" y2="9" />
              <line x1="3" y1="14" x2="15" y2="14" />
            </svg>
          </button>
          <div className="brand">ChatLLM Lab</div>
          <div className="header-spacer" />
          {user && (
            <div className="header-user">
              <span className="header-email" title={user.email}>
                {user.email}
              </span>
              <button className="header-logout-btn" onClick={handleLogout} title="Sair">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
                  <polyline points="10,12 14,8 10,4" />
                  <line x1="14" y1="8" x2="6" y2="8" />
                </svg>
              </button>
            </div>
          )}
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
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

