import React, { useState } from 'react';
import { Database, ShieldAlert, GitFork, ChevronDown, ChevronRight, Key, Clock, Sparkles } from 'lucide-react';

interface IntakeSourcesTabProps {
  parsed: Record<string, any>;
}

export const IntakeSourcesTab: React.FC<IntakeSourcesTabProps> = ({ parsed }) => {
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const dataSources = parsed.retrieved_context?.data_sources || [];

  if (dataSources.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 text-[12px] border border-dashed border-white/10 rounded-xl">
        No external database sources or entity schemas defined in this specification.
      </div>
    );
  }

  const primarySource = dataSources[0] || {};
  const tables = primarySource.tables || [];
  const rules = primarySource.cleaning_and_transformation_rules || [];
  const relationships = primarySource.relationships || [];

  return (
    <div className="space-y-4 text-xs">
      {/* Source Connection Card */}
      <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <Database size={16} />
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-white">
                {primarySource.source_name || 'Primary Source Database'}
              </p>
              <p className="text-[11px] text-zinc-400">
                System: <strong className="text-zinc-200">{primarySource.system_type || 'Relational DB'}</strong> • Connector: <strong className="text-zinc-200">{primarySource.connector_type || 'standard'}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(primarySource.schemas_in_scope || []).map((s: string) => (
              <span key={s} className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25 text-[10.5px] font-mono">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Discovered Tables in Scope */}
      {tables.length > 0 && (
        <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-zinc-200 flex items-center gap-1.5">
              <Database size={14} className="text-blue-400" />
              <span>Tables & Entity Schemas ({tables.length})</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              Click table to inspect columns
            </span>
          </div>

          <div className="space-y-2">
            {tables.map((t: any) => {
              const isExp = expandedTable === t.table_name;
              const piiCols: string[] = t.pii_columns || [];
              const cols: any[] = t.columns || [];

              return (
                <div
                  key={t.table_name}
                  className="rounded-xl bg-black/40 border border-white/[0.06] overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedTable(isExp ? null : t.table_name)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button type="button" className="text-zinc-400">
                        {isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <span className="font-semibold text-white font-mono text-[12px] truncate">
                        {t.table_name}
                      </span>
                      {t.ingestion_mode && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.08] font-mono">
                          {t.ingestion_mode}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {t.primary_key && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1 font-mono">
                          <Key size={10} />
                          <span>{t.primary_key}</span>
                        </span>
                      )}
                      {t.watermark_column && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1 font-mono">
                          <Clock size={10} />
                          <span>{t.watermark_column}</span>
                        </span>
                      )}
                      {piiCols.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-1">
                          <ShieldAlert size={10} />
                          <span>{piiCols.length} PII</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {isExp && cols.length > 0 && (
                    <div className="px-4 pb-3 pt-1 border-t border-white/[0.04] bg-black/20">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {cols.map((col: any) => (
                          <div
                            key={col.name}
                            className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                              col.is_pii
                                ? 'bg-rose-500/[0.06] border-rose-500/30 text-rose-200'
                                : col.is_pk
                                ? 'bg-amber-500/[0.06] border-amber-500/30 text-amber-200'
                                : 'bg-white/[0.02] border-white/[0.05] text-zinc-300'
                            }`}
                          >
                            <span className="font-mono truncate">{col.name}</span>
                            <span className="text-[9.5px] text-zinc-500 font-mono shrink-0 ml-1">
                              {col.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cleaning & Transformation Rules */}
      {rules.length > 0 && (
        <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-2.5">
          <span className="text-[12px] font-semibold text-zinc-200 flex items-center gap-1.5">
            <Sparkles size={14} className="text-emerald-400" />
            <span>Cleaning & Transformation Rules ({rules.length})</span>
          </span>
          <div className="space-y-2">
            {rules.map((r: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-black/30 border border-white/[0.05] space-y-1">
                <span className="font-mono text-emerald-400 font-semibold text-[11px]">
                  {r.table}
                </span>
                <p className="text-[11.5px] text-zinc-300 leading-relaxed">
                  {r.rule}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entity Relationships */}
      {relationships.length > 0 && (
        <div className="p-4 rounded-xl bg-[#141417] border border-white/[0.08] space-y-2.5">
          <span className="text-[12px] font-semibold text-zinc-200 flex items-center gap-1.5">
            <GitFork size={14} className="text-purple-400" />
            <span>Entity Relationships & Foreign Keys ({relationships.length})</span>
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {relationships.map((rel: string, idx: number) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-black/30 border border-white/[0.05] font-mono text-[11px] text-zinc-300 truncate"
                title={rel}
              >
                {rel}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
