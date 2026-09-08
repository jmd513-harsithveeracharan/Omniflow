import React, { useState } from 'react';
import {
  Search,
  Settings,
  User,
  KeyRound,
  Cpu,
  Palette,
  Check,
  ShieldCheck,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userName = 'Bheesetti Harsith',
  userEmail = 'bheesetti.harsith@fabric.ai',
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'account' | 'vault' | 'model' | 'appearance'>('general');
  const [workspaceId, setWorkspaceId] = useState('PBT_DATA_AGENT');
  const [targetFolder, setTargetFolder] = useState('AI_Test_Folder');
  const [deepBudget, setDeepBudget] = useState(45);
  const [claudeCookie, setClaudeCookie] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="sso-modal-backdrop" style={{ display: 'flex' }} onClick={onClose}>
      <div className="claude-settings-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Left Sidebar */}
        <aside className="claude-settings-sidebar">
          <div className="claude-settings-search">
            <Search width={14} height={14} />
            <input type="text" placeholder="Search settings..." />
          </div>

          <div className="claude-settings-nav">
            <div className="claude-settings-group-title">SETTINGS</div>
            <button
              className={`claude-settings-nav-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
              type="button"
            >
              <Settings width={15} height={15} />
              <span>General</span>
            </button>
            <button
              className={`claude-settings-nav-item ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
              type="button"
            >
              <User width={15} height={15} />
              <span>Account</span>
            </button>
            <button
              className={`claude-settings-nav-item ${activeTab === 'vault' ? 'active' : ''}`}
              onClick={() => setActiveTab('vault')}
              type="button"
            >
              <KeyRound width={15} height={15} />
              <span>Connectors & Vault</span>
            </button>
            <button
              className={`claude-settings-nav-item ${activeTab === 'model' ? 'active' : ''}`}
              onClick={() => setActiveTab('model')}
              type="button"
            >
              <Cpu width={15} height={15} />
              <span>Model & Reasoning</span>
            </button>
            <button
              className={`claude-settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
              type="button"
            >
              <Palette width={15} height={15} />
              <span>Appearance</span>
            </button>
          </div>
        </aside>

        {/* Right Main Content Pane */}
        <main className="claude-settings-main">
          <div className="claude-settings-header">
            <h3>
              {activeTab === 'general' && 'General Workspace Settings'}
              {activeTab === 'account' && 'Account & Subscription'}
              {activeTab === 'vault' && 'Zero-Leak Credential Vault (BYOC)'}
              {activeTab === 'model' && 'Sovereign LLM & Deep Reasoning Engine'}
              {activeTab === 'appearance' && 'Appearance & Theme'}
            </h3>
            <button className="icon-button" onClick={onClose} type="button">✕</button>
          </div>

          <div className="claude-settings-body">
            {activeTab === 'general' && (
              <div className="settings-section-block">
                <div className="form-group">
                  <label className="form-label">DEFAULT FABRIC WORKSPACE ID / NAME</label>
                  <input
                    type="text"
                    className="form-input"
                    value={workspaceId}
                    onChange={(e) => setWorkspaceId(e.target.value)}
                  />
                  <span className="field-hint">All pipelines and lakehouses will deploy into this workspace.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">DEFAULT FOLDER CONTAINMENT</label>
                  <input
                    type="text"
                    className="form-input"
                    value={targetFolder}
                    onChange={(e) => setTargetFolder(e.target.value)}
                  />
                  <span className="field-hint">Guarantees all AI-generated assets are sandboxed inside this subfolder.</span>
                </div>

                <div className="form-group-checkbox">
                  <input type="checkbox" id="checkAutoSnapshot" defaultChecked />
                  <label htmlFor="checkAutoSnapshot">
                    <strong>Automated Pre-Flight Snapshot Backups</strong>
                    <p>Always serialize complete Base64 item definitions to <code>_deleted_archive/</code> before any destructive modifications.</p>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="settings-section-block">
                <div className="account-profile-card">
                  <div className="profile-avatar-large">{userName[0]}</div>
                  <div className="profile-details">
                    <h4>{userName}</h4>
                    <p>{userEmail}</p>
                    <span className="badge-pro-inline">Enterprise PRO Seat</span>
                  </div>
                </div>

                <div className="auth-sync-status-box">
                  <ShieldCheck width={18} height={18} className="text-emerald-400" />
                  <div>
                    <strong>Microsoft Fabric Azure CLI OAuth Active</strong>
                    <p>Auto-refresh active. Re-acquires tokens 120s before expiration.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'vault' && (
              <div className="settings-section-block">
                <div className="form-group">
                  <label className="form-label">CLAUDE AI SESSION SYNC (ZERO-COPY BOOKMARKLET)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="sessionKey=sk-ant-sid01-..."
                    value={claudeCookie}
                    onChange={(e) => setClaudeCookie(e.target.value)}
                  />
                  <span className="field-hint">
                    Syncs personal/team Claude subscription without copy-pasting API keys.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">AZURE KEY VAULT URI (OPTIONAL)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://my-fabric-vault.vault.azure.net/"
                  />
                </div>
              </div>
            )}

            {activeTab === 'model' && (
              <div className="settings-section-block">
                <div className="form-group">
                  <label className="form-label">PRIMARY SOVEREIGN REASONING ENGINE</label>
                  <select className="form-select" defaultValue="claude-cli">
                    <option value="claude-cli">Headless Claude Code CLI (`claude -p` — Sonnet 3.7)</option>
                    <option value="gemini-flash">Google Gemini 2.5 Flash / Pro (High-Speed)</option>
                    <option value="groq-120b">Groq openai/gpt-oss-120b (MoE Open Weights)</option>
                  </select>
                </div>

                <div className="form-group">
                  <div className="slider-header-row">
                    <label className="form-label">DEEP RECONCILIATION BUDGET: {deepBudget}s</label>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="90"
                    value={deepBudget}
                    onChange={(e) => setDeepBudget(Number(e.target.value))}
                    className="form-range"
                  />
                  <span className="field-hint">
                    Allocates deep reasoning time for foreign-key solvers, AST validation, and SCD-1/2 triage before generating PySpark code.
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="settings-section-block">
                <div className="theme-picker-row">
                  <button className="theme-box active">
                    <span className="theme-name">Dark Titanium</span>
                    <span className="theme-preview bg-slate-900" />
                  </button>
                  <button className="theme-box">
                    <span className="theme-name">Midnight Azure</span>
                    <span className="theme-preview bg-blue-950" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="claude-settings-footer">
            <button className="btn-secondary" onClick={onClose} type="button">Cancel</button>
            <button className="btn-primary" onClick={handleSave} type="button">
              {isSaved ? <Check width={14} height={14} /> : null}
              <span>{isSaved ? 'Saved Settings' : 'Save Changes'}</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
