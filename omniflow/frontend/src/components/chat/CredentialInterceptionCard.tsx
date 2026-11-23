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

function parseConnectionUrl(raw: string) {
  try {
    const trimmed = raw.trim();
    if (!trimmed.includes('://')) return null;
    const clean = trimmed.replace(/^postgresql:\/\//i, 'http://').replace(/^postgres:\/\//i, 'http://');
    const u = new URL(clean);
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username || ''),
      pass: decodeURIComponent(u.password || ''),
      db: u.pathname.replace(/^\//, '') || '',
      sslmode: u.searchParams.get('sslmode') || 'require',
    };
  } catch {
    return null;
  }
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

  const [inputMode, setInputMode] = useState<'url' | 'manual'>('url');
  const [connectionUrl, setConnectionUrl] = useState<string>(() => formData.connection_url || '');

  const handleUrlChange = (urlStr: string) => {
    setConnectionUrl(urlStr);
    const parsed = parseConnectionUrl(urlStr);
    if (parsed) {
      setFormData((prev) => ({
        ...prev,
        connection_url: urlStr,
        host: parsed.host,
        port: parsed.port,
        database: parsed.db,
        username: parsed.user,
        password: parsed.pass,
        sslmode: parsed.sslmode,
      }));
    } else {
      setFormData((prev) => ({ ...prev, connection_url: urlStr }));
    }
  };

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

      // Smart Auto-Discovery: Pre-select ONLY project-relevant target tables
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
      className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 100050 }}
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-4xl bg-gradient-to-b from-[#18181c] to-[#101014] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-sans select-none ring-1 ring-white/5 animate-in zoom-in-95 duration-150"
        style={{ position: 'relative', zIndex: 100051, maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Spacious, Generous Header (Dark Grey Theme - No Blue Background) */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/10 text-zinc-200 flex items-center justify-center shadow-lg shadow-black/40">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-[18px] font-semibold text-white tracking-tight">{displayName}</h3>
              <p className="text-[13px] text-zinc-400 mt-0.5">
                {data.category || 'Enterprise Data Source'} • Microsoft Fabric Connection & Schema Inspector
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close dialog (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body with Generous Padding */}
        <div className="px-8 pb-8 pt-5 overflow-y-auto min-h-0 flex-1">
          {/* Subtle Security Pill */}
          <div className="flex items-center gap-2.5 text-[12px] text-zinc-400 mb-6 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Credentials are encrypted in the Fabric vault and strictly excluded from AI prompt history.
            </span>
          </div>

          {!inspectResult ? (
            <form onSubmit={handleRunInspection} className="space-y-5">
              {/* Connection Mode Switcher */}
              <div className="flex items-center gap-2 p-1 bg-white/[0.04] rounded-xl border border-white/[0.08] w-fit">
                <button
                  type="button"
                  onClick={() => setInputMode('url')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    inputMode === 'url' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ⚡ Connection URL (Neon / Cloud)
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('manual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    inputMode === 'manual' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Manual Parameters
                </button>
              </div>

              {inputMode === 'url' ? (
                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>Database Connection URL <span className="text-rose-400">*</span></span>
                    <span className="text-[11px] text-zinc-500 font-mono">postgresql://user:pass@host/db</span>
                  </label>
                  <input
                    type="text"
                    value={connectionUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
                    className="w-full bg-[#16171a] border border-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/20 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-500 font-mono transition-all"
                    required
                  />
                  <p className="text-[11.5px] text-zinc-400 leading-relaxed">
                    Pasting your database URL automatically populates the host, port, credentials, and SSL settings.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.required_params
                    .filter((param) => param.key !== 'connection_url')
                    .map((param) => {
                      const isPass = param.type === 'password';
                      const showPass = showPasswords[param.key];
                      const isFullWidth = param.key === 'endpoint_url';

                      return (
                        <div key={param.key} className={`space-y-1.5 ${isFullWidth ? 'md:col-span-2' : ''}`}>
                          <label className="text-[11.5px] font-medium text-zinc-300 flex items-center justify-between">
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
                              className="w-full bg-[#16171a] border border-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/20 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 font-mono transition-all"
                            />
                            {isPass && (
                              <button
                                type="button"
                                onClick={() => handleTogglePassword(param.key)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                              >
                                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {inspectError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2.5">
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

              {/* Action Buttons: Clean Dark/Neutral Theme */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-zinc-300 font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInspecting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg shadow-black/20 transition-all disabled:opacity-50 cursor-pointer"
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
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Subtle 1-line connection verified banner */}
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs text-emerald-300">
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
                <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('project')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'project'
                        ? 'bg-[#25262c] text-white shadow-sm border border-white/10'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Project Scope ({projectScopeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'all'
                        ? 'bg-[#25262c] text-white shadow-sm border border-white/10'
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
                      className="w-48 bg-[#16171a] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 font-mono focus:border-white/30 focus:ring-0"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="text-zinc-300 hover:text-white hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="text-zinc-400 hover:text-zinc-200 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Single-Row Clean Table List */}
              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-black/20">
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
                          className={`h-10 px-4 flex items-center justify-between transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-white/[0.05] hover:bg-white/[0.08]'
                              : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by row onClick
                              className="accent-zinc-100 rounded cursor-pointer"
                            />
                            <span
                              className={`text-xs font-mono truncate ${
                                isChecked ? 'text-white font-medium' : 'text-zinc-300'
                              }`}
                            >
                              {tableKey}
                            </span>
                            {isProject && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-sans font-medium">
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

              {/* Bottom Actions: Clean Dark/Neutral Theme */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setInspectResult(null)}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  ← Edit Connection
                </button>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-400">
                    <strong>{selectedCount}</strong> of {allDiscovered.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmAndResume}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg shadow-black/20 transition-all cursor-pointer"
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
