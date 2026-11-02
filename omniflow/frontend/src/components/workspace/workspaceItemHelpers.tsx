export const getItemIcon = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('lakehouse')) {
    return (
      <div
        className="ws-item-icon-box"
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <path d="M16 3L3 10.5V21.5L16 29L29 21.5V10.5L16 3Z" fill="#008272" />
          <path d="M16 3L29 10.5V21.5L16 29V3Z" fill="#00A88F" />
          <path d="M16 3L29 10.5L16 18L3 10.5L16 3Z" fill="#00D2A0" />
        </svg>
      </div>
    );
  }
  if (t.includes('notebook')) {
    return (
      <div
        className="ws-item-icon-box"
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <rect
            x="4"
            y="4"
            width="24"
            height="24"
            rx="6"
            fill="rgba(16, 185, 129, 0.15)"
            stroke="#10b981"
            strokeWidth="1.5"
          />
          <text
            x="16"
            y="21"
            fontFamily="'JetBrains Mono', monospace"
            fontSize="13"
            fontWeight="700"
            fill="#10b981"
            textAnchor="middle"
          >
            Py
          </text>
        </svg>
      </div>
    );
  }
  if (t.includes('pipeline')) {
    return (
      <div
        className="ws-item-icon-box"
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <circle cx="8" cy="16" r="4" fill="#a855f7" />
          <circle cx="24" cy="8" r="4" fill="#38bdf8" />
          <circle cx="24" cy="24" r="4" fill="#10b981" />
          <path d="M12 16h6M18 16V8h2M18 16v8h2" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  if (t.includes('agent')) {
    return (
      <div
        className="ws-item-icon-box"
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <rect
            x="5"
            y="7"
            width="22"
            height="18"
            rx="5"
            fill="rgba(245, 158, 11, 0.15)"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
          <circle cx="11" cy="15" r="2" fill="#f59e0b" />
          <circle cx="21" cy="15" r="2" fill="#f59e0b" />
          <line x1="16" y1="2" x2="16" y2="7" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className="ws-item-icon-box"
      style={{
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
        <rect x="5" y="5" width="22" height="22" rx="4" fill="#1e1f20" stroke="#52525b" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="4" fill="#a1a1aa" />
      </svg>
    </div>
  );
};

export const getBadgeClass = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('lakehouse')) return 'badge-lakehouse';
  if (t.includes('notebook')) return 'badge-notebook';
  if (t.includes('pipeline')) return 'badge-pipeline';
  if (t.includes('agent')) return 'badge-agent';
  return 'badge-generic';
};
