import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, Search } from 'lucide-react';

interface IntakeRawJsonTabProps {
  content: string;
  filename: string;
}

export const IntakeRawJsonTab: React.FC<IntakeRawJsonTabProps> = ({ content, filename }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const formattedJson = useMemo(() => {
    if (!content) return '{}';
    try {
      const obj = JSON.parse(content);
      return JSON.stringify(obj, null, 2);
    } catch {
      return content;
    }
  }, [content]);

  const lines = useMemo(() => formattedJson.split('\n'), [formattedJson]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([formattedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'project_intake.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full space-y-2 text-xs">
      {/* Search & Actions Bar */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 flex-1 max-w-sm bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-emerald-500/50 transition-colors">
          <Search size={13} className="text-zinc-500 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search JSON keys or values..."
            className="w-full bg-transparent text-[11.5px] text-zinc-200 placeholder-zinc-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-500">
            {lines.length} lines • {(formattedJson.length / 1024).toFixed(1)} KB
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer text-[11px]"
          >
            {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer text-[11px]"
          >
            <Download size={12} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Code Container with Line Numbers */}
      <div className="flex-1 min-h-[350px] max-h-[520px] rounded-xl bg-[#0d0d10] border border-white/[0.08] overflow-auto font-mono text-[11.5px] leading-relaxed p-3 select-text shadow-inner">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const matchesSearch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());

              return (
                <tr
                  key={idx}
                  className={`hover:bg-white/[0.03] transition-colors ${
                    matchesSearch ? 'bg-amber-500/15' : ''
                  }`}
                >
                  <td className="w-10 pr-3 text-right text-zinc-600 select-none align-top font-mono text-[10.5px]">
                    {lineNum}
                  </td>
                  <td className="text-zinc-300 whitespace-pre font-mono">
                    {line}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
