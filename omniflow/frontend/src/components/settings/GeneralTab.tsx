import React, { useState } from 'react';
import { X } from 'lucide-react';

interface GeneralTabProps {
  onClose?: () => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ onClose }) => {
  const [name, setName] = useState('Harsith');
  const [callName, setCallName] = useState('Harsith');
  const [workDesc, setWorkDesc] = useState('Data Architect / Fabric Engineer');
  const [instructions, setInstructions] = useState('');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('dark');
  const [font, setFont] = useState('Anthropic Sans');

  const handleThemeChange = (newTheme: 'system' | 'light' | 'dark') => {
    setTheme(newTheme);
    if (newTheme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    }
  };

  return (
    <div className="settings-tab-pane" id="paneGeneral">
      <div className="pane-header-row">
        <h2 className="pane-title">Profile</h2>
        <div className="pane-header-actions">
          {onClose && (
            <button type="button" className="btn-subtle-icon btn-close-modal-icon" title="Close dialog" onClick={onClose}>
              <X width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      <div className="settings-field-row">
        <span className="settings-field-label">Avatar</span>
        <div className="settings-avatar-circle" id="settingsAvatarCircle">
          {name.charAt(0).toUpperCase() || 'H'}
        </div>
      </div>

      <div className="settings-field-row">
        <span className="settings-field-label">Full name</span>
        <input
          type="text"
          className="settings-field-input"
          id="inputProfileName"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="settings-field-row">
        <span className="settings-field-label">What should Fabric.AI call you?</span>
        <input
          type="text"
          className="settings-field-input"
          id="inputProfileCallName"
          value={callName}
          onChange={(e) => setCallName(e.target.value)}
        />
      </div>

      <div className="settings-field-row">
        <span className="settings-field-label">What best describes your work?</span>
        <select
          className="settings-field-select"
          id="selectWorkDescription"
          value={workDesc}
          onChange={(e) => setWorkDesc(e.target.value)}
        >
          <option>Data Architect / Fabric Engineer</option>
          <option>Analytics Engineer</option>
          <option>Data Scientist</option>
          <option>Software Developer</option>
        </select>
      </div>

      <div className="settings-field-column" style={{ marginTop: '20px' }}>
        <div className="settings-field-header" style={{ marginBottom: '6px' }}>
          <span className="settings-field-label" style={{ display: 'block' }}>Instructions for Fabric.AI</span>
          <span className="settings-field-hint" style={{ fontSize: '11.5px', color: '#71717a' }}>
            Fabric.AI will keep these in mind across chats.
          </span>
        </div>
        <textarea
          className="settings-field-textarea"
          id="inputSystemInstructions"
          placeholder="e.g. keep explanations brief and to the point"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <h2 className="pane-title" style={{ marginTop: '32px', marginBottom: '20px' }}>Preferences</h2>

      <div className="settings-field-row">
        <span className="settings-field-label">Appearance</span>
        <div className="theme-toggle-group">
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'system' ? 'active' : ''}`}
            data-theme="system"
            title="System Theme"
            onClick={() => handleThemeChange('system')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
            data-theme="light"
            title="Light Theme"
            onClick={() => handleThemeChange('light')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          </button>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
            data-theme="dark"
            title="Dark Theme"
            onClick={() => handleThemeChange('dark')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="settings-field-row">
        <span className="settings-field-label">Chat font</span>
        <select
          className="settings-field-select"
          id="selectChatFont"
          value={font}
          onChange={(e) => setFont(e.target.value)}
        >
          <option>Anthropic Sans</option>
          <option>Anthropic Serif (Newsreader)</option>
          <option>Inter (Modern Sans)</option>
        </select>
      </div>
    </div>
  );
};

export default GeneralTab;
