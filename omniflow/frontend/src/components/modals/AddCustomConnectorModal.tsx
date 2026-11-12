import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, Loader2 } from 'lucide-react';

interface AddCustomConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectorAdded?: (connector: { name: string; category: string }) => void;
}

export const AddCustomConnectorModal: React.FC<AddCustomConnectorModalProps> = ({
  isOpen,
  onClose,
  onConnectorAdded,
}) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Database');
  const [connString, setConnString] = useState('');

  if (!isOpen) return null;

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setName('Custom_' + aiPrompt.split(' ')[0].toUpperCase());
      setCategory('SaaS API');
      setConnString(`https://api.${aiPrompt.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/v1`);
      setIsGenerating(false);
    }, 900);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onConnectorAdded?.({ name, category });
    onClose();
  };

  return createPortal(
    <div
      className="sso-modal-backdrop"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 100050,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '520px',
          maxWidth: '92vw',
          background: '#141417',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
          position: 'relative',
          zIndex: 100051,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0 }}>Add custom connector</h3>
            <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 0 0' }}>Define connection parameters or auto-generate with AI</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* AI Generation Box */}
          <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Sparkles width={14} height={14} style={{ color: '#c4b5fd' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#c4b5fd' }}>Auto-generate with AI</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. I have data in NetSuite ERP, create a connector"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '12.5px' }}
              />
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={isGenerating || !aiPrompt.trim()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#8b5cf6', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                {isGenerating ? <Loader2 width={12} height={12} className="animate-spin" /> : null}
                <span>Generate</span>
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '6px' }}>
              Connector Name
            </label>
            <input
              type="text"
              placeholder="e.g. NetSuite_Prod_DB"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '6px' }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
            >
              <option>Database</option>
              <option>Enterprise ERP</option>
              <option>SaaS API</option>
              <option>NoSQL</option>
              <option>Streaming</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: '6px' }}>
              Connection URL / Host String
            </label>
            <input
              type="text"
              placeholder="jdbc:oracle:thin:@//host:1521/service"
              value={connString}
              onChange={(e) => setConnString(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#a1a1aa', padding: '6px 14px', borderRadius: '6px', fontSize: '12.5px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            style={{ background: '#0078d4', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
          >
            Save Connector
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
