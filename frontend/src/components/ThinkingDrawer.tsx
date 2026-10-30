import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  BrainCircuit,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { ThinkingStep } from '../types';

interface ThinkingDrawerProps {
  steps?: ThinkingStep[];
  isThinking?: boolean;
}

export const ThinkingDrawer: React.FC<ThinkingDrawerProps> = ({
  steps = [],
  isThinking = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const getStatusIcon = (status: ThinkingStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-brand-cyan animate-spin shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  return (
    <div className="border-t border-border bg-[#0a0f1d] backdrop-blur-xl transition-all duration-300">
      {/* Drawer Toggle Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-surface-hover text-xs text-slate-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-cyan">
            <BrainCircuit className="w-3 h-3" />
          </div>
          <span className="font-semibold text-white tracking-wide flex items-center gap-2">
            AI Thought Stream & Reasoning Trace
            {isThinking && (
              <span className="flex items-center gap-1 text-[10px] text-brand-cyan font-mono px-1.5 py-0.5 rounded bg-brand-primary/10 border border-brand-primary/20">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                Active Node Execution
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 font-mono">
            {steps.filter((s) => s.status === 'completed').length} / {steps.length} Steps Complete
          </span>
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded Reasoning Step List */}
      {isOpen && (
        <div className="px-4 py-3 border-t border-border/50 max-h-48 overflow-y-auto space-y-2 font-mono text-xs">
          {steps.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
              {isThinking ? 'Agent reasoning in progress...' : 'No reasoning traces currently active.'}
            </div>
          ) : (
            steps.map((step) => (
              <div
                key={step.id}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-card/60 border border-border/40 hover:border-border transition-all"
              >
                <div className="mt-0.5">{getStatusIcon(step.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200 truncate">{step.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {step.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-brand-primary/20 text-brand-cyan border border-brand-primary/30">
                          {step.badge}
                        </span>
                      )}
                      {step.latencyMs !== undefined && (
                        <span className="text-[10px] text-slate-500">{step.latencyMs}ms</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans mt-0.5 leading-snug">{step.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
