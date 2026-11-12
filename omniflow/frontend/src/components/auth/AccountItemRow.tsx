import React, { useState } from 'react';
import { Check, Loader2, Building2, LogOut } from 'lucide-react';
import { FabricAccountProfile } from '../../types';

interface AccountItemRowProps {
  account: FabricAccountProfile;
  isSwitching: boolean;
  isRemoving?: boolean;
  onSwitch: (account: FabricAccountProfile) => void;
  onRemove?: (account: FabricAccountProfile) => void;
}

export const AccountItemRow: React.FC<AccountItemRowProps> = ({
  account,
  isSwitching,
  isRemoving = false,
  onSwitch,
  onRemove,
}) => {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const initial = (account.name || account.email || 'U')[0].toUpperCase();
  const isActive = Boolean(account.is_active);

  let typeLabel = account.account_type || 'Azure CLI';
  if (typeLabel.toLowerCase().includes('pelican')) {
    typeLabel = 'Pelican Enterprise';
  } else if (typeLabel.toLowerCase().includes('student')) {
    typeLabel = 'Azure for Students';
  } else if (typeLabel.includes(':')) {
    typeLabel = typeLabel.split(':')[0].trim();
  }

  return (
    <div
      className={`group relative flex items-center justify-between p-3.5 rounded-xl transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-r from-emerald-500/[0.08] via-[#16171a] to-[#141518] border border-emerald-500/30 ring-1 ring-emerald-500/15 shadow-lg shadow-black/40'
          : 'bg-[#131316] border border-white/[0.07] hover:border-white/15 hover:bg-[#18181d]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Sleek Slate / Emerald Avatar */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[13px] flex-shrink-0 transition-colors ${
            isActive
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-inner'
              : 'bg-[#1d1d22] text-[#d4d4d8] border border-white/10 group-hover:text-white group-hover:border-white/20'
          }`}
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-[#f4f4f5] tracking-tight truncate" title={account.name}>
              {account.name}
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                  : 'bg-white/[0.06] text-[#a1a1aa] border border-white/[0.06]'
              }`}
            >
              {typeLabel}
            </span>
          </div>

          <div className="text-[11.5px] text-[#8e918f] truncate font-normal" title={account.email}>
            {account.email}
          </div>

          {account.tenant_name && (
            <div className="flex items-center gap-1.5 text-[10.5px] text-[#71717a] truncate mt-0.5">
              <Building2 size={11} className="flex-shrink-0 text-[#8e918f]" />
              <span className="truncate">{account.tenant_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Controls & Disconnect */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {confirmingRemove ? (
          <div className="flex items-center gap-1.5 bg-rose-950/70 border border-rose-500/30 rounded-lg px-2 py-1 text-[11px] animate-fadeIn">
            <span className="text-rose-300 font-medium">Disconnect?</span>
            <button
              type="button"
              disabled={isRemoving}
              onClick={() => {
                setConfirmingRemove(false);
                onRemove?.(account);
              }}
              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium cursor-pointer transition-all disabled:opacity-50"
            >
              {isRemoving ? <Loader2 size={11} className="animate-spin inline" /> : 'Yes'}
            </button>
            <button
              type="button"
              disabled={isRemoving}
              onClick={() => setConfirmingRemove(false)}
              className="px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-200 cursor-pointer transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30 shadow-sm">
                <Check size={11} strokeWidth={2.5} />
                <span>Active</span>
              </span>
            ) : (
              <button
                type="button"
                disabled={isSwitching || isRemoving}
                onClick={() => onSwitch(account)}
                className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-[#222226] hover:bg-[#2c2c32] active:scale-95 text-[#f4f4f5] border border-white/10 hover:border-white/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                title={`Switch active session to ${account.name}`}
              >
                {isSwitching ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-white" />
                    <span>Switching...</span>
                  </>
                ) : (
                  <span>Switch</span>
                )}
              </button>
            )}

            {/* Disconnect Account Icon Button */}
            {onRemove && (
              <button
                type="button"
                disabled={isRemoving || isSwitching}
                onClick={() => setConfirmingRemove(true)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer disabled:opacity-40"
                title={`Disconnect ${account.email}`}
              >
                {isRemoving ? (
                  <Loader2 size={13} className="animate-spin text-rose-400" />
                ) : (
                  <LogOut size={13} />
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
