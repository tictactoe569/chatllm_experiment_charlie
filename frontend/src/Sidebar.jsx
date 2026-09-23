function Sidebar({ sessions, currentSessionId, onSelect, onNew, onDelete, sidebarOpen }) {
  if (!sidebarOpen) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Chats</span>
      </div>

      <button className="sidebar-new-btn" onClick={onNew}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <line x1="7" y1="1" x2="7" y2="13" />
          <line x1="1" y1="7" x2="13" y2="7" />
        </svg>
        Nova conversa
      </button>

      <nav className="sidebar-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`sidebar-item ${session.id === currentSessionId ? "active" : ""}`}
            onClick={() => onSelect(session.id)}
          >
            <span className="sidebar-item-title" title={session.title || "Sem titulo"}>
              {session.title || "Nova conversa"}
            </span>
            <button
              className="sidebar-item-del"
              title="Excluir conversa"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.id);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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