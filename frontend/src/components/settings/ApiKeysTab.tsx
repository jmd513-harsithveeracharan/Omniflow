import React, { useState, useEffect } from 'react';
import { Key, Check } from 'lucide-react';

export const ApiKeysTab: React.FC = () => {
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setGeminiKey(localStorage.getItem('gemini_api_key') || '');
    setGroqKey(localStorage.getItem('groq_api_key') || '');
    setAnthropicKey(localStorage.getItem('anthropic_api_key') || '');
    setOpenaiKey(localStorage.getItem('openai_api_key') || '');
  }, []);

  const handleSave = () => {
    if (geminiKey) localStorage.setItem('gemini_api_key', geminiKey);
    if (groqKey) localStorage.setItem('groq_api_key', groqKey);
    if (anthropicKey) localStorage.setItem('anthropic_api_key', anthropicKey);
    if (openaiKey) localStorage.setItem('openai_api_key', openaiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="settings-tab-pane">
      <div className="pane-header-row" style={{ marginBottom: '16px' }}>
        <h2 className="pane-title" style={{ fontSize: '18px', fontWeight: 600, color: '#f4f4f5' }}>
          API Keys & Model Providers
        </h2>
        <p style={{ fontSize: '12.5px', color: '#71717a', margin: '2px 0 0 0' }}>
          Bring Your Own Credentials (BYOC) for Gemini 2.5 Pro, Claude 3.5 Sonnet, Groq, and GPT-4o.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '6px' }}>
            Anthropic API Key (Claude Sonnet / Opus)
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder="sk-ant-api03-..."
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '13px' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '6px' }}>
            Google Gemini API Key
          </label>
          <input
            type="password"
            placeholder="AIzaSy..."
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '13px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '6px' }}>
            Groq API Key (Ultra-fast Open Weights)
          </label>
          <input
            type="password"
            placeholder="gsk_..."
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '13px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '6px' }}>
            OpenAI API Key (GPT-4o)
          </label>
          <input
            type="password"
            placeholder="sk-proj-..."
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '13px' }}
          />
        </div>

        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            onClick={handleSave}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0078d4', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            {saved ? (
              <>
                <Check width={14} height={14} style={{ color: '#10b981' }} />
                <span>Saved Successfully!</span>
              </>
            ) : (
              <>
                <Key width={14} height={14} />
                <span>Save API Keys</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
