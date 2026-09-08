import React, { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export const GeneralTab: React.FC = () => {
  const [name, setName] = useState('Harsith');
  const [callName, setCallName] = useState('Harsith');
  const [role, setRole] = useState('Data Architect / Fabric Engineer');
  const [instructions, setInstructions] = useState(
    'Keep explanations brief, architect Medallion Delta Lake patterns with idempotent PySpark code, and prioritize zero AI slop.'
  );
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [font, setFont] = useState('Anthropic Serif (Newsreader)');

  const handleThemeChange = (newTheme: 'dark' | 'light' | 'system') => {
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
    <div className="settings-tab-pane">
      <div className="pane-header-row">
        <h2 className="pane-title">Profile</h2>
      </div>

      <div className="settings-field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="settings-field-label" style={{ fontSize: '13px', color: '#a1a1aa' }}>Avatar</span>
        <div className="settings-avatar-circle" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#fff' }}>
          {name[0] || 'H'}
        </div>
      </div>

      <div className="settings-field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="settings-field-label" style={{ fontSize: '13px', color: '#a1a1aa' }}>Full name</span>
        <input
          type="text"
          className="settings-field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '220px' }}
        />
      </div>

      <div className="settings-field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="settings-field-label" style={{ fontSize: '13px', color: '#a1a1aa' }}>What should Fabric.AI call you?</span>
        <input
          type="text"
          className="settings-field-input"
          value={callName}
          onChange={(e) => setCallName(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '220px' }}
        />
      </div>

      <div className="settings-field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="settings-field-label" style={{ fontSize: '13px', color: '#a1a1aa' }}>What best describes your work?</span>
        <select
          className="settings-field-select"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '220px' }}
        >
          <option>Data Architect / Fabric Engineer</option>
          <option>Analytics Engineer</option>
          <option>Data Scientist</option>
          <option>Software Developer</option>
        </select>
      </div>

      <div className="settings-field-column" style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '6px' }}>
          <span className="settings-field-label" style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>Instructions for Fabric.AI</span>
          <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 8px 0' }}>Fabric.AI will keep these in mind across chats.</p>
        </div>
        <textarea
          className="settings-field-textarea"
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '12.5px' }}
        />
      </div>

      <h2 className="pane-title" style={{ marginTop: '28px', marginBottom: '14px', fontSize: '15px', fontWeight: 600, color: '#f4f4f5' }}>Preferences</h2>

      <div className="settings-field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="settings-field-label" style={{ fontSize: '13px', color: '#a1a1aa' }}>Appearance</span>
        <div className="theme-toggle-group" style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.06)', padding: '3px', borderRadius: '6px' }}>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'system' ? 'active' : ''}`}
            onClick={() => handleThemeChange('system')}
            style={{ padding: '4px 8px', background: theme === 'system' ? 'rgba(255,255,255,0.15)' : 'none', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Monitor width={14} height={14} />
          </button>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => handleThemeChange('light')}
            style={{ padding: '4px 8px', background: theme === 'light' ? 'rgba(255,255,255,0.15)' : 'none', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Sun width={14} height={14} />
          </button>
          <button
            type="button"
            className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => handleThemeChange('dark')}
            style={{ padding: '4px 8px', background: theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'none', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Moon width={14} height={14} />
          </button>
        </div>
      </div>

      <div className="settings-field-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
        <span className="settings-field-label" style={{ fontSize: '13px', color: '#a1a1aa' }}>Chat font</span>
        <select
          className="settings-field-select"
          value={font}
          onChange={(e) => setFont(e.target.value)}
          style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '220px' }}
        >
          <option>Anthropic Serif (Newsreader)</option>
          <option>Google Sans Text</option>
          <option>Inter (Modern Sans)</option>
        </select>
      </div>
    </div>
  );
};
