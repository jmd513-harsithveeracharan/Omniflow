import React from 'react';
import {
  Database,
  ShieldCheck,
  Terminal,
  Layers,
  Sparkles,
  BookOpen,
  Server,
  ShieldAlert,
  Play,
} from 'lucide-react';
import { FabricStatus } from '../types';

interface HeaderProps {
  status: FabricStatus | null;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onNewSession: () => void;
  onOpenSkills: () => void;
  onOpenConnectors: () => void;
  onOpenGovernance: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  activeTab,
  onSelectTab,
  onNewSession,
  onOpenSkills,
  onOpenConnectors,
  onOpenGovernance,
}) => {
  return (
    <header className="h-14 border-b border-border bg-surface-card backdrop-blur-glass flex items-center justify-between px-4 z-20 shrink-0">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-primary to-brand-cyan flex items-center justify-center shadow-lg shadow-brand-primary/20">
          <Sparkles className="w-4 h-4 text-white animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            Fabric AI Studio
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-primary/20 text-brand-cyan border border-brand-primary/30">
              v2.0 Enterprise
            </span>
          </h1>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border">
        <button
          onClick={() => onSelectTab('architect')}
          className={`flex items-center gap-1.5 px-3 py-1.2 rounded-md text-xs font-medium transition-all ${
            activeTab === 'architect'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Medallion Studio
        </button>

        <button
          onClick={() => onSelectTab('deployment')}
          className={`flex items-center gap-1.5 px-3 py-1.2 rounded-md text-xs font-medium transition-all ${
            activeTab === 'deployment'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          Deployment Workbench
        </button>

        <button
          onClick={() => onSelectTab('transpiler')}
          className={`flex items-center gap-1.5 px-3 py-1.2 rounded-md text-xs font-medium transition-all ${
            activeTab === 'transpiler'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          SQL Transpiler
        </button>

        <button
          onClick={() => onSelectTab('lineage')}
          className={`flex items-center gap-1.5 px-3 py-1.2 rounded-md text-xs font-medium transition-all ${
            activeTab === 'lineage'
              ? 'bg-brand-primary text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          DAG Lineage
        </button>
      </div>

      {/* Studio Action Tools & Modals */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenConnectors}
          className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-slate-300 hover:text-white border border-border text-xs flex items-center gap-1.5 transition-all"
          title="Discover external source tables"
        >
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          Connectors
        </button>

        <button
          onClick={onOpenSkills}
          className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-slate-300 hover:text-white border border-border text-xs flex items-center gap-1.5 transition-all"
          title="Inspect 9 Fabric domain skills"
        >
          <BookOpen className="w-3.5 h-3.5 text-brand-cyan" />
          Skills
        </button>

        <button
          onClick={onOpenGovernance}
          className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-slate-300 hover:text-white border border-border text-xs flex items-center gap-1.5 transition-all"
          title="Blast-radius impact analysis"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          Blast Radius
        </button>

        {status && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700/50 text-xs ml-1">
            <span
              className={`w-2 h-2 rounded-full ${
                status.authenticated ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300 font-mono text-[11px]">
              {status.authenticated ? `WS: ${status.workspaceId.slice(0, 8)}...` : 'Offline Mode'}
            </span>
          </div>
        )}

        <button
          onClick={onNewSession}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-brand-primary/25 transition-all active:scale-95 ml-1"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          New Thread
        </button>
      </div>
    </header>
  );
};
