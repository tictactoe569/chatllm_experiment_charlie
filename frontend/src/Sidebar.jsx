const { useState } = React;

function Sidebar({ sessions, activeSessionId, onSelectSession, onCreateSession, onDeleteSession, onRenameSession }) {
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const startRename = (session) => {
    setEditingId(session.id);
    setEditText(session.title || "Nova conversa");
  };

  const submitRename = () => {
    const trimmed = editText.trim();
    if (trimmed && editingId) {
      onRenameSession(editingId, trimmed);
    }
    setEditingId(null);
    setEditText("");
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Conversas</span>
        <button className="sidebar-new-btn" onClick={onCreateSession} title="Nova conversa">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="2" x2="8" y2="14" />
            <line x1="2" y1="8" x2="14" y2="8" />
          </svg>
        </button>
      </div>
      <nav className="sidebar-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`sidebar-item ${session.id === activeSessionId ? "active" : ""}`}
            onClick={() => onSelectSession(session.id)}
          >
            {editingId === session.id ? (
              <input
                className="sidebar-rename-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="sidebar-item-title"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(session);
                }}
              >
                {session.title || "Nova conversa"}
              </span>
            )}
            <button
              className="sidebar-del-btn"
              title="Deletar"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session.id);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}