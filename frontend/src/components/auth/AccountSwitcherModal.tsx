import React, { useState, useEffect } from 'react';
import { X, Check, Laptop, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { FabricAccountProfile } from '../../types';
import {
  fetchFabricAccounts,
  switchFabricAccount,
  triggerBrowserLogin,
  startDeviceCodeLogin,
  pollDeviceCodeLogin,
} from '../../services/api';
import { DeviceCodeBanner } from './DeviceCodeBanner';

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountSwitched: () => void;
}

export const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({
  isOpen,
  onClose,
  onAccountSwitched,
}) => {
  const [accounts, setAccounts] = useState<FabricAccountProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Device Code state
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string>('https://login.microsoft.com/device');
  const [isPollingDeviceCode, setIsPollingDeviceCode] = useState(false);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const list = await fetchFabricAccounts();
      setAccounts(list);
    } catch (err) {
      console.warn('Failed to load accounts', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      setStatusMsg(null);
      setDeviceCode(null);
      setUserCode(null);
    }
  }, [isOpen]);

  // Polling loop for device code
  useEffect(() => {
    if (!deviceCode || !isPollingDeviceCode) return;

    const interval = setInterval(async () => {
      try {
        const res = await pollDeviceCodeLogin(deviceCode);
        if (res.status === 'authenticated') {
          setIsPollingDeviceCode(false);
          setDeviceCode(null);
          setStatusMsg({ text: `Successfully signed in as ${res.user_identity || 'user'}!`, type: 'success' });
          await loadAccounts();
          onAccountSwitched();
        } else if (res.status === 'declined' || res.status === 'expired' || res.status === 'error') {
          setIsPollingDeviceCode(false);
          setDeviceCode(null);
          setStatusMsg({ text: res.error || 'Authentication stopped', type: 'error' });
        }
      } catch {
        // continue polling
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [deviceCode, isPollingDeviceCode]);

  if (!isOpen) return null;

  const handleSwitch = async (account: FabricAccountProfile) => {
    try {
      setSwitchingId(account.id);
      setStatusMsg(null);
      const res = await switchFabricAccount(account.id, account.tenant_id);
      if (res.success) {
        setStatusMsg({ text: `Switched to ${account.name}`, type: 'success' });
        await loadAccounts();
        onAccountSwitched();
      } else if (res.requires_login) {
        setStatusMsg({ text: `Session expired for ${account.name}. Please sign in again.`, type: 'info' });
      } else {
        setStatusMsg({ text: res.message || 'Failed to switch account', type: 'error' });
      }
    } catch (err) {
      setStatusMsg({ text: err instanceof Error ? err.message : 'Error switching account', type: 'error' });
    } finally {
      setSwitchingId(null);
    }
  };

  const handleBrowserLogin = async () => {
    try {
      setIsLoading(true);
      setStatusMsg({ text: 'Opening browser for Microsoft sign-in...', type: 'info' });
      const res = await triggerBrowserLogin();
      if (res.success) {
        setStatusMsg({ text: res.message, type: 'success' });
        await loadAccounts();
        onAccountSwitched();
      } else {
        setStatusMsg({ text: res.message, type: 'error' });
      }
    } catch (err) {
      setStatusMsg({ text: String(err), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDeviceCode = async () => {
    try {
      setIsLoading(true);
      setStatusMsg(null);
      const res = await startDeviceCodeLogin();
      if (res.success && res.device_code && res.user_code) {
        setDeviceCode(res.device_code);
        setUserCode(res.user_code);
        setVerificationUri(res.verification_uri || 'https://login.microsoft.com/device');
        setIsPollingDeviceCode(true);
      } else {
        setStatusMsg({ text: res.error || 'Failed to start device login', type: 'error' });
      }
    } catch (err) {
      setStatusMsg({ text: String(err), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop open active"
      onClick={onClose}
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="modal-content"
        style={{
          width: '540px',
          maxWidth: '95vw',
          background: '#18181b',
          borderRadius: '16px',
          padding: '24px 26px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          position: 'relative',
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#f4f4f5', margin: 0 }}>
              Switch Microsoft Fabric Account
            </h3>
            <p style={{ fontSize: '12px', color: '#a1a1aa', margin: '3px 0 0 0' }}>
              Switch between Pelican BioThermal, JMAN Group trial, or add a new tenant
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
          >
            <X width={18} height={18} />
          </button>
        </div>

        {/* Feedback Message */}
        {statusMsg && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12.5px',
              marginBottom: '14px',
              background:
                statusMsg.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : statusMsg.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(59, 130, 246, 0.15)',
              border:
                statusMsg.type === 'success'
                  ? '1px solid #10b981'
                  : statusMsg.type === 'error'
                  ? '1px solid #ef4444'
                  : '1px solid #3b82f6',
              color: statusMsg.type === 'success' ? '#34d399' : statusMsg.type === 'error' ? '#fca5a5' : '#93c5fd',
            }}
          >
            {statusMsg.text}
          </div>
        )}

        {/* Device Code Flow Banner */}
        {userCode && (
          <DeviceCodeBanner
            userCode={userCode}
            verificationUri={verificationUri}
          />
        )}

        {/* Account List */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa', letterSpacing: '0.04em' }}>
              SAVED FABRIC ACCOUNTS
            </label>
            <button
              type="button"
              onClick={loadAccounts}
              style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
              title="Refresh accounts"
            >
              <RefreshCw width={12} height={12} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {accounts.map((acc) => {
              const isSwitching = switchingId === acc.id;
              return (
                <div
                  key={acc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: acc.is_active ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: acc.is_active ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: acc.is_active ? '#10b981' : '#3f3f46',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: '12px',
                      }}
                    >
                      {acc.name[0]}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>{acc.name}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: acc.account_type.includes('Trial') ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: acc.account_type.includes('Trial') ? '#60a5fa' : '#34d399',
                          }}
                        >
                          {acc.account_type}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#71717a' }}>{acc.email}</div>
                    </div>
                  </div>

                  {acc.is_active ? (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check width={13} height={13} /> Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isSwitching}
                      onClick={() => handleSwitch(acc)}
                      className="projects-modal-btn-cancel"
                      style={{ padding: '5px 12px', fontSize: '12px' }}
                    >
                      {isSwitching ? <Loader2 width={12} height={12} className="spin" /> : 'Switch'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sign In to Another Account */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#a1a1aa', marginBottom: '8px', letterSpacing: '0.04em' }}>
            SIGN IN TO ANOTHER FABRIC ACCOUNT
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              disabled={isLoading || isPollingDeviceCode}
              onClick={handleBrowserLogin}
              className="projects-btn-new-primary"
              style={{ flex: 1, padding: '9px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Laptop width={14} height={14} />
              <span>Browser Sign-in</span>
            </button>
            <button
              type="button"
              disabled={isLoading || isPollingDeviceCode}
              onClick={handleStartDeviceCode}
              className="projects-modal-btn-cancel"
              style={{ flex: 1, padding: '9px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <KeyRound width={14} height={14} />
              <span>Device Code Sign-in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
