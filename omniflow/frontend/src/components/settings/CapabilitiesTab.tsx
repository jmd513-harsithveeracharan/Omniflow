import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CapabilitiesTabProps {
  onClose?: () => void;
}

export const CapabilitiesTab: React.FC<CapabilitiesTabProps> = ({ onClose }) => {
  const [effort, setEffort] = useState('Medium');
  const [safeDelete, setSafeDelete] = useState(true);
  const [autoFix, setAutoFix] = useState(true);

  return (
    <div className="settings-tab-pane" id="paneCapabilities">
      <div className="pane-header-row">
        <div>
          <h2 className="pane-title">Capabilities & Engine Controls</h2>
          <p className="pane-desc" style={{ color: '#71717a', fontSize: '12.5px', marginTop: '4px' }}>
            Deep reasoning effort, safe blast-radius guardrails, and self-healing execution loops.
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Deep Reasoning Effort</span>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>{effort}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Low', 'Medium', 'High'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setEffort(lvl)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: effort === lvl ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                  background: effort === lvl ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                  color: effort === lvl ? '#38bdf8' : '#a1a1aa',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Safe Blast-Radius Gate</div>
            <div style={{ fontSize: '11.5px', color: '#71717a' }}>Enforce snapshot backup and typed confirmation before deleting items</div>
          </div>
          <input
            type="checkbox"
            checked={safeDelete}
            onChange={(e) => setSafeDelete(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: '#0078d4', cursor: 'pointer' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Self-Healing Syntax Transpiler</div>
            <div style={{ fontSize: '11.5px', color: '#71717a' }}>Automatically repair PySpark and Delta syntax on execution failure</div>
          </div>
          <input
            type="checkbox"
            checked={autoFix}
            onChange={(e) => setAutoFix(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: '#0078d4', cursor: 'pointer' }}
          />
        </div>
      </div>
    </div>
  );
};

export default CapabilitiesTab;
