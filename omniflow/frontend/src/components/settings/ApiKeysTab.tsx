import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ApiKeysTabProps {
  onClose?: () => void;
}

export const ApiKeysTab: React.FC<ApiKeysTabProps> = ({ onClose }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setGeminiKey(localStorage.getItem('gemini_api_key') || '');
    setGroqKey(localStorage.getItem('groq_api_key') || '');
  }, []);

  const handleSave = () => {
    if (geminiKey) localStorage.setItem('gemini_api_key', geminiKey);
    if (groqKey) localStorage.setItem('groq_api_key', groqKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-tab-pane" id="paneApiKeys">
      <div className="pane-header-row">
        <div>
          <h2 className="pane-title">API Keys & Model Providers</h2>
          <p className="pane-desc" style={{ color: '#71717a', fontSize: '12.5px', marginTop: '4px' }}>
            Manage API credentials for Gemini 2.5 Pro, Groq LLaMA 3.3, and hybrid orchestration.
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

      <div className="settings-field-column" style={{ marginTop: '16px' }}>
        <label className="settings-form-label">GEMINI API KEY</label>
        <input
          type="password"
          className="settings-input full"
          id="inputGeminiApiKey"
          placeholder="AIzaSy..."
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
        />
      </div>

      <div className="settings-field-column" style={{ marginTop: '16px' }}>
        <label className="settings-form-label">GROQ API KEY</label>
        <input
          type="password"
          className="settings-input full"
          id="inputGroqApiKey"
          placeholder="gsk_..."
          value={groqKey}
          onChange={(e) => setGroqKey(e.target.value)}
        />
      </div>

      <div className="settings-form-actions" style={{ marginTop: '24px' }}>
        <button type="button" className="settings-btn-primary" id="btnSaveApiKeys" onClick={handleSave}>
          {saved ? '✓ Saved API Keys' : 'Save API Keys'}
        </button>
      </div>
    </div>
  );
};

export default ApiKeysTab;
