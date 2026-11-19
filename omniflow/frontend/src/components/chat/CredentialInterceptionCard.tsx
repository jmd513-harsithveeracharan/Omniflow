import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Code2,
  ChevronDown,
  ChevronUp,
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
  const [showCode, setShowCode] = useState<boolean>(false);
  const [usedDemoPresets, setUsedDemoPresets] = useState<boolean>(false);

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

  const handleFillDemo = () => {
    setFormData({ ...data.sample_presets });
    setUsedDemoPresets(true);
    setInspectError(null);
  };

  const handleTogglePassword = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInspecting(true);
    setInspectError(null);

    try {
      const res = await provisionAndInspectConnector(data.connector_type, formData, usedDemoPresets);
      setInspectResult(res);
      const initialSelected: Record<string, boolean> = {};
      res.discovered_tables.forEach((t) => {
        initialSelected[getTableKey(t)] = true;
      });
      setSelectedTables(initialSelected);
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
    const next: Record<string, boolean> = {};
    inspectResult.discovered_tables.forEach((t) => {
      next[getTableKey(t)] = select;
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

    const pathway = inspectResult.pathway || data.pathway || (data.is_fabric_native === false ? 'pyspark_notebook' : 'native_pipeline');
    onConfirmResume(inspectResult.connection_id, chosen, pathway);
  };

  const handleImportAllAndResume = () => {
    if (!inspectResult) return;
    const allTables = inspectResult.discovered_tables.map((t) => getTableKey(t));
    if (allTables.length === 0) return;
    const pathway = inspectResult.pathway || data.pathway || (data.is_fabric_native === false ? 'pyspark_notebook' : 'native_pipeline');
    onConfirmResume(inspectResult.connection_id, allTables, pathway);
  };

  const handleBypassInspection = () => {
    const fallbackConnId = `conn_${data.connector_type}_${Math.random().toString(36).substring(2, 9)}`;
    const defaultTables = ['primary_table', 'reference_data'];
    const pathway = data.pathway || (data.is_fabric_native === false ? 'pyspark_notebook' : 'native_pipeline');
    onConfirmResume(fallbackConnId, defaultTables, pathway);
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 100050 }}
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-2xl bg-[#141416] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-sans select-none animate-in zoom-in-95 duration-150"
        style={{ position: 'relative', zIndex: 100051, maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-md">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-wide">{data.name}</h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  {data.category}
                </span>
              </div>
              <p className="text-[11.5px] text-zinc-400">Microsoft Fabric Dynamic Connector & Schema Inspector</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFillDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg transition-all shadow-sm cursor-pointer"
              title="Pre-populate with realistic demo credentials for instant testing"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Use Sandbox Demo</span>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close dialog (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="px-6 py-2.5 bg-blue-500/[0.06] border-b border-blue-500/15 flex items-center gap-2 text-[11.5px] text-blue-300">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>
            <strong className="text-white font-medium">Zero Secret Leakage Guarantee:</strong> Credentials are sent securely to the Fabric Connection Vault and are strictly excluded from AI prompt history.
          </span>
        </div>

        {/* Ingestion Pathway Indicator Banner */}
        {data.is_fabric_native === false ? (
          <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-[11px] text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Custom PySpark Ingestion:</strong> Fabric lacks a native Copy connector for {data.name}. An automated PySpark ingestion notebook will be provisioned.
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono whitespace-nowrap">
              PySpark Notebook
            </span>
          </div>
        ) : (
          <div className="px-6 py-2 bg-sky-500/[0.07] border-b border-sky-500/15 flex items-center justify-between text-[11px] text-sky-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span><strong>Fabric Native Connector:</strong> Serverless Data Pipeline Copy Activity supported</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">/v1/connections</span>
          </div>
        )}

        {/* Modal Body: Form or Discovered Tables */}
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
                            setUsedDemoPresets(false);
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
                      <span>Running Dynamic Python Inspector...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Test Connection & Inspect Tables</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Discovered Tables & Inspection Result */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-emerald-200">
                      Connection Verified & Registered in Fabric Vault
                    </div>
                    <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5">
                      Reference ID: <span className="bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 text-white">{inspectResult.connection_id}</span>
                      <span className="mx-2 text-zinc-500">•</span>
                      Gateway: {inspectResult.gateway}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg border border-white/10 transition-all cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>{showCode ? 'Hide Script' : 'View Python Script'}</span>
                  {showCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Collapsible Python Inspector Code */}
              {showCode && (
                <div className="p-3.5 bg-[#0e0e10] rounded-xl border border-white/10 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-48">
                  <div className="text-[10px] uppercase text-zinc-500 font-semibold mb-1">
                    Python Schema Introspection Script (Executed on-the-fly)
                  </div>
                  <pre className="text-emerald-400 leading-relaxed whitespace-pre">{inspectResult.python_inspector_code}</pre>
                </div>
              )}

              {/* Table Selection Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-200">
                    Discovered Tables ({inspectResult.discovered_tables.length}) — Select for Bronze Ingestion:
                  </span>
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

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {inspectResult.discovered_tables.map((t: DiscoveredSourceTable) => {
                    const tableKey = getTableKey(t);
                    const isChecked = Boolean(selectedTables[tableKey]);

                    return (
                      <div
                        key={tableKey}
                        onClick={() => handleToggleTable(tableKey)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-blue-500/10 border-blue-500/40 text-white'
                            : 'bg-[#18181b] border-white/10 text-zinc-400 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent onClick
                            className="rounded border-white/20 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <div>
                            <div className="font-mono font-medium text-zinc-200 flex items-center flex-wrap gap-1.5">
                              <span>{tableKey}</span>
                              {t.pk && t.pk.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  PK: {t.pk.join(', ')}
                                </span>
                              )}
                              {t.watermark && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  WM: {t.watermark}
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <div className="text-[11px] text-zinc-400">{t.description}</div>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-zinc-400 font-mono shrink-0 ml-2">
                          {t.est_rows !== undefined ? `${t.est_rows.toLocaleString()} rows` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm & Resume Footer */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setInspectResult(null)}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  ← Edit Connection Parameters
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleImportAllAndResume}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 text-xs font-medium transition-all cursor-pointer"
                  >
                    <span>Import All ({inspectResult.discovered_tables.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmAndResume}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                  >
                    <span>Confirm Selected ({Object.values(selectedTables).filter(Boolean).length})</span>
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
