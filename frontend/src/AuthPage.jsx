const { useState } = React;

function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("Informe um email valido");
      return;
    }
    if (password.length < 6) {
      setError("Senha deve ter no minimo 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await apiLogin(email, password);
      } else {
        await apiRegister(email, password);
      }
      onAuthSuccess();
    } catch (err) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">ChatLLM Lab</h1>
        <p className="auth-subtitle">
          {mode === "login" ? "Entre com sua conta" : "Crie sua conta"}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading
              ? "Aguarde..."
              : mode === "login"
              ? "Entrar"
              : "Criar conta"}
          </button>
        </form>

        <p className="auth-toggle">
          {mode === "login" ? (
            <>
              Nao tem conta?{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); toggleMode(); }}>
                Registre-se
              </a>
            </>
          ) : (
            <>
              Ja tem conta?{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); toggleMode(); }}>
                Faca login
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}