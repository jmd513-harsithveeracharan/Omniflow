import React, { useState } from 'react';
import { Plus, FileJson, FileText, Eye, Trash2 } from 'lucide-react';
import { ProjectContextFile } from '../../types';
import { ProjectIntakeViewerModal } from './ProjectIntakeViewerModal';
import { ProjectInstructionsModal } from './ProjectInstructionsModal';
import { ProjectAddContextModal } from './ProjectAddContextModal';

interface ProjectRightPanelProps {
  instructions?: string;
  contextFiles: ProjectContextFile[];
  onSaveInstructions: (instructions: string) => Promise<void>;
  onAddContextFile: (file: ProjectContextFile) => Promise<void>;
  onRemoveContextFile: (fileId: string) => Promise<void>;
}

export const ProjectRightPanel: React.FC<ProjectRightPanelProps> = ({
  instructions = '',
  contextFiles,
  onSaveInstructions,
  onAddContextFile,
  onRemoveContextFile,
}) => {
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [isAddContextOpen, setIsAddContextOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<ProjectContextFile | null>(null);

  const hasInstructions = Boolean(instructions && instructions.trim().length > 0);

  return (
    <>
      {/* Unified Claude-Style Container with Omniflow Styling */}
      <div className="w-full rounded-2xl bg-[#1a1a1c] border border-[#2a2b30] overflow-hidden text-[#f0f0f2] shadow-xl">
        {/* Upper Section: Instructions */}
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[15px] font-normal text-[#f0f0f2]">Instructions</h3>
            <button
              type="button"
              onClick={() => setIsInstructionsModalOpen(true)}
              className="p-1 text-[#8e918f] hover:text-[#f0f0f2] transition-colors"
              title="Add instructions"
            >
              <Plus width={18} height={18} strokeWidth={1.75} />
            </button>
          </div>

          {hasInstructions ? (
            <div
              onClick={() => setIsInstructionsModalOpen(true)}
              className="cursor-pointer text-[13px] text-[#c4c7c5] hover:text-white leading-relaxed line-clamp-3 transition-colors"
            >
              {instructions}
            </div>
          ) : (
            <p
              onClick={() => setIsInstructionsModalOpen(true)}
              className="cursor-pointer text-[13px] text-[#8e918f] hover:text-[#c4c7c5] leading-relaxed transition-colors"
            >
              Add instructions to tailor Omniflow’s responses
            </p>
          )}
        </div>

        {/* Clean Hairline Divider */}
        <div className="border-t border-[#232326]" />

        {/* Lower Section: Context */}
        <div className="p-5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-normal text-[#f0f0f2]">Context</h3>
            <button
              type="button"
              onClick={() => setIsAddContextOpen(true)}
              className="p-1 text-[#8e918f] hover:text-[#f0f0f2] transition-colors"
              title="Add context"
            >
              <Plus width={18} height={18} strokeWidth={1.75} />
            </button>
          </div>

          {/* Context Files List (if any) */}
          {contextFiles.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {contextFiles.map((f) => (
                <div
                  key={f.id}
                  className="group flex items-center justify-between px-3 py-2 rounded-xl bg-[#141416] border border-[#232326] hover:border-[#2a2b30] transition-all"
                >
                  <div
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 mr-2"
                    onClick={() => setViewingFile(f)}
                  >
                    <div className="text-emerald-400 flex-shrink-0">
                      {f.type === 'json' ? <FileJson width={15} height={15} /> : <FileText width={15} height={15} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-normal text-[#f0f0f2] truncate group-hover:text-emerald-300 transition-colors">
                        {f.name}
                      </p>
                      <p className="text-[10px] text-[#8e918f]">
                        {f.is_intake_spec ? 'Intake Spec' : f.type.toUpperCase()} • {(f.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewingFile(f)}
                      className="p-1 rounded text-[#8e918f] hover:text-[#f0f0f2] transition-colors"
                      title="View file"
                    >
                      <Eye width={13} height={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveContextFile(f.id)}
                      className="p-1 rounded text-[#8e918f] hover:text-red-400 transition-colors"
                      title="Remove file"
                    >
                      <Trash2 width={13} height={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Claude's Recessed Inner Well Box with 3 Stacked Documents SVG */}
          <div
            onClick={() => setIsAddContextOpen(true)}
            className="cursor-pointer group rounded-xl bg-[#141416] border border-[#232326] hover:border-[#2a2b30] py-9 px-6 flex flex-col items-center justify-center text-center transition-all duration-200"
          >
            {/* 3 Stacked Documents SVG Illustration */}
            <div className="mb-3.5 flex items-center justify-center">
              <svg width="68" height="52" viewBox="0 0 68 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Left document (tilted counter-clockwise) */}
                <g transform="translate(6, 6) rotate(-7 14 18)">
                  <rect x="0" y="0" width="28" height="34" rx="4" fill="#1c1c1f" stroke="#2e2e33" strokeWidth="1" />
                  <line x1="5" y1="8" x2="23" y2="8" stroke="#3e3f47" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" />
                  <line x1="5" y1="13" x2="23" y2="13" stroke="#3e3f47" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" />
                  <line x1="5" y1="18" x2="18" y2="18" stroke="#3e3f47" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 2" />
                </g>
                {/* Right document (tilted clockwise, dashed outline) */}
                <g transform="translate(32, 6) rotate(6 14 18)">
                  <rect x="0" y="0" width="28" height="34" rx="4" fill="#18181a" stroke="#28282c" strokeWidth="1" strokeDasharray="3 2" />
                </g>
                {/* Center / Front document with plus */}
                <g transform="translate(20, 2)">
                  <rect x="0" y="0" width="30" height="36" rx="5" fill="#222225" stroke="#383940" strokeWidth="1" />
                  <line x1="6" y1="8" x2="24" y2="8" stroke="#4e505a" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 1.5" />
                  <line x1="6" y1="12" x2="24" y2="12" stroke="#4e505a" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 1.5" />
                  <line x1="6" y1="16" x2="16" y2="16" stroke="#4e505a" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 1.5" />
                  <rect x="8" y="20" width="14" height="12" rx="3" fill="#28282c" stroke="#3a3b42" strokeWidth="0.8" />
                  <line x1="15" y1="23" x2="15" y2="29" stroke="#8e918f" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="12" y1="26" x2="18" y2="26" stroke="#8e918f" strokeWidth="1.2" strokeLinecap="round" />
                </g>
              </svg>
            </div>

            <p className="text-[13px] text-[#8e918f] group-hover:text-[#c4c7c5] leading-relaxed max-w-[220px] transition-colors">
              Add PDFs, documents, or other text to reference in this project.
            </p>
          </div>
        </div>
      </div>

      {/* Instructions Modal */}
      {isInstructionsModalOpen && (
        <ProjectInstructionsModal
          initialInstructions={instructions}
          onSave={onSaveInstructions}
          onClose={() => setIsInstructionsModalOpen(false)}
        />
      )}

      {/* Add Context Modal */}
      {isAddContextOpen && (
        <ProjectAddContextModal
          onAddFile={onAddContextFile}
          onClose={() => setIsAddContextOpen(false)}
        />
      )}

      {/* View Intake JSON Modal */}
      {viewingFile && (
        <ProjectIntakeViewerModal
          file={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}
    </>
  );
};
