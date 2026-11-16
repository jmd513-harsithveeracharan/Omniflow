import React from 'react';
import { Layers, ShieldCheck, CheckCircle2, FolderGit2, Sparkles, Server } from 'lucide-react';

interface IntakeArchitectureTabProps {
  parsed: Record<string, any>;
}

export const IntakeArchitectureTab: React.FC<IntakeArchitectureTabProps> = ({ parsed }) => {
  const pSum = parsed.project_context?.project_summary || {};
  const platSum = parsed.project_context?.platform_summary || {};
  const solSum = parsed.project_context?.solution_summary || {};
  const reqCtx = parsed.request_context || {};

  const deliverables: string[] = Array.isArray(solSum.expected_deliverables)
    ? solSum.expected_deliverables
    : [];
  const criteria: string[] = Array.isArray(solSum.success_criteria)
    ? solSum.success_criteria
    : [];
  const bestPractices: string[] = Array.isArray(solSum.engineering_best_practices)
    ? solSum.engineering_best_practices
    : [];
  const folderStruct = solSum.target_folder_structure || {};
  const subfolders = folderStruct.subfolders || {};

  const layers = [
    { key: 'raw', name: 'Bronze Raw', folder: subfolders.raw || '01 Raw', color: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/30', badge: 'bg-amber-500/15 text-amber-300' },
    { key: 'stage', name: 'Stage Curation', folder: subfolders.stage || '02 Stage', color: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/30', badge: 'bg-blue-500/15 text-blue-300' },
    { key: 'silver', name: 'Silver Curated', folder: subfolders.silver || '03 Silver', color: 'from-slate-400/20 to-slate-400/5', border: 'border-slate-400/30', badge: 'bg-slate-400/15 text-slate-200' },
    { key: 'gold', name: 'Gold Semantic', folder: subfolders.gold || '04 Gold', color: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-500/30', badge: 'bg-emerald-500/15 text-emerald-300' },
  ];

  return (
    <div className="space-y-4 text-xs">
      {/* Executive Summary Card */}
      <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-[#f4f4f5] text-[14.5px] truncate">
              {pSum.project_name || 'Enterprise Medallion Platform'}
            </span>
            {pSum.project_code && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-zinc-400 border border-white/[0.08]">
                {pSum.project_code}
              </span>
            )}
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shrink-0">
            <Server size={12} />
            <span>{platSum.target_platform || 'Microsoft Fabric'}</span>
          </span>
        </div>

        <p className="text-zinc-300 text-[12px] leading-relaxed">
          {pSum.business_objective || reqCtx.objective || reqCtx.user_request || 'Automated Fabric Medallion Architecture provisioning'}
        </p>

        {pSum.business_context && (
          <p className="text-zinc-400 text-[11.5px] italic border-l-2 border-emerald-500/40 pl-3 py-0.5">
            "{pSum.business_context}"
          </p>
        )}

        {/* Metadata Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-white/[0.06] text-[11px]">
          <div className="p-2 rounded-lg bg-black/30 border border-white/[0.04]">
            <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Business Domain</span>
            <span className="text-zinc-200 font-medium truncate block">{pSum.business_domain || 'Analytics'}</span>
          </div>
          <div className="p-2 rounded-lg bg-black/30 border border-white/[0.04]">
            <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Capacity SKU</span>
            <span className="text-zinc-200 font-medium truncate block">{platSum.capacity_sku || 'F64'}</span>
          </div>
          <div className="p-2 rounded-lg bg-black/30 border border-white/[0.04]">
            <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Primary Engine</span>
            <span className="text-zinc-200 font-medium truncate block">{platSum.primary_engine || platSum.primary_language || 'PySpark & T-SQL'}</span>
          </div>
          <div className="p-2 rounded-lg bg-black/30 border border-white/[0.04]">
            <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Storage Format</span>
            <span className="text-zinc-200 font-medium truncate block">{platSum.storage_format || 'Delta Lake (V-Order)'}</span>
          </div>
        </div>
      </div>

      {/* Medallion Architecture Flow */}
      <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-zinc-200 flex items-center gap-1.5">
            <FolderGit2 size={14} className="text-emerald-400" />
            <span>Target Medallion Folder Structure</span>
          </span>
          {folderStruct.root_folder && (
            <span className="text-[10.5px] font-mono text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
              Root: {folderStruct.root_folder}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {layers.map((l) => (
            <div
              key={l.key}
              className={`p-3 rounded-xl bg-gradient-to-b ${l.color} border ${l.border} flex flex-col justify-between gap-2`}
            >
              <div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${l.badge}`}>
                  {l.name}
                </span>
                <p className="text-[12px] font-semibold text-white mt-1.5 truncate">
                  {l.folder}
                </p>
              </div>
              <span className="text-[10.5px] text-zinc-400">
                {l.key === 'raw' && 'Append-only landing'}
                {l.key === 'stage' && 'Dedup & quarantine'}
                {l.key === 'silver' && 'Delta MERGE & PII masked'}
                {l.key === 'gold' && 'Star schema warehouse'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Target Deliverables */}
      {deliverables.length > 0 && (
        <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-zinc-200 flex items-center gap-1.5">
              <Layers size={14} className="text-emerald-400" />
              <span>Target Deliverables ({deliverables.length})</span>
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {deliverables.map((d, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-zinc-300 font-mono text-[11px] flex items-center gap-2 hover:border-white/15 transition-colors"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engineering Best Practices */}
      {bestPractices.length > 0 && (
        <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-2.5">
          <span className="text-[12px] font-semibold text-zinc-200 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" />
            <span>Engineering Architecture Rules ({bestPractices.length})</span>
          </span>
          <div className="space-y-2">
            {bestPractices.map((bp, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg bg-black/30 border border-white/[0.05] text-[11.5px] text-zinc-300 leading-relaxed"
              >
                {bp}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Criteria */}
      {criteria.length > 0 && (
        <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-2.5">
          <span className="text-[12px] font-semibold text-zinc-200 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Verification & Success Criteria ({criteria.length})</span>
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {criteria.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2.5 rounded-lg bg-black/30 border border-white/[0.05] text-[11.5px] text-zinc-300"
              >
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
