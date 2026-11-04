import React, { useState } from 'react';
import { X, Check, BookOpen, Sparkles } from 'lucide-react';

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#1a1a1c] border border-[#2e2f35] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#232326]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <BookOpen width={18} height={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f0f0f2]">Project Instructions</h3>
              <p className="text-[11px] text-[#8e918f]">Configure persistent architectural rules for AI agents</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8e918f] hover:text-[#f0f0f2] hover:bg-[#222225] transition-colors"
          >
            <X width={16} height={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <p className="text-xs text-[#c4c7c5] leading-relaxed">
            Provide system guidance that Omniflow AI agents should enforce when writing PySpark notebooks, SQL models, and Medallion pipelines for this project.
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Always use Delta Lake MERGE on primary keys for Silver tables; enforce lowercase column naming; deploy notebooks in AI_Test_Folder."
            rows={7}
            className="w-full p-4 rounded-xl bg-[#141416] border border-[#232326] text-xs text-[#f0f0f2] placeholder-[#71717a] focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 leading-relaxed resize-none transition-all font-sans"
          />

          {/* Quick Presets */}
          <div className="pt-1">
            <span className="text-[11px] font-medium text-[#8e918f] mb-2 flex items-center gap-1.5">
              <Sparkles width={12} height={12} className="text-emerald-400" />
              Quick Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setText((prev) => `${prev ? prev + '\n' : ''}• Medallion Silver: Enforce null-safe SHA-256 masking on all PII columns.`)
                }
                className="text-[11px] px-3 py-1.5 rounded-lg bg-[#222225] border border-[#2a2b30] text-[#c4c7c5] hover:text-white hover:border-[#383940] hover:bg-[#28282c] transition-all"
              >
                + PII Masking
              </button>
              <button
                type="button"
                onClick={() =>
                  setText((prev) => `${prev ? prev + '\n' : ''}• Medallion Gold: Use Kimball dimensional star schema with surrogate keys.`)
                }
                className="text-[11px] px-3 py-1.5 rounded-lg bg-[#222225] border border-[#2a2b30] text-[#c4c7c5] hover:text-white hover:border-[#383940] hover:bg-[#28282c] transition-all"
              >
                + Kimball Star Schema
              </button>
              <button
                type="button"
                onClick={() =>
                  setText((prev) => `${prev ? prev + '\n' : ''}• Delta Lake: Enable change data feed (CDF) on high-frequency transaction tables.`)
                }
                className="text-[11px] px-3 py-1.5 rounded-lg bg-[#222225] border border-[#2a2b30] text-[#c4c7c5] hover:text-white hover:border-[#383940] hover:bg-[#28282c] transition-all"
              >
                + Change Data Feed
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#232326] bg-[#141416]/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#8e918f] hover:text-white rounded-lg hover:bg-[#222225] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all shadow-md disabled:opacity-50"
          >
            <Check width={13} height={13} />
            <span>{isSaving ? 'Saving...' : 'Save Instructions'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
