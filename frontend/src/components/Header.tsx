import React from 'react';
import { Database, ShieldCheck, Terminal, Layers, Sparkles } from 'lucide-react';
import { FabricStatus } from '../types';

interface HeaderProps {
  status: FabricStatus | null;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onNewSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  activeTab,
  onSelectTab,
  onNewSession,
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
              v2.0 Native
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

      {/* Fabric Status Badge & Action */}
      <div className="flex items-center gap-3">
        {status && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700/50 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                status.authenticated ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300 font-mono text-[11px]">
              {status.authenticated ? `Workspace: ${status.workspaceId.slice(0, 8)}...` : 'Offline Mode'}
            </span>
          </div>
        )}

        <button
          onClick={onNewSession}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-primary to-indigo-600 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-brand-primary/25 transition-all active:scale-95"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          New Thread
        </button>
      </div>
    </header>
  );
};
