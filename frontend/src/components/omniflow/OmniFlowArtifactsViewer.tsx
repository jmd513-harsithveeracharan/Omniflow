import React, { useState } from 'react';
import { FileCode, Copy, Check, Layers } from 'lucide-react';
import { OmniFlowArtifact } from '../../types';

interface Props {
  artifacts: OmniFlowArtifact[];
}

export const OmniFlowArtifactsViewer: React.FC<Props> = ({ artifacts }) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-500 bg-[#18181b] border border-[#27272a] rounded-xl">
        <FileCode className="w-10 h-10 mb-2 stroke-[1.5] text-zinc-600" />
        <p className="text-sm font-medium">No generated artifacts loaded</p>
        <p className="text-xs text-zinc-600 mt-1">Execute an orchestration run to inspect PySpark, SQL, and Fabric manifests.</p>
      </div>
    );
  }

  const active = artifacts[selectedIdx] || artifacts[0];
  const content =
    active.content_str ||
    (active.definition ? JSON.stringify(active.definition, null, 2) : '// No content');

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLanguage = (fname: string): string => {
    if (fname.endsWith('.py')) return 'Python / PySpark';
    if (fname.endsWith('.sql')) return 'T-SQL DDL';
    if (fname.endsWith('.json') || fname.endsWith('.bim')) return 'JSON Definition';
    return 'Text';
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#202023] border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-xs text-zinc-200">Generated Medallion Artifacts</span>
          <span className="text-[11px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
            {artifacts.length} items
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy Code'}</span>
        </button>
      </div>

      <div className="flex border-b border-[#27272a] bg-[#1a1a1d] overflow-x-auto scrollbar-thin">
        {artifacts.map((art, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedIdx(idx)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-mono border-r border-[#27272a] transition-colors whitespace-nowrap ${
              idx === selectedIdx
                ? 'bg-[#18181b] text-emerald-400 border-b-2 border-b-emerald-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{art.artifact_name}</span>
          </button>
        ))}
      </div>

      <div className="px-4 py-2 bg-[#1b1b1e] border-b border-[#27272a] flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Type:</span>
          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[11px] font-mono border border-emerald-500/20">
            {active.artifact_type || 'ARTIFACT'}
          </span>
          <span className="text-zinc-500 ml-2">Format:</span>
          <span className="text-zinc-300 font-mono">{getLanguage(active.artifact_name)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-[#121214] font-mono text-xs text-zinc-200">
        <pre className="whitespace-pre overflow-x-auto leading-relaxed">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
};
