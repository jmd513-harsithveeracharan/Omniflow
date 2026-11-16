import React from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { DeviceCodeBanner } from './DeviceCodeBanner';
import { AccountItemRow } from './AccountItemRow';
import { AccountSkeletonList } from './AccountSkeletonList';
import { AccountConnectSection } from './AccountConnectSection';
import { useAccountSwitcher } from './useAccountSwitcher';

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
  const {
    accounts,
    isLoading,
    switchingId,
    removingId,
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
  } = useAccountSwitcher(isOpen, onClose, onAccountSwitched);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100050] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] max-h-[90vh] overflow-hidden bg-gradient-to-b from-[#141417] to-[#0d0d10] border border-white/[0.12] rounded-2xl shadow-2xl relative z-[100051] flex flex-col text-sans select-none ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h3 className="text-[16px] font-semibold text-[#f4f4f5] tracking-tight">
              Fabric Accounts
            </h3>
            <p className="text-[12px] text-[#8e918f] mt-0.5 leading-normal">
              Switch active workspace session or connect an account
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

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-4">
          {/* Feedback Message */}
          {statusMsg && (
            <div
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[12px] transition-all ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : statusMsg.type === 'error'
                  ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-400" />
                ) : statusMsg.type === 'info' && (isBrowserLoggingIn || isStartingDeviceCode) ? (
                  <Loader2 size={14} className="flex-shrink-0 animate-spin text-blue-300" />
                ) : (
                  <AlertCircle size={14} className="flex-shrink-0" />
                )}
                <span className="truncate">{statusMsg.text}</span>
              </div>
              {isBrowserLoggingIn && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await handleCancelBrowserLogin();
                      handleStartDeviceCode();
                    }}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-400/30 transition-colors cursor-pointer whitespace-nowrap"
                    title="If browser window did not pop up, switch to device code"
                  >
                    Use Device Code Instead
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelBrowserLogin}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Device Code Flow Banner */}
          {userCode && (
            <DeviceCodeBanner userCode={userCode} verificationUri={verificationUri} />
          )}

          {/* Connected Accounts List */}
          <div>
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[11px] font-medium text-zinc-400 tracking-wide">
                Connected Accounts {isLoading && accounts.length === 0 ? '(Loading...)' : `(${accounts.length})`}
              </span>
              <button
                type="button"
                onClick={() => loadAccounts(true)}
                disabled={isLoading}
                className="text-[#71717a] hover:text-[#f4f4f5] p-1 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh account sessions"
              >
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="-mx-6 px-6 flex flex-col gap-2 max-h-[250px] overflow-y-auto">
              {isLoading && accounts.length === 0 ? (
                <AccountSkeletonList />
              ) : accounts.length === 0 ? (
                <div className="p-4 text-[12px] text-[#71717a] text-center border border-dashed border-white/10 rounded-xl">
                  No Fabric accounts connected. Use Browser Sign-in or Device Code below.
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
            isLoading={isBrowserLoggingIn || isStartingDeviceCode}
            isPollingDeviceCode={isPollingDeviceCode}
            onBrowserLogin={handleBrowserLogin}
            onDeviceCodeLogin={handleStartDeviceCode}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
