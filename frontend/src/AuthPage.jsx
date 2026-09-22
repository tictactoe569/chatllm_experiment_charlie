const { useState } = React;

function AuthPage({ onAuthSuccess, onClose }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (e) => {
    return e.includes("@") && e.includes(".");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Email deve conter @ e . (ex: usuario@gmail.com)");
      return;
    }
    if (password.length < 3) {
      setError("Senha deve ter pelo menos 3 caracteres");
      return;
    }

    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await login(email, password);
      } else {
        result = await signup(email, password);
      }
      localStorage.setItem("token", result.access_token);
      onAuthSuccess(result.email);
    } catch (err) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card-modal">
      <div className="auth-card-modal-header">
        <h2 className="auth-title">{mode === "login" ? "Entrar" : "Cadastrar"}</h2>
        <button className="auth-close-btn" onClick={onClose}>&times;</button>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input"
          type="text"
          placeholder="Email (ex: usuario@gmail.com)"
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
          minLength={3}
        />
        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
        </button>
      </form>

      <p className="auth-toggle">
        {mode === "login" ? (
          <>
            Nao tem conta?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); setError(""); }}>
              Cadastre-se
            </a>
          </>
        ) : (
          <>
            Ja tem conta?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(""); }}>
              Faca login
            </a>
          </>
        )}
      </p>
    </div>
  );
}