import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  X,
  Database,
  ArrowRight,
} from 'lucide-react';
import { CredentialRequestData, DiscoveredSourceTable, ProvisionAndInspectResult } from '../../types';
import { provisionAndInspectConnector } from '../../services/api';

interface CredentialInterceptionCardProps {
  data: CredentialRequestData;
  onConfirmResume: (connectionId: string, selectedTables: string[], pathway?: string) => void;
  onDismiss: () => void;
}

export const CredentialInterceptionCard: React.FC<CredentialInterceptionCardProps> = ({
  data,
  onConfirmResume,
  onDismiss,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    data.required_params.forEach((p) => {
      initial[p.key] = p.default || '';
    });
    return initial;
  });

  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [inspectResult, setInspectResult] = useState<ProvisionAndInspectResult | null>(null);
  const [selectedTables, setSelectedTables] = useState<Record<string, boolean>>({});
  const [tableFilter, setTableFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'project' | 'all'>('project');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const getTableKey = (t: DiscoveredSourceTable): string =>
    t.full_name || (t.schema ? `${t.schema}.${t.name}` : t.name);

  const isInternalTable = (name: string): boolean => {
    const n = name.toLowerCase();
    return (
      n.startsWith('public.agent_') ||
      n.startsWith('public.agents') ||
      n.startsWith('public.artifacts') ||
      n.startsWith('public.runs') ||
      n.startsWith('public.tool_runs') ||
      n.startsWith('public.llm_token_logs') ||
      n.startsWith('public.fabric_items') ||
      n.startsWith('public.lineage_graph_edges') ||
      n.startsWith('public.projects') ||
      n.startsWith('pg_') ||
      n.startsWith('information_schema')
    );
  };

  const isTargetTable = (t: DiscoveredSourceTable): boolean => {
    const fullName = getTableKey(t).toLowerCase();
    const rawName = t.name.toLowerCase();
    if (data.target_tables && data.target_tables.length > 0) {
      return data.target_tables.some((target: string) => {
        const tgt = target.toLowerCase();
        return fullName === tgt || rawName === tgt || fullName.endsWith(`.${tgt}`);
      });
    }
    if (
      fullName.startsWith('source_crm.') ||
      fullName.startsWith('crm.') ||
      fullName.startsWith('sales.') ||
      fullName.startsWith('billing.')
    ) {
      return true;
    }
    const businessKeywords = [
      'customer',
      'order',
      'product',
      'invoice',
      'payment',
      'transaction',
      'account',
      'item',
      'inventory',
      'client',
    ];
    return businessKeywords.some((k) => rawName.includes(k)) && !isInternalTable(fullName);
  };

  const handleTogglePassword = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInspecting(true);
    setInspectError(null);

    try {
      const res = await provisionAndInspectConnector(data.connector_type, formData, false);
      setInspectResult(res);

      // Smart Auto-Discovery: Pre-select ONLY project-relevant target tables!
      const initialSelected: Record<string, boolean> = {};
      let matchedCount = 0;
      res.discovered_tables.forEach((t) => {
        const key = getTableKey(t);
        if (isTargetTable(t)) {
          initialSelected[key] = true;
          matchedCount++;
        }
      });

      // Fallback: If no business tables matched, pre-select the first 4 non-internal tables
      if (matchedCount === 0) {
        res.discovered_tables
          .filter((t) => !isInternalTable(getTableKey(t)))
          .slice(0, 4)
          .forEach((t) => {
            initialSelected[getTableKey(t)] = true;
          });
      }

      setSelectedTables(initialSelected);
      setActiveTab('project');
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsInspecting(false);
    }
  };

  const handleToggleTable = (tableKey: string) => {
    setSelectedTables((prev) => ({ ...prev, [tableKey]: !prev[tableKey] }));
  };

  const handleSelectAll = (select: boolean) => {
    if (!inspectResult) return;
    const next: Record<string, boolean> = { ...selectedTables };
    inspectResult.discovered_tables.forEach((t) => {
      const key = getTableKey(t);
      if (activeTab === 'all' || isTargetTable(t)) {
        next[key] = select;
      }
    });
    setSelectedTables(next);
  };

  const handleConfirmAndResume = () => {
    if (!inspectResult) return;
    const chosen = Object.entries(selectedTables)
      .filter(([, checked]) => checked)
      .map(([name]) => name);

    if (chosen.length === 0) {
      alert('Please select at least one table to ingest.');
      return;
    }

    const pathway =
      inspectResult.pathway ||
      data.pathway ||
      (data.is_fabric_native === false ? 'pyspark_notebook' : 'native_pipeline');
    onConfirmResume(inspectResult.connection_id, chosen, pathway);
  };

  const handleBypassInspection = () => {
    const fallbackConnId = `conn_${data.connector_type}_${Math.random().toString(36).substring(2, 9)}`;
    const defaultTables = ['source_crm.customers', 'source_crm.orders', 'source_crm.order_items', 'source_crm.products'];
    const pathway = data.pathway || (data.is_fabric_native === false ? 'pyspark_notebook' : 'native_pipeline');
    onConfirmResume(fallbackConnId, defaultTables, pathway);
  };

  // Simplified title: PostgreSQL / Neon
  const displayName = data.name.includes('PostgreSQL') ? 'PostgreSQL / Neon' : data.name;

  // Filter tables for display
  const allDiscovered = inspectResult?.discovered_tables || [];
  const projectScopeCount = allDiscovered.filter((t) => isTargetTable(t)).length || 4;
  const selectedCount = Object.values(selectedTables).filter(Boolean).length;

  const displayedTables = allDiscovered.filter((t) => {
    const key = getTableKey(t);
    if (activeTab === 'project' && !isTargetTable(t) && !selectedTables[key]) {
      return false;
    }
    if (tableFilter.trim()) {
      const q = tableFilter.toLowerCase();
      return key.toLowerCase().includes(q) || (t.schema && t.schema.toLowerCase().includes(q));
    }
    return true;
  });

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 100050 }}
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-3xl bg-[#141416] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-sans select-none animate-in zoom-in-95 duration-150"
        style={{ position: 'relative', zIndex: 100051, maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="h-15 px-6 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-md">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">{displayName}</h2>
              <p className="text-[11.5px] text-zinc-400">Database Connection & Schema Inspector</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="px-6 py-2 bg-white/[0.02] border-b border-white/[0.06] flex items-center gap-2 text-[11.5px] text-zinc-400 shrink-0">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>
            Credentials are securely registered in the Fabric connection vault and excluded from AI prompt history.
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto min-h-0 flex-1">
          {!inspectResult ? (
            <form onSubmit={handleRunInspection} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {data.required_params.map((param) => {
                  const isPass = param.type === 'password';
                  const showPass = showPasswords[param.key];
                  const isFullWidth = param.key === 'connection_url' || param.key === 'endpoint_url';

                  return (
                    <div key={param.key} className={`space-y-1.5 ${isFullWidth ? 'md:col-span-2' : ''}`}>
                      <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                        <span>
                          {param.label} {param.required && <span className="text-rose-400">*</span>}
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={isPass && !showPass ? 'password' : 'text'}
                          value={formData[param.key] || ''}
                          onChange={(e) => {
                            setFormData({ ...formData, [param.key]: e.target.value });
                          }}
                          placeholder={param.placeholder}
                          required={param.required}
                          className="w-full bg-[#18181b] border border-white/10 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 font-mono transition-all"
                        />
                        {isPass && (
                          <button
                            type="button"
                            onClick={() => handleTogglePassword(param.key)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                          >
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {inspectError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{inspectError}</span>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleBypassInspection}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20222a] hover:bg-[#282a35] text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-all cursor-pointer"
                    >
                      <span>Proceed with Cloud Gateway & Skip Local Inspection</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-zinc-300 font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInspecting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isInspecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Discovered Tables & Inspection Result - Single Row Layout */
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Subtle 1-line connection verified banner */}
              <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Connected successfully • <strong>{allDiscovered.length} tables</strong> discovered ({selectedCount} pre-selected for project)
                  </span>
                </div>
                <span className="font-mono text-[11px] text-emerald-400/80">
                  {inspectResult.connection_id}
                </span>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1 bg-[#18181b] p-0.5 rounded-lg border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('project')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === 'project'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Project Scope ({projectScopeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === 'all'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    All Discovered ({allDiscovered.length})
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={tableFilter}
                      onChange={(e) => setTableFilter(e.target.value)}
                      placeholder="Filter tables..."
                      className="w-44 bg-[#18181b] border border-white/10 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-zinc-500 font-mono focus:border-blue-500/60 focus:ring-0"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="text-zinc-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Single-Row Clean Table List */}
              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#18181b]/50">
                <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
                  {displayedTables.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-500">
                      No tables match the current filter.
                    </div>
                  ) : (
                    displayedTables.map((t: DiscoveredSourceTable) => {
                      const tableKey = getTableKey(t);
                      const isChecked = Boolean(selectedTables[tableKey]);
                      const isProject = isTargetTable(t);

                      return (
                        <div
                          key={tableKey}
                          onClick={() => handleToggleTable(tableKey)}
                          className={`h-10 px-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-blue-500/[0.08] hover:bg-blue-500/[0.12]'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by row onClick
                              className="rounded border-white/20 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                            <span
                              className={`text-xs font-mono truncate ${
                                isChecked ? 'text-white font-medium' : 'text-zinc-300'
                              }`}
                            >
                              {tableKey}
                            </span>
                            {isProject && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 font-sans font-medium">
                                Target Entity
                              </span>
                            )}
                          </div>

                          <div className="text-[11.5px] text-zinc-400 font-mono shrink-0 ml-4">
                            {t.est_rows !== undefined ? `${t.est_rows.toLocaleString()} rows` : ''}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setInspectResult(null)}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  ← Edit Connection
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">
                    <strong>{selectedCount}</strong> of {allDiscovered.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmAndResume}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                  >
                    <span>Confirm Selected ({selectedCount})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
