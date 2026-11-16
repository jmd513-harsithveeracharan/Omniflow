import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';

interface DeviceCodeBannerProps {
  userCode: string;
  verificationUri: string;
}

export const DeviceCodeBanner: React.FC<DeviceCodeBannerProps> = ({
  userCode,
  verificationUri,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(userCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-blue-500/[0.08] border border-blue-500/25 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
      <div className="text-[12px] text-blue-300 font-medium flex items-center justify-between">
        <span>Enter code to authenticate:</span>
        <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin text-blue-400" />
          Waiting for approval...
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="font-mono text-[16px] font-bold tracking-widest text-white bg-black/60 px-3 py-1.5 rounded-lg border border-white/15 select-all">
          {userCode}
        </div>
        <button
          type="button"
          onClick={handleCopyCode}
          className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:border-white/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
        </button>
      </div>

      <div className="pt-0.5 flex items-center justify-between text-[11.5px]">
        <a
          href={verificationUri}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 hover:underline transition-colors"
        >
          <span>Open {verificationUri}</span>
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
};
