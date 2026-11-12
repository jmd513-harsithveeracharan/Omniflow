import React, { useState } from 'react';
import { X, Check, BookOpen, Sparkles, Terminal, Plus, Trash2 } from 'lucide-react';

interface ProjectInstructionsModalProps {
  initialInstructions: string;
  onSave: (instructions: string) => Promise<void>;
  onClose: () => void;
}

export const ProjectInstructionsModal: React.FC<ProjectInstructionsModalProps> = ({
  initialInstructions,
  onSave,
  onClose,
}) => {
  const [text, setText] = useState<string>(initialInstructions);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(text);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const addPreset = (instruction: string) => {
    setText((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${instruction}` : instruction;
    });
  };

  const lineCount = text.trim() ? text.split('\n').filter((l) => l.trim().length > 0).length : 0;

  return (
    <div
      className="fixed inset-0 z-[100050] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-gradient-to-b from-[#141417] to-[#0d0d10] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-sans select-none ring-1 ring-white/5 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-inner">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#f4f4f5] tracking-tight">Project Instructions</h3>
              <p className="text-[12px] text-[#8e918f] mt-0.5">Configure persistent architectural rules for AI agents</p>
            </div>
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

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <p className="text-[12px] text-[#a1a1aa] leading-relaxed">
            Provide system guidance that Omniflow AI agents should enforce when writing PySpark notebooks, SQL models, and Medallion pipelines for this project.
          </p>

          {/* Code / Rule Editor Frame */}
          <div className="rounded-xl border border-white/10 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/25 bg-[#0e0e11] overflow-hidden transition-all shadow-inner">
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.02] text-[11px] text-zinc-500">
              <div className="flex items-center gap-1.5 font-mono">
                <Terminal size={12} className="text-emerald-400/80" />
                <span>system_prompt_rules.md</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10.5px]">
                  {lineCount} {lineCount === 1 ? 'rule' : 'rules'} • {text.length} chars
                </span>
                {text.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setText('')}
                    className="flex items-center gap-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Clear instructions"
                  >
                    <Trash2 size={11} />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Always use Delta Lake MERGE on primary keys for Silver tables; enforce lowercase column naming; deploy all artifacts inside AI_Test_Folder."
              rows={8}
              className="w-full p-4 bg-transparent text-[12px] font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none leading-relaxed resize-none"
            />
          </div>

          {/* Quick Presets */}
          <div className="pt-1">
            <span className="text-[11px] font-semibold text-[#71717a] tracking-wider uppercase mb-2 flex items-center gap-1.5 px-0.5">
              <Sparkles size={12} className="text-emerald-400" />
              Quick Presets
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addPreset('• Medallion Silver: Enforce null-safe SHA-256 masking on all PII columns.')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181c] border border-white/[0.08] hover:border-emerald-500/35 hover:bg-[#1e1e24] text-[#c4c7c5] hover:text-white text-[11.5px] font-medium transition-all cursor-pointer active:scale-95 group shadow-sm"
              >
                <Plus size={12} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                <span>PII Masking</span>
              </button>
              <button
                type="button"
                onClick={() => addPreset('• Medallion Gold: Use Kimball dimensional star schema with surrogate keys.')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181c] border border-white/[0.08] hover:border-emerald-500/35 hover:bg-[#1e1e24] text-[#c4c7c5] hover:text-white text-[11.5px] font-medium transition-all cursor-pointer active:scale-95 group shadow-sm"
              >
                <Plus size={12} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                <span>Kimball Star Schema</span>
              </button>
              <button
                type="button"
                onClick={() => addPreset('• Delta Lake: Enable change data feed (CDF) on high-frequency transaction tables.')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181c] border border-white/[0.08] hover:border-emerald-500/35 hover:bg-[#1e1e24] text-[#c4c7c5] hover:text-white text-[11.5px] font-medium transition-all cursor-pointer active:scale-95 group shadow-sm"
              >
                <Plus size={12} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                <span>Change Data Feed</span>
              </button>
              <button
                type="button"
                onClick={() => addPreset('• Containment: Deploy all Lakehouses and PySpark notebooks inside AI_Test_Folder.')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181c] border border-white/[0.08] hover:border-emerald-500/35 hover:bg-[#1e1e24] text-[#c4c7c5] hover:text-white text-[11.5px] font-medium transition-all cursor-pointer active:scale-95 group shadow-sm"
              >
                <Plus size={12} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                <span>Sandbox Containment</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-[#0e0e11]/90">
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            Rules apply across all agent sessions in this project
          </span>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-[12px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-xl transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
            >
              <Check size={13} strokeWidth={2.5} />
              <span>{isSaving ? 'Saving...' : 'Save Instructions'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
