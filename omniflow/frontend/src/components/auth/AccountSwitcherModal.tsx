import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Globe, KeyRound, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { FabricAccountProfile } from '../../types';
import {
  fetchFabricAccounts,
  switchFabricAccount,
  triggerBrowserLogin,
  startDeviceCodeLogin,
  pollDeviceCodeLogin,
} from '../../services/api';
import { DeviceCodeBanner } from './DeviceCodeBanner';
import { AccountItemRow } from './AccountItemRow';

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
  const [tenantInput, setTenantInput] = useState('');
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
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
        setStatusMsg({ text: `Switched active session to ${account.name}`, type: 'success' });
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
      setStatusMsg({ text: 'Launching Microsoft browser sign-in...', type: 'info' });
      const res = await triggerBrowserLogin(tenantInput.trim() || undefined);
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

  return createPortal(
    <div
      className="fixed inset-0 z-[100050] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[490px] bg-[#121214] border border-white/10 rounded-[18px] p-6 shadow-2xl relative z-[100051] flex flex-col gap-5 text-sans select-none"
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
            className="p-1 rounded-lg text-[#71717a] hover:text-[#f4f4f5] hover:bg-white/5 transition-colors cursor-pointer"
            title="Close dialog (Esc)"
          >
            <X size={17} />
          </button>
        </div>

        {/* Feedback Message */}
        {statusMsg && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-all ${
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
          <DeviceCodeBanner
            userCode={userCode}
            verificationUri={verificationUri}
          />
        )}

        {/* Authenticated Accounts List */}
        <div>
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-[10.5px] font-semibold text-[#71717a] tracking-wider uppercase">
              Authenticated Accounts ({accounts.length})
            </span>
            <button
              type="button"
              onClick={loadAccounts}
              disabled={isLoading}
              className="text-[#71717a] hover:text-[#f4f4f5] p-1 rounded transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh account sessions"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[230px] overflow-y-auto pr-0.5">
            {accounts.length === 0 ? (
              <div className="p-4 text-[12px] text-[#71717a] text-center border border-dashed border-white/10 rounded-xl">
                No Fabric accounts saved. Sign in below to connect.
              </div>
            ) : (
              accounts.map((acc) => (
                <AccountItemRow
                  key={acc.id}
                  account={acc}
                  isSwitching={switchingId === acc.id}
                  onSwitch={handleSwitch}
                />
              ))
            )}
          </div>
        </div>

        {/* Connect New Account Section */}
        <div className="pt-3.5 border-t border-white/[0.08] flex flex-col gap-2.5">
          <div>
            <label className="block text-[10.5px] font-semibold text-[#71717a] tracking-wider uppercase mb-1 px-0.5">
              Organization Domain or Tenant ID (Optional)
            </label>
            <input
              type="text"
              value={tenantInput}
              onChange={(e) => setTenantInput(e.target.value)}
              placeholder="e.g. yourcompany.com or tenant ID (prevents SSO default)"
              className="w-full bg-[#161619] border border-white/10 focus:border-white/20 rounded-xl px-3 py-1.5 text-[12px] text-[#f4f4f5] placeholder-[#52525b] outline-none transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isLoading || isPollingDeviceCode}
              onClick={handleBrowserLogin}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-[12.5px] font-medium bg-[#1e1e22] hover:bg-[#27272c] text-[#f4f4f5] border border-white/10 hover:border-white/20 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <Globe size={14} className="text-[#a1a1aa]" />
              <span>Browser Sign-in</span>
            </button>
            <button
              type="button"
              disabled={isLoading || isPollingDeviceCode}
              onClick={handleStartDeviceCode}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-[12.5px] font-medium bg-[#18181b] hover:bg-[#202024] text-[#d4d4d8] border border-white/10 hover:border-white/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <KeyRound size={14} className="text-[#a1a1aa]" />
              <span>Device Code Sign-in</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
