import React from 'react';
import { Globe, KeyRound } from 'lucide-react';

interface AccountConnectSectionProps {
  isLoading: boolean;
  isPollingDeviceCode: boolean;
  onBrowserLogin: () => void;
  onDeviceCodeLogin: () => void;
}

export const AccountConnectSection: React.FC<AccountConnectSectionProps> = ({
  isLoading,
  isPollingDeviceCode,
  onBrowserLogin,
  onDeviceCodeLogin,
}) => {
  return (
    <div className="pt-3 border-t border-white/[0.08]">
      <div className="text-[11px] font-medium text-zinc-400 tracking-wide mb-2.5 px-0.5">
        Connect New Account
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={isLoading || isPollingDeviceCode}
          onClick={onBrowserLogin}
          className="group relative flex flex-col items-start gap-1.5 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-blue-500/40 transition-all cursor-pointer disabled:opacity-50 text-left hover:shadow-lg hover:shadow-blue-500/5 active:scale-[0.99]"
        >
          <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white transition-colors">
            <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <Globe size={13} />
            </div>
            <span>Browser Sign-in</span>
          </div>
          <p className="text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors leading-tight pl-0.5">
            Interactive web login in default browser
          </p>
        </button>

        <button
          type="button"
          disabled={isLoading || isPollingDeviceCode}
          onClick={onDeviceCodeLogin}
          className="group relative flex flex-col items-start gap-1.5 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-amber-500/40 transition-all cursor-pointer disabled:opacity-50 text-left hover:shadow-lg hover:shadow-amber-500/5 active:scale-[0.99]"
        >
          <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white transition-colors">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <KeyRound size={13} />
            </div>
            <span>Device Code</span>
          </div>
          <p className="text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors leading-tight pl-0.5">
            Sign in via code on microsoft.com
          </p>
        </button>
      </div>
    </div>
  );
};
