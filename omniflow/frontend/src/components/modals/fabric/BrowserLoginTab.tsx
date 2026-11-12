import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { startDeviceCodeLogin } from '../../../services/api';

export const BrowserLoginTab: React.FC = () => {
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLaunchBrowserLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await startDeviceCodeLogin();
      if (res && res.user_code) {
        setDeviceCode(res.user_code);
      }
    } catch (e) {
      console.error('Failed to start device code login', e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCopyCode = () => {
    if (deviceCode) {
      navigator.clipboard.writeText(deviceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!deviceCode) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Interactive Browser Auth</div>
          <div style={{ fontSize: '11.5px', color: '#71717a' }}>Opens Microsoft sign-in to capture Fabric session token</div>
        </div>
        <button
          type="button"
          onClick={handleLaunchBrowserLogin}
          disabled={isLoggingIn}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#0078d4',
            border: 'none',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isLoggingIn ? <Loader2 width={13} height={13} className="animate-spin" /> : <ExternalLink width={13} height={13} />}
          <span>Launch Browser Login</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(0,120,212,0.08)', border: '1px solid rgba(0,120,212,0.2)', borderRadius: '8px', padding: '14px' }}>
      <div style={{ fontSize: '12px', color: '#93c5fd', marginBottom: '8px' }}>
        1. Go to <a href="https://login.microsoft.com/device" target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>microsoft.com/device ↗</a> and enter code:
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
        <div style={{ background: '#000', padding: '8px 14px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: '#38bdf8', letterSpacing: '2px' }}>
          {deviceCode}
        </div>
        <button
          type="button"
          onClick={handleCopyCode}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
        >
          {copied ? <Check width={13} height={13} style={{ color: '#10b981' }} /> : <Copy width={13} height={13} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
        <a
          href="https://login.microsoft.com/device"
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#0078d4', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}
        >
          <span>Open Page ↗</span>
        </a>
      </div>
      <div style={{ fontSize: '11px', color: '#71717a', marginTop: '6px' }}>
        Waiting for Microsoft sign-in approval...
      </div>
    </div>
  );
};

