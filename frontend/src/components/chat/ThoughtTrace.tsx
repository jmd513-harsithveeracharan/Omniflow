import React, { useState } from 'react';
import { ChevronRight, Loader2, CheckCircle2, BrainCircuit } from 'lucide-react';
import { ThoughtMeta, ThoughtStep } from '../../types';

export type { ThoughtMeta, ThoughtStep };

interface ThoughtTraceProps {
  meta: ThoughtMeta;
  isStreaming?: boolean;
}

export const ThoughtTrace: React.FC<ThoughtTraceProps> = ({ meta, isStreaming = false }) => {
  // Auto-open during streaming, collapsable after done
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const isOpen = userToggled !== null ? userToggled : (isStreaming || false);

  const completedCount = meta.steps.filter((s) => s.status === 'completed').length;
  const totalCount = meta.steps.length;
  const isAnyInProgress = isStreaming || meta.steps.some((s) => s.status === 'in_progress');

  return (
    <div className="chat-thought-wrapper-inline" style={{ width: '100%', marginBottom: '10px' }}>
      <button
        type="button"
        className="agent-thought-toggle"
        onClick={() => setUserToggled(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(56, 189, 248, 0.06)',
          border: '1px solid rgba(56, 189, 248, 0.18)',
          padding: '5px 10px',
          cursor: 'pointer',
          color: isAnyInProgress ? '#38bdf8' : '#a1a1aa',
          fontSize: '12px',
          fontFamily: 'var(--font-sans, "Google Sans Text", sans-serif)',
          borderRadius: '6px',
          transition: 'all 0.2s ease',
        }}
      >
        <ChevronRight
          width={13}
          height={13}
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            color: isAnyInProgress ? '#38bdf8' : '#71717a',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isAnyInProgress ? (
            <Loader2 width={13} height={13} className="animate-spin" style={{ color: '#38bdf8' }} />
          ) : (
            <BrainCircuit width={13} height={13} style={{ color: '#10b981' }} />
          )}
          <span style={{ fontWeight: 600 }}>
            {isAnyInProgress
              ? `Reasoning Trace (${completedCount}/${totalCount || 1} steps)...`
              : `Thought for ${meta.elapsed || '18.4'}s`}
          </span>
        </div>
      </button>

      {isOpen && (
        <div
          className="agent-thought-body"
          style={{
            marginTop: '8px',
            padding: '12px 16px',
            background: 'rgba(10, 15, 29, 0.75)',
            backdropFilter: 'blur(12px)',
            borderRadius: '8px',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
        >
          {meta.steps.map((st, idx) => {
            const isCompleted = st.status === 'completed';
            const isInProgress = st.status === 'in_progress';
            return (
              <div
                key={idx}
                className={`agent-working-step ${isCompleted ? 'completed' : 'in_progress'}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  padding: '4px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isCompleted ? (
                    <CheckCircle2 width={14} height={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  ) : isInProgress ? (
                    <Loader2 width={14} height={14} className="animate-spin" style={{ color: '#38bdf8', flexShrink: 0 }} />
                  ) : (
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'inline-block' }} />
                  )}
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: isInProgress ? 700 : 600,
                      color: isCompleted ? '#e4e4e7' : isInProgress ? '#38bdf8' : '#71717a',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {st.title}
                  </span>
                </div>
                {st.detail && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: isCompleted ? '#94a3b8' : '#cbd5e1',
                      paddingLeft: '22px',
                      lineHeight: '1.45',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  >
                    {st.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
