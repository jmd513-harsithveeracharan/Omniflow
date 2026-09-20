import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';

interface DeviceCodeBannerProps {
  userCode: string;
  verificationUri: string;
}

export const DeviceCodeBanner: React.FC<DeviceCodeBannerProps> = ({
  userCode,
  verificationUri,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(userCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '10px',
        padding: '14px',
        marginBottom: '18px',
      }}
    >
      <div style={{ fontSize: '12.5px', color: '#93c5fd', marginBottom: '8px' }}>
        1. Open Microsoft Device Login, and 2. Enter this code:
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: '#ffffff',
            background: '#09090b',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {userCode}
        </div>
        <button
          type="button"
          onClick={handleCopyCode}
          className="projects-modal-btn-cancel"
          style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {copiedCode ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
          {copiedCode ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a
          href={verificationUri}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: '12px',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textDecoration: 'none',
          }}
        >
          Go to {verificationUri} <ExternalLink width={11} height={11} />
        </a>
        <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Loader2 width={11} height={11} className="spin" /> Waiting for browser approval...
        </span>
      </div>
    </div>
  );
};

