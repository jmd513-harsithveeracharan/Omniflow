import { useState, useEffect, useCallback } from 'react';
import { FabricAccountProfile } from '../../types';
import {
  fetchFabricAccounts,
  getCachedFabricAccounts,
  setCachedFabricAccounts,
  switchFabricAccount,
  removeFabricAccount,
  triggerBrowserLogin,
  cancelBrowserLogin,
  startDeviceCodeLogin,
  pollDeviceCodeLogin,
} from '../../services/api';

export interface StatusBannerMessage {
  text: string;
  type: 'success' | 'error' | 'info';
}

export function useAccountSwitcher(
  isOpen: boolean,
  onClose: () => void,
  onAccountSwitched: () => void
) {
  const [accounts, setAccounts] = useState<FabricAccountProfile[]>(() => getCachedFabricAccounts());
  const [isLoading, setIsLoading] = useState(() => getCachedFabricAccounts().length === 0);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [tenantInput, setTenantInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<StatusBannerMessage | null>(null);

  const [isBrowserLoggingIn, setIsBrowserLoggingIn] = useState(false);
  const [isStartingDeviceCode, setIsStartingDeviceCode] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string>('https://login.microsoft.com/device');
  const [isPollingDeviceCode, setIsPollingDeviceCode] = useState(false);

  const loadAccounts = useCallback(async (forceRefresh = false) => {
    const cached = getCachedFabricAccounts();
    try {
      if (cached.length === 0 || forceRefresh) {
        setIsLoading(true);
      }
      const list = await fetchFabricAccounts(forceRefresh);
      setCachedFabricAccounts(list);
      setAccounts(list);
    } catch (err) {
      console.warn('Failed to load accounts', err);
      setStatusMsg({
        text: err instanceof Error ? err.message : 'Unable to load Azure CLI accounts. Try Refresh or Sign-in below.',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const cached = getCachedFabricAccounts();
      if (cached.length > 0) {
        setAccounts(cached);
        setIsLoading(false);
      }
      loadAccounts(false);
      setStatusMsg(null);
      setDeviceCode(null);
      setUserCode(null);
      setIsPollingDeviceCode(false);
    }
  }, [isOpen, loadAccounts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
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
          setUserCode(null);
          setStatusMsg({ text: `Connected: ${res.user_identity || 'Authenticated'}`, type: 'success' });
          await loadAccounts(true);
          onAccountSwitched();
          window.dispatchEvent(new CustomEvent('fabric-account-switched'));
        } else if (res.status === 'declined' || res.status === 'expired' || res.status === 'error') {
          setIsPollingDeviceCode(false);
          setDeviceCode(null);
          setUserCode(null);
          setStatusMsg({ text: res.error || 'Authentication stopped', type: 'error' });
        }
      } catch {
        /* continue polling */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [deviceCode, isPollingDeviceCode, loadAccounts, onAccountSwitched]);

  const handleSwitch = async (account: FabricAccountProfile) => {
    const prev = [...accounts];
    try {
      setSwitchingId(account.id);
      setStatusMsg({ text: `Switching active session to ${account.name}...`, type: 'info' });
      const optimistic = prev.map((a) => ({ ...a, is_active: a.id === account.id }));
      setAccounts(optimistic);
      setCachedFabricAccounts(optimistic);

      const res = await switchFabricAccount(account.id, account.tenant_id);
      if (res.success) {
        setStatusMsg({ text: `Switched active session to ${account.name}`, type: 'success' });
        onAccountSwitched();
        window.dispatchEvent(new CustomEvent('fabric-account-switched', { detail: account }));
      } else {
        setAccounts(prev);
        setCachedFabricAccounts(prev);
        setStatusMsg({ text: res.message || 'Failed to switch account', type: 'error' });
      }
    } catch (err) {
      setAccounts(prev);
      setCachedFabricAccounts(prev);
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
      setCachedFabricAccounts(nextAccounts);

      const res = await removeFabricAccount(account.id, account.email);
      if (res.success) {
        setStatusMsg({ text: `Disconnected ${account.name || account.email}`, type: 'success' });
        const updated = res.accounts || nextAccounts;
        setAccounts(updated);
        setCachedFabricAccounts(updated);
        onAccountSwitched();
        window.dispatchEvent(new CustomEvent('fabric-account-switched'));
      } else {
        setAccounts(prev);
        setCachedFabricAccounts(prev);
        setStatusMsg({ text: res.message || 'Failed to disconnect account', type: 'error' });
      }
    } catch (err) {
      setAccounts(prev);
      setCachedFabricAccounts(prev);
      setStatusMsg({ text: err instanceof Error ? err.message : 'Error disconnecting account', type: 'error' });
    } finally {
      setRemovingId(null);
    }
  };

  const handleCancelBrowserLogin = async () => {
    await cancelBrowserLogin();
    setIsBrowserLoggingIn(false);
    setStatusMsg({ text: 'Browser sign-in cancelled.', type: 'info' });
  };

  const handleBrowserLogin = async () => {
    try {
      setIsPollingDeviceCode(false);
      setDeviceCode(null);
      setUserCode(null);
      setIsBrowserLoggingIn(true);
      setStatusMsg({
        text: 'Complete sign-in in the Microsoft browser window that opens...',
        type: 'info',
      });
      const res = await triggerBrowserLogin(tenantInput.trim() || undefined);
      setStatusMsg({ text: res.message, type: res.success ? 'success' : 'error' });
      if (res.success) {
        if (Array.isArray(res.accounts) && res.accounts.length > 0) {
          setCachedFabricAccounts(res.accounts);
          setAccounts(res.accounts);
        } else {
          await loadAccounts(true);
        }
        onAccountSwitched();
        window.dispatchEvent(new CustomEvent('fabric-account-switched'));
      }
    } catch (err) {
      setStatusMsg({ text: err instanceof Error ? err.message : String(err), type: 'error' });
    } finally {
      setIsBrowserLoggingIn(false);
    }
  };

  const handleStartDeviceCode = async () => {
    try {
      if (isBrowserLoggingIn) {
        await cancelBrowserLogin();
        setIsBrowserLoggingIn(false);
      }
      setIsStartingDeviceCode(true);
      setStatusMsg({ text: 'Requesting Microsoft device login code...', type: 'info' });
      const res = await startDeviceCodeLogin(tenantInput.trim() || undefined);
      if (res.success && res.device_code && res.user_code) {
        setStatusMsg(null);
        setDeviceCode(res.device_code);
        setUserCode(res.user_code);
        setVerificationUri(res.verification_uri || 'https://login.microsoft.com/device');
        setIsPollingDeviceCode(true);
      } else {
        setStatusMsg({ text: res.error || 'Failed to start device login', type: 'error' });
      }
    } catch (err) {
      setStatusMsg({ text: err instanceof Error ? err.message : String(err), type: 'error' });
    } finally {
      setIsStartingDeviceCode(false);
    }
  };

  return {
    accounts,
    isLoading,
    switchingId,
    removingId,
    tenantInput,
    setTenantInput,
    statusMsg,
    isBrowserLoggingIn,
    isStartingDeviceCode,
    userCode,
    verificationUri,
    isPollingDeviceCode,
    loadAccounts,
    handleSwitch,
    handleRemoveAccount,
    handleBrowserLogin,
    handleCancelBrowserLogin,
    handleStartDeviceCode,
  };
}
