import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  Database,
  Layers,
  FileCode,
  Sparkles,
  Archive,
} from 'lucide-react';
import { BlastRadiusReport } from '../types';

interface GovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: BlastRadiusReport | null;
}

export const GovernanceModal: React.FC<GovernanceModalProps> = ({
  isOpen,
  onClose,
  report = null,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !report) return null;
  const activeReport = report;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0c1222] border border-rose-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Hazard Colors */}
        <div className="h-14 px-6 border-b border-rose-500/30 flex items-center justify-between bg-rose-950/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                Blast-Radius Impact & Safe Governance Gate
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {activeReport.riskLevel} Risk
                </span>
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-surface hover:bg-surface-hover text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Warning Banner */}
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-rose-300 mb-1">Downstream Impact Warning</p>
              <p className="text-slate-300 leading-relaxed">{activeReport.warningMessage}</p>
            </div>
          </div>

          {/* Impacted Downstream Assets */}
          <div>
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-cyan" />
              Impacted Downstream Lineage Nodes ({activeReport.affectedNodes.length})
            </h3>
            <div className="space-y-2">
              {activeReport.affectedNodes.map((node) => (
                <div
                  key={node.id}
                  className="p-3 rounded-lg bg-surface-card border border-border flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span className="font-mono text-slate-200">{node.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface border border-border text-slate-400">
                    {node.layer} layer
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Impacted Pipelines & Reports */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-surface/50 border border-border">
              <span className="text-[11px] font-medium text-slate-400 block mb-1.5">Affected Data Pipelines</span>
              <ul className="space-y-1 text-xs text-slate-300 font-mono">
                {activeReport.affectedPipelines.map((p) => (
                  <li key={p} className="flex items-center gap-1.5 truncate">
                    <FileCode className="w-3 h-3 text-cyan-400 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-surface/50 border border-border">
              <span className="text-[11px] font-medium text-slate-400 block mb-1.5">Affected Power BI Reports</span>
              <ul className="space-y-1 text-xs text-slate-300">
                {activeReport.affectedReports.map((r) => (
                  <li key={r} className="flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Safety Checkpoint Gate */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Archive className="w-4 h-4 text-emerald-400" />
              <span>Automatic Snapshot Backup will be saved to <span className="font-mono text-cyan-300">_snapshots/</span></span>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="rounded border-slate-600 bg-surface text-brand-primary focus:ring-brand-primary"
              />
              <span>I confirm and authorize this modification with blast-radius awareness.</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/70 bg-surface-card flex items-center justify-between shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover text-xs text-slate-300 border border-border">
            Cancel Operation
          </button>
          <button
            onClick={onClose}
            disabled={!confirmed}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all"
          >
            Approve & Proceed
          </button>
        </div>
      </div>
    </div>
  );
};
