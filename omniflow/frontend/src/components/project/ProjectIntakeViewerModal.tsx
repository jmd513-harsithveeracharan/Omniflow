import React, { useState } from 'react';
import { X, Copy, Check, FileJson, Layers, ShieldCheck } from 'lucide-react';
import { ProjectContextFile } from '../../types';

interface ProjectIntakeViewerModalProps {
  file: ProjectContextFile;
  onClose: () => void;
}

interface IntakeProjectContext {
  project_summary?: {
    project_name?: string;
    business_objective?: string;
    business_domain?: string;
  };
  platform_summary?: {
    target_platform?: string;
    capacity_sku?: string;
    primary_language?: string;
  };
  solution_summary?: {
    expected_deliverables?: string[];
    success_criteria?: string[];
  };
}

export const ProjectIntakeViewerModal: React.FC<ProjectIntakeViewerModalProps> = ({
  file,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'structured' | 'raw'>('structured');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  let parsedContext: IntakeProjectContext = {};
  try {
    if (file.content) {
      const full = JSON.parse(file.content);
      parsedContext = full.project_context || {};
    }
  } catch {
    parsedContext = {};
  }

  const pSum = parsedContext.project_summary || {};
  const platSum = parsedContext.platform_summary || {};
  const solSum = parsedContext.solution_summary || {};
  const deliverables: string[] = solSum.expected_deliverables || [];
  const criteria: string[] = solSum.success_criteria || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content || '');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#1a1a1c] border border-[#2e2f35] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#232326] bg-[#1a1a1c]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <FileJson width={18} height={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f0f0f2]">{file.name}</h3>
              <p className="text-[11px] text-[#8e918f]">
                Project Intake Specification • {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8e918f] hover:text-[#f0f0f2] rounded-lg hover:bg-[#222225] border border-transparent hover:border-[#2a2b30] transition-colors"
            >
              {isCopied ? <Check width={13} height={13} className="text-emerald-400" /> : <Copy width={13} height={13} />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#8e918f] hover:text-white hover:bg-[#222225] transition-colors"
            >
              <X width={16} height={16} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#232326] bg-[#141416]/50">
          <button
            type="button"
            onClick={() => setActiveTab('structured')}
            className={`pb-2.5 px-1 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'structured'
                ? 'border-emerald-500 text-[#f0f0f2]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            Structured Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`pb-2.5 px-1 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'raw'
                ? 'border-emerald-500 text-[#f0f0f2]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            Raw JSON
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'structured' ? (
            <>
              {/* Summary Banner */}
              <div className="p-4 rounded-xl bg-[#141416] border border-[#232326] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#f0f0f2] text-sm">
                    {pSum.project_name || 'Enterprise Data Solution'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {platSum.target_platform || 'Microsoft Fabric'}
                  </span>
                </div>
                <p className="text-[#c4c7c5] leading-relaxed">
                  {pSum.business_objective || 'Medallion data architecture platform'}
                </p>
                <div className="flex items-center gap-5 pt-1.5 text-[11px] text-[#8e918f]">
                  <span>Domain: <strong className="text-[#f0f0f2]">{pSum.business_domain || 'Analytics'}</strong></span>
                  <span>SKU: <strong className="text-[#f0f0f2]">{platSum.capacity_sku || 'F64'}</strong></span>
                  <span>Lang: <strong className="text-[#f0f0f2]">{platSum.primary_language || 'PySpark / SQL'}</strong></span>
                </div>
              </div>

              {/* Deliverables */}
              {deliverables.length > 0 && (
                <div className="space-y-2">
                  <span className="font-medium text-[#f0f0f2] flex items-center gap-1.5">
                    <Layers width={14} height={14} className="text-emerald-400" />
                    Target Deliverables ({deliverables.length})
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {deliverables.map((d, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 rounded-lg bg-[#141416] border border-[#232326] text-[#c4c7c5] font-mono text-[11px] truncate"
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success Criteria */}
              {criteria.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="font-medium text-[#f0f0f2] flex items-center gap-1.5">
                    <ShieldCheck width={14} height={14} className="text-emerald-400" />
                    Success Criteria ({criteria.length})
                  </span>
                  <ul className="space-y-1.5 text-[#8e918f]">
                    {criteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <pre className="p-4 rounded-xl bg-[#141416] border border-[#232326] text-[#c4c7c5] font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {file.content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
