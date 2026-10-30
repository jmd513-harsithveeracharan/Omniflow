import React, { useState } from 'react';
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

  const handleFillDemo = () => {
    setFormData({ ...data.sample_presets });
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
      const res = await provisionAndInspectConnector(data.connector_type, formData, true);
      setInspectResult(res);
      // Pre-select all discovered tables
      const initialSelected: Record<string, boolean> = {};
      res.discovered_tables.forEach((t) => {
        initialSelected[t.name] = true;
      });
      setSelectedTables(initialSelected);
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsInspecting(false);
    }
  };

  const handleToggleTable = (name: string) => {
    setSelectedTables((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleSelectAll = (select: boolean) => {
    if (!inspectResult) return;
    const next: Record<string, boolean> = {};
    inspectResult.discovered_tables.forEach((t) => {
      next[t.name] = select;
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

  const handleBypassInspection = () => {
    const fallbackConnId = `conn_${data.connector_type}_${Math.random().toString(36).substring(2, 9)}`;
    const defaultTables = ['primary_table', 'reference_data'];
    const pathway = data.pathway || (data.is_fabric_native === false ? 'pyspark_notebook' : 'native_pipeline');
    onConfirmResume(fallbackConnId, defaultTables, pathway);
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-3 px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#181a1f] border border-[#0078d4]/40 rounded-xl shadow-2xl shadow-[#0078d4]/10 overflow-hidden backdrop-blur-md">
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#0078d4]/20 via-[#181a1f] to-transparent border-b border-[#2d3139] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0078d4]/20 border border-[#0078d4]/40 flex items-center justify-center text-[#38bdf8]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-wide">{data.name}</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#0078d4]/20 text-[#38bdf8] border border-[#0078d4]/30">
                  {data.category}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Microsoft Fabric Dynamic Connector & Schema Inspector</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFillDemo}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#1e232d] hover:bg-[#282f3d] text-[#38bdf8] border border-[#38bdf8]/30 rounded-md transition-all shadow-sm"
              title="Pre-populate with realistic demo credentials for instant testing"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>⚡ Use Sandbox Demo Credentials</span>
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="px-5 py-2 bg-[#0078d4]/10 border-b border-[#0078d4]/20 flex items-center gap-2 text-[11px] text-[#38bdf8]">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span>
            <strong>Zero Secret Leakage Guarantee:</strong> Credentials are sent securely to the Fabric Connection Vault and are strictly excluded from AI prompt history.
          </span>
        </div>

        {/* Ingestion Pathway Indicator Banner */}
        {data.is_fabric_native === false ? (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-[11px] text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Custom PySpark Notebook Ingestion:</strong> Microsoft Fabric does not provide a native Copy connector for {data.name}. OmniFlow will synthesize an automated PySpark Ingestion Notebook with API/driver extraction into Bronze Lakehouse.
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono whitespace-nowrap">
              PySpark Notebook
            </span>
          </div>
        ) : (
          <div className="px-5 py-2 bg-sky-500/10 border-b border-sky-500/20 flex items-center justify-between text-[11px] text-sky-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span><strong>Fabric Native Connector:</strong> Serverless Data Pipeline Copy Activity supported</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">/v1/connections</span>
          </div>
        )}

        {/* Form Body or Discovered Tables */}
        <div className="p-5">
          {!inspectResult ? (
            <form onSubmit={handleRunInspection} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {data.required_params.map((param) => {
                  const isPass = param.type === 'password';
                  const showPass = showPasswords[param.key];

                  return (
                    <div key={param.key} className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
                        <span>{param.label} {param.required && <span className="text-rose-400">*</span>}</span>
                      </label>
                      <div className="relative">
                        <input
                          type={isPass && !showPass ? 'password' : 'text'}
                          value={formData[param.key] || ''}
                          onChange={(e) => setFormData({ ...formData, [param.key]: e.target.value })}
                          placeholder={param.placeholder}
                          required={param.required}
                          className="w-full bg-[#111317] border border-[#2d3139] focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono transition-all"
                        />
                        {isPass && (
                          <button
                            type="button"
                            onClick={() => handleTogglePassword(param.key)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
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
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{inspectError}</span>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleBypassInspection}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-all"
                    >
                      <span>Proceed with Cloud Gateway & Skip Local Inspection</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="px-3.5 py-1.5 rounded-lg border border-[#2d3139] hover:bg-slate-800 text-xs text-slate-300 font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInspecting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0078d4] hover:bg-[#1084d8] text-white text-xs font-semibold shadow-lg shadow-[#0078d4]/20 transition-all disabled:opacity-50"
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
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-emerald-200">
                      Connection Verified & Registered in Fabric Vault
                    </div>
                    <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5">
                      Reference ID: <span className="bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 text-white">{inspectResult.connection_id}</span>
                      <span className="mx-2 text-slate-500">•</span>
                      Gateway: {inspectResult.gateway}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-all"
                >
                  <Code2 className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>{showCode ? 'Hide Python Inspector' : 'View Python Script'}</span>
                  {showCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {/* Collapsible Python Inspector Code */}
              {showCode && (
                <div className="p-3 bg-[#0d0e11] rounded-lg border border-[#2d3139] text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">
                    Python Schema Introspection Script (Executed on-the-fly)
                  </div>
                  <pre className="text-emerald-400 leading-relaxed whitespace-pre">{inspectResult.python_inspector_code}</pre>
                </div>
              )}

              {/* Table Selection Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-200">
                    Discovered Tables ({inspectResult.discovered_tables.length}) — Select tables to ingest into Bronze Lakehouse:
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(true)}
                      className="text-[#38bdf8] hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => handleSelectAll(false)}
                      className="text-slate-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {inspectResult.discovered_tables.map((t: DiscoveredSourceTable) => {
                    const isChecked = Boolean(selectedTables[t.name]);

                    return (
                      <div
                        key={t.name}
                        onClick={() => handleToggleTable(t.name)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-[#0078d4]/10 border-[#0078d4]/40 text-white'
                            : 'bg-[#111317] border-[#2d3139] text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent onClick
                            className="rounded border-[#2d3139] text-[#0078d4] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <div>
                            <div className="font-mono font-medium text-slate-200 flex items-center gap-2">
                              <span>{t.schema}.{t.name}</span>
                              {t.pk && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  PK: {t.pk.join(', ')}
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <div className="text-[11px] text-slate-400">{t.description}</div>
                            )}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          {t.est_rows ? `~${t.est_rows.toLocaleString()} rows` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm & Resume Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[#2d3139]">
                <button
                  type="button"
                  onClick={() => setInspectResult(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  ← Edit Connection Parameters
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndResume}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0078d4] hover:bg-[#1084d8] text-white text-xs font-semibold shadow-lg shadow-[#0078d4]/20 transition-all"
                >
                  <span>Confirm Tables & Synthesize Pipeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
