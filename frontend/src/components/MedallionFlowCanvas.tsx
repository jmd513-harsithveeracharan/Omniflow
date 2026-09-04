import React from 'react';
import { Layers, Database, ArrowRight, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';

interface MedallionNode {
  id: string;
  name: string;
  layer: 'source' | 'bronze' | 'silver' | 'gold' | 'report';
  status: 'synced' | 'pending' | 'warning';
  itemCount: number;
}

const SAMPLE_MEDALLION: MedallionNode[] = [
  { id: 'src_1', name: 'Azure SQL (dbo.Orders)', layer: 'source', status: 'synced', itemCount: 1 },
  { id: 'brz_1', name: 'lh_sales_bronze (raw_orders)', layer: 'bronze', status: 'synced', itemCount: 1 },
  { id: 'slv_1', name: 'lh_sales_silver (fact_orders)', layer: 'silver', status: 'synced', itemCount: 1 },
  { id: 'gld_1', name: 'lh_sales_gold (dim_customer)', layer: 'gold', status: 'synced', itemCount: 1 },
  { id: 'pbi_1', name: 'Exec Sales Dashboard', layer: 'report', status: 'synced', itemCount: 1 },
];

export const MedallionFlowCanvas: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#070b12] relative overflow-hidden">
      {/* Canvas Header */}
      <div className="h-10 border-b border-border/50 bg-surface-card/40 px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          <Layers className="w-3.5 h-3.5 text-brand-cyan" />
          <span>Interactive Medallion DAG Pipeline</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Lineage In-Sync (OneLake Active)</span>
        </div>
      </div>

      {/* Interactive Visual DAG Grid */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-x-auto">
        <div className="flex items-center gap-4 min-w-[750px]">
          {SAMPLE_MEDALLION.map((node, index) => {
            const isBronze = node.layer === 'bronze';
            const isSilver = node.layer === 'silver';
            const isGold = node.layer === 'gold';
            const isSource = node.layer === 'source';

            return (
              <React.Fragment key={node.id}>
                {/* Node Card */}
                <div
                  className={`relative p-4 rounded-xl glass-card w-52 transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                    isBronze
                      ? 'border-orange-500/40 hover:border-orange-500 shadow-orange-500/10'
                      : isSilver
                      ? 'border-slate-400/40 hover:border-slate-300 shadow-slate-400/10'
                      : isGold
                      ? 'border-yellow-500/40 hover:border-yellow-400 shadow-yellow-500/10'
                      : isSource
                      ? 'border-blue-500/40 hover:border-blue-400 shadow-blue-500/10'
                      : 'border-emerald-500/40 hover:border-emerald-400 shadow-emerald-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${
                        isBronze
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : isSilver
                          ? 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
                          : isGold
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : isSource
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {node.layer}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-100 truncate">{node.name}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-border/40 font-mono">
                    <span>Delta Table</span>
                    <span className="text-brand-cyan flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Auto-Merge
                    </span>
                  </div>
                </div>

                {/* Connecting Line / Arrow */}
                {index < SAMPLE_MEDALLION.length - 1 && (
                  <div className="flex items-center justify-center text-slate-600">
                    <ArrowRight className="w-5 h-5 animate-pulse text-brand-primary/60" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Safety Gate Alert Bar */}
      <div className="h-10 border-t border-border/50 bg-surface-card/60 px-4 flex items-center justify-between text-xs z-10">
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldAlert className="w-3.5 h-3.5 text-brand-cyan" />
          <span>Containment Policy Active: Deployments locked to <strong>AI_Test_Folder</strong></span>
        </div>
        <span className="text-[11px] font-mono text-slate-500">1-Hop JIT Memory Active</span>
      </div>
    </div>
  );
};
