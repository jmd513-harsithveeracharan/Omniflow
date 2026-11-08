import React from 'react';
import { Globe, KeyRound } from 'lucide-react';

interface AccountConnectSectionProps {
  tenantInput: string;
  setTenantInput: (val: string) => void;
  isLoading: boolean;
  isPollingDeviceCode: boolean;
  onBrowserLogin: () => void;
  onDeviceCodeLogin: () => void;
}

export const AccountConnectSection: React.FC<AccountConnectSectionProps> = ({
  tenantInput,
  setTenantInput,
  isLoading,
  isPollingDeviceCode,
  onBrowserLogin,
  onDeviceCodeLogin,
}) => {
  return (
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
          className="w-full bg-[#151518] border border-white/10 focus:border-white/25 rounded-xl px-3 py-2 text-[12px] text-[#f4f4f5] placeholder-zinc-500 outline-none transition-colors"
        />
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          disabled={isLoading || isPollingDeviceCode}
          onClick={onBrowserLogin}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl text-[12.5px] font-medium bg-[#1e1e24] hover:bg-[#282830] text-[#f4f4f5] border border-white/10 hover:border-white/20 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
        >
          <Globe size={14} className="text-[#a1a1aa]" />
          <span>Browser Sign-in</span>
        </button>
        <button
          type="button"
          disabled={isLoading || isPollingDeviceCode}
          onClick={onDeviceCodeLogin}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl text-[12.5px] font-medium bg-[#161619] hover:bg-[#1f1f24] text-[#d4d4d8] border border-white/10 hover:border-white/20 transition-all cursor-pointer disabled:opacity-50"
        >
          <KeyRound size={14} className="text-[#a1a1aa]" />
          <span>Device Code Sign-in</span>
        </button>
      </div>
    </div>
  );
};

