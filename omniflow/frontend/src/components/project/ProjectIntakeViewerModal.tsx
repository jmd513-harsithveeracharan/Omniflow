import React, { useState } from 'react';
import { X, Copy, Check, FileJson, Layers, ShieldCheck } from 'lucide-react';
import { ProjectContextFile } from '../../types';

interface ProjectIntakeViewerModalProps {
  file: ProjectContextFile;
  onClose: () => void;
}

export const ProjectIntakeViewerModal: React.FC<ProjectIntakeViewerModalProps> = ({
  file,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'structured' | 'raw'>('structured');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  let parsed: Record<string, any> = {};
  try {
    if (file.content) {
      parsed = JSON.parse(file.content);
    }
  } catch {
    parsed = {};
  }

  const pSum = parsed.project_context?.project_summary || {};
  const platSum = parsed.project_context?.platform_summary || {};
  const solSum = parsed.project_context?.solution_summary || {};
  const deliverables: string[] = solSum.expected_deliverables || [];
  const criteria: string[] = solSum.success_criteria || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content || JSON.stringify(parsed, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in-50">
      <div className="w-full max-w-2xl bg-[#16161b] border border-[#2e2e38] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2b2b34] bg-[#1a1a20]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FileJson width={18} height={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{file.name}</h3>
              <p className="text-[11px] text-[#71717a]">
                Project Intake Specification • {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#a1a1aa] hover:text-white rounded-lg hover:bg-[#25252e] transition-colors"
            >
              {isCopied ? <Check width={13} height={13} className="text-emerald-400" /> : <Copy width={13} height={13} />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[#8e8ea0] hover:text-white transition-colors"
            >
              <X width={16} height={16} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-[#24242d] bg-[#141418]">
          <button
            type="button"
            onClick={() => setActiveTab('structured')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'structured'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            Structured Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'raw'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            Raw JSON
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'structured' ? (
            <>
              {/* Summary Banner */}
              <div className="p-3.5 rounded-xl bg-[#1b1b22] border border-[#292934] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">
                    {pSum.project_name || 'Enterprise Data Solution'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300">
                    {platSum.target_platform || 'Microsoft Fabric'}
                  </span>
                </div>
                <p className="text-[#a1a1aa] leading-relaxed">
                  {pSum.business_objective || 'Medallion data architecture platform'}
                </p>
                <div className="flex items-center gap-4 pt-1 text-[11px] text-[#71717a]">
                  <span>Domain: <strong className="text-[#d1d1db]">{pSum.business_domain || 'Analytics'}</strong></span>
                  <span>SKU: <strong className="text-[#d1d1db]">{platSum.capacity_sku || 'F64'}</strong></span>
                  <span>Lang: <strong className="text-[#d1d1db]">{platSum.primary_language || 'PySpark / SQL'}</strong></span>
                </div>
              </div>

              {/* Deliverables */}
              {deliverables.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-medium text-[#d1d1db] flex items-center gap-1.5">
                    <Layers width={13} height={13} className="text-blue-400" />
                    Target Deliverables ({deliverables.length})
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {deliverables.map((d, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1.5 rounded-lg bg-[#141419] border border-[#25252e] text-[#a1a1aa] font-mono text-[11px] truncate"
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success Criteria */}
              {criteria.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="font-medium text-[#d1d1db] flex items-center gap-1.5">
                    <ShieldCheck width={13} height={13} className="text-emerald-400" />
                    Success Criteria ({criteria.length})
                  </span>
                  <ul className="space-y-1 text-[#8e8ea0]">
                    {criteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <pre className="p-4 rounded-xl bg-[#0f0f13] border border-[#22222a] text-[#a1a1aa] font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {file.content || JSON.stringify(parsed, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
