import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { FabricAccountProfile } from '../../types';
import {
  fetchFabricAccounts,
  switchFabricAccount,
  removeFabricAccount,
  triggerBrowserLogin,
  startDeviceCodeLogin,
  pollDeviceCodeLogin,
} from '../../services/api';
import { DeviceCodeBanner } from './DeviceCodeBanner';
import { AccountItemRow } from './AccountItemRow';
import { AccountSkeletonList } from './AccountSkeletonList';
import { AccountConnectSection } from './AccountConnectSection';

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountSwitched: () => void;
}

let _cachedFabricAccounts: FabricAccountProfile[] = [];

export const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({
  isOpen,
  onClose,
  onAccountSwitched,
}) => {
  const [accounts, setAccounts] = useState<FabricAccountProfile[]>(_cachedFabricAccounts);
  const [isLoading, setIsLoading] = useState(_cachedFabricAccounts.length === 0);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [tenantInput, setTenantInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Device Code state
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string>('https://login.microsoft.com/device');
  const [isPollingDeviceCode, setIsPollingDeviceCode] = useState(false);

  const loadAccounts = async (forceRefresh = false) => {
    try {
      if (_cachedFabricAccounts.length === 0 || forceRefresh) {
        setIsLoading(true);
      }
      const list = await fetchFabricAccounts(forceRefresh);
      _cachedFabricAccounts = list;
      setAccounts(list);
    } catch (err) {
      console.warn('Failed to load accounts', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (_cachedFabricAccounts.length > 0) {
        setAccounts(_cachedFabricAccounts);
        setIsLoading(false);
      }
      loadAccounts(false);
      setStatusMsg(null);
      setDeviceCode(null);
      setUserCode(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!deviceCode || !isPollingDeviceCode) return;
    const interval = setInterval(async () => {
      try {
        const res = await pollDeviceCodeLogin(deviceCode);
        if (res.status === 'authenticated') {
          setIsPollingDeviceCode(false);
          setDeviceCode(null);
          setStatusMsg({ text: `Connected: ${res.user_identity || 'Authenticated'}`, type: 'success' });
          await loadAccounts(true);
          onAccountSwitched();
        } else if (res.status === 'declined' || res.status === 'expired' || res.status === 'error') {
          setIsPollingDeviceCode(false);
          setDeviceCode(null);
          setStatusMsg({ text: res.error || 'Authentication stopped', type: 'error' });
        }
      } catch { /* continue polling */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [deviceCode, isPollingDeviceCode]);

  if (!isOpen) return null;

  const handleSwitch = async (account: FabricAccountProfile) => {
    const prev = [...accounts];
    try {
      setSwitchingId(account.id);
      setStatusMsg({ text: `Switching active session to ${account.name}...`, type: 'info' });
      const optimistic = prev.map((a) => ({ ...a, is_active: a.id === account.id }));
      setAccounts(optimistic);
      _cachedFabricAccounts = optimistic;

      const res = await switchFabricAccount(account.id, account.tenant_id);
      if (res.success) {
        setStatusMsg({ text: `Switched active session to ${account.name}`, type: 'success' });
        onAccountSwitched();
        window.dispatchEvent(new CustomEvent('fabric-account-switched', { detail: account }));
      } else {
        setAccounts(prev);
        _cachedFabricAccounts = prev;
        setStatusMsg({ text: res.message || 'Failed to switch account', type: 'error' });
      }
    } catch (err) {
      setAccounts(prev);
      _cachedFabricAccounts = prev;
      setStatusMsg({ text: err instanceof Error ? err.message : 'Error switching account', type: 'error' });
    } finally {
      setSwitchingId(null);
    }
  };

  const handleRemoveAccount = async (account: FabricAccountProfile) => {
    const prev = [...accounts];
    try {
      setRemovingId(account.id);
      setStatusMsg({ text: `Disconnecting ${account.email}...`, type: 'info' });
      const nextAccounts = prev.filter((a) => a.id !== account.id);
      setAccounts(nextAccounts);
      _cachedFabricAccounts = nextAccounts;

      const res = await removeFabricAccount(account.id, account.email);
      if (res.success) {
        setStatusMsg({ text: `Disconnected ${account.name || account.email}`, type: 'success' });
        const updated = res.accounts || nextAccounts;
        setAccounts(updated);
        _cachedFabricAccounts = updated;
        onAccountSwitched();
        window.dispatchEvent(new CustomEvent('fabric-account-switched'));
      } else {
        setAccounts(prev);
        _cachedFabricAccounts = prev;
        setStatusMsg({ text: res.message || 'Failed to disconnect account', type: 'error' });
      }
    } catch (err) {
      setAccounts(prev);
      _cachedFabricAccounts = prev;
      setStatusMsg({ text: err instanceof Error ? err.message : 'Error disconnecting account', type: 'error' });
    } finally {
      setRemovingId(null);
    }
  };

  const handleBrowserLogin = async () => {
    try {
      setIsLoading(true);
      setStatusMsg({ text: 'Launching Microsoft browser sign-in...', type: 'info' });
      const res = await triggerBrowserLogin(tenantInput.trim() || undefined);
      setStatusMsg({ text: res.message, type: res.success ? 'success' : 'error' });
      if (res.success) {
        await loadAccounts(true);
        onAccountSwitched();
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

  return createPortal(
    <div
      className="fixed inset-0 z-[100050] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[500px] bg-gradient-to-b from-[#141417] to-[#0d0d10] border border-white/[0.12] rounded-2xl p-6 shadow-2xl relative z-[100051] flex flex-col gap-5 text-sans select-none ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-[#f4f4f5] tracking-tight">
              Fabric Accounts & Tenancy
            </h3>
            <p className="text-[12px] text-[#8e918f] mt-0.5 leading-normal">
              Switch active workspace session or connect an organization account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors cursor-pointer"
            title="Close dialog (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Feedback Message */}
        {statusMsg && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] transition-all ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : statusMsg.type === 'error'
                ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle size={14} className="flex-shrink-0" />
            )}
            <span className="truncate">{statusMsg.text}</span>
          </div>
        )}

        {/* Device Code Flow Banner */}
        {userCode && (
          <DeviceCodeBanner userCode={userCode} verificationUri={verificationUri} />
        )}

        {/* Authenticated Accounts List */}
        <div>
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-[10.5px] font-semibold text-[#71717a] tracking-wider uppercase">
              Authenticated Accounts {isLoading && accounts.length === 0 ? '(Loading...)' : `(${accounts.length})`}
            </span>
            <button
              type="button"
              onClick={() => loadAccounts(true)}
              disabled={isLoading}
              className="text-[#71717a] hover:text-[#f4f4f5] p-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh account sessions from Azure CLI"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-0.5">
            {isLoading && accounts.length === 0 ? (
              <AccountSkeletonList />
            ) : accounts.length === 0 ? (
              <div className="p-4 text-[12px] text-[#71717a] text-center border border-dashed border-white/10 rounded-xl">
                No Fabric accounts saved. Sign in below to connect.
              </div>
            ) : (
              accounts.map((acc) => (
                <AccountItemRow
                  key={acc.id}
                  account={acc}
                  isSwitching={switchingId === acc.id}
                  isRemoving={removingId === acc.id}
                  onSwitch={handleSwitch}
                  onRemove={handleRemoveAccount}
                />
              ))
            )}
          </div>
        </div>

        {/* Connect New Account Section */}
        <AccountConnectSection
          tenantInput={tenantInput}
          setTenantInput={setTenantInput}
          isLoading={isLoading}
          isPollingDeviceCode={isPollingDeviceCode}
          onBrowserLogin={handleBrowserLogin}
          onDeviceCodeLogin={handleStartDeviceCode}
        />
      </div>
    </div>,
    document.body
  );
};
