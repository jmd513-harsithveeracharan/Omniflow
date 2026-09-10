import React, { useState, useEffect } from 'react';
import { Layers, X, Copy, Check, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { FabricStatus } from '../../types';

interface FabricConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: FabricStatus | null;
  onRefreshStatus?: () => void;
}

export const FabricConnectionModal: React.FC<FabricConnectionModalProps> = ({
  isOpen,
  onClose,
  status,
  onRefreshStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'cli' | 'sp' | 'token'>('cli');
  const [tenantId, setTenantId] = useState('94b62ba4-8d71-4507-9dc9-9734a149f836');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDeviceCode(null);
      setIsLoggingIn(false);
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLaunchBrowserLogin = () => {
    setIsLoggingIn(true);
    setDeviceCode('FABRIC-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  const handleCopyCode = () => {
    if (deviceCode) {
      navigator.clipboard.writeText(deviceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="sso-modal-backdrop"
      style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 1100, alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className="connections-modal-card"
        style={{ width: '560px', background: '#121215', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(0, 210, 160, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers width={20} height={20} style={{ color: '#00d2a0' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0 }}>Microsoft Fabric Connection</h3>
              <p style={{ fontSize: '11.5px', color: '#71717a', margin: '2px 0 0 0' }}>Manage Azure authentication and active workspace</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Active Status Strip */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: status?.authenticated ? '#10b981' : '#ef4444' }} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>
                  {status?.authenticated ? 'Authenticated User' : 'Not Connected'}
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8' }}>
                  Azure CLI
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>
                Workspace: {status?.workspaceId || 'PBT_DATA_AGENT'}
              </div>
            </div>
            {onRefreshStatus && (
              <button
                type="button"
                onClick={onRefreshStatus}
                title="Refresh token status"
                style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px' }}
              >
                <RefreshCw width={12} height={12} /> Sync
              </button>
            )}
          </div>

          {/* Connection Methods Navigation */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px', marginBottom: '16px' }}>
            {[
              { id: 'cli', label: 'Browser Login (fab)' },
              { id: 'sp', label: 'Service Principal' },
              { id: 'token', label: 'Bearer Token' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as 'cli' | 'sp' | 'token')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.12)' : 'none',
                  color: activeTab === tab.id ? '#fff' : '#a1a1aa',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Method Content */}
          {activeTab === 'cli' && (
            <div>
              {!deviceCode ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Interactive Browser Auth</div>
                    <div style={{ fontSize: '11.5px', color: '#71717a' }}>Opens Microsoft sign-in to capture Fabric session token</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLaunchBrowserLogin}
                    disabled={isLoggingIn}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0078d4', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {isLoggingIn ? <Loader2 width={13} height={13} className="animate-spin" /> : <ExternalLink width={13} height={13} />}
                    <span>Launch Browser Login</span>
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          )}

          {activeTab === 'sp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="Tenant ID (e.g. 94b62ba4-...)"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
              />
              <input
                type="text"
                placeholder="Client / Application ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
              />
              <input
                type="password"
                placeholder="Client Secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
              />
              <button
                type="button"
                style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}
              >
                Save & Connect
              </button>
            </div>
          )}

          {activeTab === 'token' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                placeholder="Paste Bearer Token (JWT)..."
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '12.5px' }}
              />
              <button
                type="button"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
