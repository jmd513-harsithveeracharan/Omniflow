import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { startDeviceCodeLogin, pollDeviceCodeLogin } from '../../../services/api';

export const BrowserLoginTab: React.FC = () => {
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string>('https://login.microsoft.com/device');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!deviceCode) return;
    const interval = setInterval(async () => {
      try {
        const res = await pollDeviceCodeLogin(deviceCode);
        if (res.status === 'authenticated') {
          setDeviceCode(null);
          setUserCode(null);
          setAuthStatus({ type: 'success', text: `Connected: ${res.user_identity || 'Authenticated'}` });
          window.dispatchEvent(new CustomEvent('fabric-account-switched'));
        } else if (res.status === 'declined' || res.status === 'expired' || res.status === 'error') {
          setDeviceCode(null);
          setUserCode(null);
          setAuthStatus({ type: 'error', text: res.error || 'Device authentication stopped.' });
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [deviceCode]);

  const handleLaunchBrowserLogin = async () => {
    setIsLoggingIn(true);
    setAuthStatus(null);
    try {
      const res = await startDeviceCodeLogin();
      if (res.success && res.device_code && res.user_code) {
        setDeviceCode(res.device_code);
        setUserCode(res.user_code);
        setVerificationUri(res.verification_uri || 'https://login.microsoft.com/device');
      } else {
        setAuthStatus({ type: 'error', text: res.error || 'Failed to start device code sign-in.' });
      }
    } catch (e) {
      setAuthStatus({ type: 'error', text: e instanceof Error ? e.message : 'Failed to start device code login' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCopyCode = () => {
    if (userCode) {
      navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!userCode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {authStatus && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            background: authStatus.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: authStatus.type === 'success' ? '#6ee7b7' : '#fca5a5',
            border: `1px solid ${authStatus.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {authStatus.type === 'success' ? <CheckCircle2 width={14} height={14} /> : <AlertCircle width={14} height={14} />}
            <span>{authStatus.text}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Device Code Sign-in</div>
            <div style={{ fontSize: '11.5px', color: '#71717a' }}>Generates a Microsoft code and authenticates into Azure CLI</div>
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
            <span>{isLoggingIn ? 'Starting...' : 'Start Device Code'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(0,120,212,0.08)', border: '1px solid rgba(0,120,212,0.2)', borderRadius: '8px', padding: '14px' }}>
      <div style={{ fontSize: '12px', color: '#93c5fd', marginBottom: '8px' }}>
        1. Go to <a href={verificationUri} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>{verificationUri} ↗</a> and enter code:
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
        <div style={{ background: '#000', padding: '8px 14px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: '#38bdf8', letterSpacing: '2px' }}>
          {userCode}
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
          href={verificationUri}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#0078d4', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}
        >
          <span>Open Page ↗</span>
        </a>
      </div>
      <div style={{ fontSize: '11px', color: '#71717a', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Loader2 width={11} height={11} className="animate-spin" />
        <span>Waiting for Microsoft sign-in approval...</span>
      </div>
    </div>
  );
};

