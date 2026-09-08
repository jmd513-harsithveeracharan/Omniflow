import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

export const MemoryTab: React.FC = () => {
  const [turns, setTurns] = useState(14);
  const [tokens, setTokens] = useState(1280);
  const [cleared, setCleared] = useState(false);

  const handleClear = () => {
    setTurns(0);
    setTokens(0);
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="settings-tab-pane">
      <div className="pane-header-row" style={{ marginBottom: '16px' }}>
        <h2 className="pane-title" style={{ fontSize: '18px', fontWeight: 600, color: '#f4f4f5' }}>
          Memory Store
        </h2>
        <p style={{ fontSize: '12.5px', color: '#71717a', margin: '2px 0 0 0' }}>
          SQLite multi-turn conversation memory with rolling context and token budget enforcement.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', margin: '16px 0' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#38bdf8' }}>{turns}</div>
          <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>Active Conversation Turns</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981' }}>{tokens} / 2,200</div>
          <div style={{ fontSize: '12px', color: '#71717a', marginTop: '4px' }}>Token Budget Used</div>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <button
          type="button"
          onClick={handleClear}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '8px 14px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
        >
          <Trash2 width={13} height={13} />
          <span>{cleared ? 'Memory Cleared!' : 'Clear Short-Term Memory'}</span>
        </button>
      </div>
    </div>
  );
};
