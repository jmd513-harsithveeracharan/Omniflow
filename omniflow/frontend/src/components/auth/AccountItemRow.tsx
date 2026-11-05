import React from 'react';
import { Check, Loader2, Building2 } from 'lucide-react';
import { FabricAccountProfile } from '../../types';

interface AccountItemRowProps {
  account: FabricAccountProfile;
  isSwitching: boolean;
  onSwitch: (account: FabricAccountProfile) => void;
}

export const AccountItemRow: React.FC<AccountItemRowProps> = ({
  account,
  isSwitching,
  onSwitch,
}) => {
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
      className={`group relative flex items-center justify-between p-3.5 rounded-xl transition-all ${
        isActive
          ? 'bg-[#18181c] border border-white/20 shadow-md ring-1 ring-white/10'
          : 'bg-[#141416] border border-white/[0.07] hover:border-white/15 hover:bg-[#19191d]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Sleek Rounded-xl Slate Avatar */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-[13px] flex-shrink-0 transition-colors ${
            isActive
              ? 'bg-[#27272e] text-white border border-white/20 shadow-inner'
              : 'bg-[#1f1f23] text-[#d4d4d8] border border-white/10'
          }`}
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-[#f4f4f5] tracking-tight truncate">
              {account.name}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-[#a1a1aa] border border-white/[0.06] whitespace-nowrap">
              {typeLabel}
            </span>
          </div>

          <div className="text-[12px] text-[#8e918f] truncate font-normal">
            {account.email}
          </div>

          {account.tenant_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#71717a] truncate mt-0.5">
              <Building2 size={11} className="flex-shrink-0 text-[#8e918f]" />
              <span className="truncate">{account.tenant_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action / State */}
      <div className="flex-shrink-0 ml-3">
        {isActive ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20 shadow-sm">
            <Check size={11} strokeWidth={2.5} />
            <span>Active</span>
          </span>
        ) : (
          <button
            type="button"
            disabled={isSwitching}
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
      </div>
    </div>
  );
};
