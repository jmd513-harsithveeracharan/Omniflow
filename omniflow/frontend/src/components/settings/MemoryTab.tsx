import React, { useState } from 'react';
import { X } from 'lucide-react';

interface MemoryTabProps {
  onClose?: () => void;
}

export const MemoryTab: React.FC<MemoryTabProps> = ({ onClose }) => {
  const [turns, setTurns] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [cleared, setCleared] = useState(false);

  const handleClear = () => {
    setTurns(0);
    setTokens(0);
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="settings-tab-pane" id="paneMemory">
      <div className="pane-header-row">
        <div>
          <h2 className="pane-title">Memory Store</h2>
          <p className="pane-desc" style={{ color: '#71717a', fontSize: '12.5px', marginTop: '4px' }}>
            SQLite multi-turn conversation memory with 10-turn rolling window & 2,200 token budget cap.
          </p>
        </div>
        <div className="pane-header-actions">
          {onClose && (
            <button type="button" className="btn-subtle-icon btn-close-modal-icon" title="Close dialog" onClick={onClose}>
              <X width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      <div className="memory-stats-grid" id="settingsMemoryStats" style={{ marginTop: '16px' }}>
        <div className="memory-stat-card">
          <span className="memory-stat-num" id="settingsMemTurns">{turns}</span>
          <span className="memory-stat-label">Active Conversation Turns</span>
        </div>
        <div className="memory-stat-card">
          <span className="memory-stat-num" id="settingsMemTokens">{tokens}</span>
          <span className="memory-stat-label">Token Budget Used</span>
        </div>
      </div>

      <div className="settings-form-actions" style={{ marginTop: '24px' }}>
        <button type="button" className="settings-btn-secondary" id="btnClearMemoryBtn" onClick={handleClear}>
          {cleared ? '✓ Memory Cleared' : 'Clear Short-Term Memory'}
        </button>
      </div>
    </div>
  );
};

export default MemoryTab;
