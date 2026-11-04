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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in-50">
      <div className="w-full max-w-lg bg-[#242424] border border-[#383838] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#303030]">
          <div className="flex items-center gap-2">
            <BookOpen width={16} height={16} className="text-[#c0c0c0]" />
            <h3 className="text-sm font-semibold text-white">Project Instructions</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8e8ea0] hover:text-white transition-colors"
          >
            <X width={16} height={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          <p className="text-xs text-[#9a9a9a] leading-relaxed">
            Provide custom guidelines that Omniflow AI agents should follow when generating PySpark notebooks, SQL schemas, and Medallion pipelines for this project.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Always use Delta Lake MERGE on customer_id for Silver tables; enforce lowercase column naming; deploy notebooks in AI_Test_Folder."
            rows={7}
            className="w-full p-3.5 rounded-xl bg-[#191919] border border-[#333333] text-xs text-white placeholder-[#666666] focus:outline-none focus:border-[#555555] leading-relaxed resize-none"
          />

          {/* Quick Presets */}
          <div className="pt-1">
            <span className="text-[11px] font-medium text-[#777777] block mb-1.5 flex items-center gap-1">
              <Sparkles width={11} height={11} className="text-emerald-400" />
              Quick Presets:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setText((prev) => `${prev ? prev + '\n' : ''}• Medallion Silver: Enforce null-safe SHA-256 masking on all PII columns.`)
                }
                className="text-[11px] px-2.5 py-1 rounded-lg bg-[#2e2e2e] text-[#a1a1aa] hover:text-white hover:bg-[#383838] transition-colors"
              >
                + PII Masking
              </button>
              <button
                type="button"
                onClick={() =>
                  setText((prev) => `${prev ? prev + '\n' : ''}• Medallion Gold: Use Kimball dimensional star schema with surrogate keys.`)
                }
                className="text-[11px] px-2.5 py-1 rounded-lg bg-[#2e2e2e] text-[#a1a1aa] hover:text-white hover:bg-[#383838] transition-colors"
              >
                + Kimball Star Schema
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#303030] bg-[#1e1e1e]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-[#a1a1aa] hover:text-white rounded-lg hover:bg-[#2b2b2b] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[#3e3e3e] hover:bg-[#4a4a4a] rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Check width={13} height={13} />
            <span>{isSaving ? 'Saving...' : 'Save Instructions'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
