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

  return (
    <div
      className={`flex items-center justify-between p-3.5 rounded-xl transition-all ${
        isActive
          ? 'bg-[#202024] border border-white/20 shadow-sm'
          : 'bg-[#18181b] border border-white/[0.08] hover:border-white/15 hover:bg-[#1c1c20]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Sleek Neutral Slate Avatar */}
        <div className="w-9 h-9 rounded-full bg-[#27272a] border border-white/10 text-[#f4f4f5] font-semibold text-[13px] flex items-center justify-center flex-shrink-0">
          {initial}
        </div>

        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-medium text-[#f4f4f5] truncate">
              {account.name}
            </span>
            <span className="text-[10.5px] font-medium px-2 py-0.5 rounded bg-white/[0.06] text-[#a1a1aa] border border-white/[0.06] whitespace-nowrap">
              {account.account_type || 'Azure CLI'}
            </span>
          </div>

          <div className="text-[12px] text-[#8e918f] truncate">
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11.5px] font-medium border border-emerald-500/20">
            <Check size={12} strokeWidth={2.5} />
            <span>Active</span>
          </span>
        ) : (
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => onSwitch(account)}
            className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-[#27272a] hover:bg-[#34343a] text-[#f4f4f5] border border-white/10 hover:border-white/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
