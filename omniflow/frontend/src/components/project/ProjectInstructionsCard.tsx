import React, { useState } from 'react';
import { Plus, Edit3, X, Check, BookOpen, Sparkles } from 'lucide-react';

interface ProjectInstructionsCardProps {
  instructions?: string;
  onSaveInstructions: (instructions: string) => Promise<void>;
  disabled?: boolean;
}

export const ProjectInstructionsCard: React.FC<ProjectInstructionsCardProps> = ({
  instructions = '',
  onSaveInstructions,
  disabled = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [text, setText] = useState<string>(instructions);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleOpen = () => {
    setText(instructions);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSaveInstructions(text);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save instructions', err);
    } finally {
      setIsSaving(false);
    }
  };

  const hasInstructions = Boolean(instructions && instructions.trim().length > 0);

  return (
    <>
      <div className="w-full rounded-2xl bg-[#17171c] border border-[#2b2b34] p-4 transition-all duration-200 hover:border-[#383842]">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium text-[#d1d1db] flex items-center gap-1.5">
            Instructions
          </span>
          <button
            type="button"
            onClick={handleOpen}
            disabled={disabled}
            className="p-1 rounded-lg text-[#8e8ea0] hover:text-white hover:bg-[#25252e] transition-colors"
            title={hasInstructions ? 'Edit instructions' : 'Add instructions'}
          >
            {hasInstructions ? <Edit3 width={14} height={14} /> : <Plus width={15} height={15} />}
          </button>
        </div>

        {/* Body */}
        {hasInstructions ? (
          <div
            onClick={handleOpen}
            className="cursor-pointer group text-xs text-[#a1a1aa] hover:text-[#d1d1db] transition-colors leading-relaxed line-clamp-3 bg-[#111115]/60 p-2.5 rounded-xl border border-[#25252d]"
          >
            {instructions}
          </div>
        ) : (
          <p
            onClick={handleOpen}
            className="cursor-pointer text-xs text-[#71717a] hover:text-[#a1a1aa] transition-colors leading-relaxed"
          >
            Add instructions to tailor Omniflow's responses
          </p>
        )}
      </div>

      {/* Edit Instructions Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-lg bg-[#18181d] border border-[#303038] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2b2b34]">
              <div className="flex items-center gap-2">
                <BookOpen width={16} height={16} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Project Instructions</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#8e8ea0] hover:text-white transition-colors"
              >
                <X width={16} height={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              <p className="text-xs text-[#8e8ea0] leading-relaxed">
                Provide custom guidelines that Omniflow AI agents should always keep in mind when generating PySpark notebooks, SQL schemas, and Medallion pipelines for this project.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Always use Delta Lake MERGE on customer_id for Silver tables; enforce lowercase column naming; deploy notebooks in AI_Test_Folder."
                rows={7}
                className="w-full p-3.5 rounded-xl bg-[#121216] border border-[#2e2e38] text-xs text-white placeholder-[#5c5c6b] focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 leading-relaxed resize-none"
              />

              {/* Quick Presets */}
              <div className="pt-1">
                <span className="text-[11px] font-medium text-[#71717a] block mb-1.5 flex items-center gap-1">
                  <Sparkles width={11} height={11} className="text-emerald-400" />
                  Quick Preset Guidelines:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setText(
                        (prev) =>
                          `${prev ? prev + '\n' : ''}• Medallion Silver: Enforce null-safe SHA-256 masking on all PII columns.`
                      )
                    }
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#22222a] text-[#a1a1aa] hover:text-white hover:bg-[#2c2c36] transition-colors"
                  >
                    + PII Masking
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setText(
                        (prev) =>
                          `${prev ? prev + '\n' : ''}• Medallion Gold: Use Kimball dimensional star schema with surrogate keys.`
                      )
                    }
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#22222a] text-[#a1a1aa] hover:text-white hover:bg-[#2c2c36] transition-colors"
                  >
                    + Kimball Star Schema
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setText(
                        (prev) =>
                          `${prev ? prev + '\n' : ''}• Container: Deploy all assets inside AI_Test_Folder container.`
                      )
                    }
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[#22222a] text-[#a1a1aa] hover:text-white hover:bg-[#2c2c36] transition-colors"
                  >
                    + AI_Test_Folder
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-[#2b2b34] bg-[#141418]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-[#a1a1aa] hover:text-white rounded-lg hover:bg-[#22222a] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                <Check width={13} height={13} />
                <span>{isSaving ? 'Saving...' : 'Save Instructions'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
