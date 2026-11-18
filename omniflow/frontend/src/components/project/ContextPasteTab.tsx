import React from 'react';
import { FileText, Check, AlertCircle, Sparkles } from 'lucide-react';

interface ContextPasteTabProps {
  customTitle: string;
  setCustomTitle: (title: string) => void;
  customText: string;
  setCustomText: (text: string) => void;
  jsonError: string | null;
  onFormatJson: () => void;
  onSavePasted: () => void;
}

export const ContextPasteTab: React.FC<ContextPasteTabProps> = ({
  customTitle,
  setCustomTitle,
  customText,
  setCustomText,
  jsonError,
  onFormatJson,
  onSavePasted,
}) => {
  const isJson = customTitle.endsWith('.json');
  const hasText = customText.trim().length > 0;
  const isValid = hasText && !jsonError;

  return (
    <div className="space-y-4">
      {/* File Name Field */}
      <div>
        <label className="block text-[11px] font-semibold text-zinc-400 tracking-wider uppercase mb-1.5 px-0.5">
          Artifact Name / File Name
        </label>
        <div className="flex items-center gap-2.5 bg-[#141418] border border-white/10 focus-within:border-emerald-500/50 rounded-xl px-3.5 py-2.5 transition-all">
          <FileText size={15} className="text-zinc-500 shrink-0" />
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="e.g. project_intake.json, source_schema.sql, architecture.md"
            className="w-full bg-transparent text-[13px] text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Editor Content Header */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="flex items-center gap-2.5">
            <label className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
              Specification or DDL Content
            </label>
            {jsonError ? (
              <span className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                <AlertCircle size={12} />
                <span>Invalid JSON</span>
              </span>
            ) : hasText && isJson ? (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <Check size={12} />
                <span>Valid JSON</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {isJson && hasText && (
              <button
                type="button"
                onClick={onFormatJson}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer transition-colors"
              >
                <Sparkles size={11} />
                <span>Prettify JSON</span>
              </button>
            )}
            <span className="text-[11px] font-mono text-zinc-500">
              {customText.length.toLocaleString()} characters
            </span>
          </div>
        </div>

        {/* Text Area */}
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Paste intake JSON spec, DDL create scripts, or architecture markdown here..."
          rows={11}
          className={`w-full p-4 rounded-xl bg-[#0f0f12] border text-[12.5px] font-mono text-zinc-200 placeholder-zinc-600 leading-relaxed resize-none transition-all outline-none ${
            jsonError
              ? 'border-rose-500/50 focus:border-rose-500'
              : 'border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20'
          }`}
        />
      </div>

      {/* Save & Attach Button */}
      <button
        type="button"
        onClick={onSavePasted}
        disabled={!isValid}
        className="w-full py-3 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-2"
      >
        <Check size={15} strokeWidth={2.5} />
        <span>Save & Attach to Context</span>
      </button>
    </div>
  );
};
