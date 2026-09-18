import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { ThoughtMeta, ThoughtStep } from '../../types';

export type { ThoughtMeta, ThoughtStep };

interface ThoughtTraceProps {
  meta: ThoughtMeta;
  isStreaming?: boolean;
}

const getBadgeStyle = (badge: string): React.CSSProperties => {
  const b = badge.toUpperCase();
  if (b === 'PY' || b === 'PYTHON') {
    return {
      background: 'rgba(56, 189, 248, 0.12)',
      color: '#38bdf8',
      border: '1px solid rgba(56, 189, 248, 0.25)',
    };
  }
  if (b === 'TS' || b === 'JS') {
    return {
      background: 'rgba(96, 165, 250, 0.12)',
      color: '#60a5fa',
      border: '1px solid rgba(96, 165, 250, 0.25)',
    };
  }
  if (b === 'SQL') {
    return {
      background: 'rgba(192, 132, 252, 0.12)',
      color: '#c084fc',
      border: '1px solid rgba(192, 132, 252, 0.25)',
    };
  }
  if (b === 'DAG' || b === 'DELTA') {
    return {
      background: 'rgba(52, 211, 153, 0.12)',
      color: '#34d399',
      border: '1px solid rgba(52, 211, 153, 0.25)',
    };
  }
  if (b === 'CLI' || b === 'TERMINAL') {
    return {
      background: 'rgba(148, 163, 184, 0.12)',
      color: '#cbd5e1',
      border: '1px solid rgba(148, 163, 184, 0.25)',
    };
  }
  return {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#e2e8f0',
    border: '1px solid rgba(255, 255, 255, 0.15)',
  };
};

const renderDiff = (diffStr: string) => {
  const parts = diffStr.split(' ');
  return (
    <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      {parts.map((p, idx) => {
        if (p.startsWith('+')) {
          return (
            <span key={idx} style={{ color: '#10b981', fontWeight: 600 }}>
              {p}
            </span>
          );
        }
        if (p.startsWith('-')) {
          return (
            <span key={idx} style={{ color: '#f43f5e', fontWeight: 600 }}>
              {p}
            </span>
          );
        }
        return (
          <span key={idx} style={{ color: '#94a3b8' }}>
            {p}
          </span>
        );
      })}
    </span>
  );
};

export const ThoughtTrace: React.FC<ThoughtTraceProps> = ({ meta, isStreaming = false }) => {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Auto-open during streaming or if user hasn't explicitly closed it
  const isOpen = userToggled !== null ? userToggled : true;

  // Live timer tick during streaming
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const steps = meta.steps || [];
  if (steps.length === 0 && !isStreaming) return null;

  const displayTime = isStreaming
    ? `${elapsedSeconds}s`
    : meta.elapsed
    ? `${meta.elapsed}s`
    : `${Math.max(1, elapsedSeconds)}s`;

  return (
    <div
      className="antigravity-thought-container"
      style={{
        width: '100%',
        marginBottom: '10px',
        fontFamily: 'var(--font-sans, "Google Sans Text", system-ui, sans-serif)',
      }}
    >
      {/* 1. Sleek Antigravity Header Toggle */}
      <button
        type="button"
        onClick={() => setUserToggled(!isOpen)}
        className="antigravity-thought-header"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          padding: '3px 6px',
          cursor: 'pointer',
          color: isStreaming ? '#38bdf8' : '#94a3b8',
          fontSize: '12.5px',
          borderRadius: '4px',
          transition: 'all 0.15s ease',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
          {isOpen ? <ChevronDown width={13} height={13} /> : <ChevronRight width={13} height={13} />}
        </span>

        {isStreaming && (
          <Loader2 width={12} height={12} className="animate-spin" style={{ color: '#38bdf8' }} />
        )}

        <span style={{ fontWeight: 500, color: isStreaming ? '#e2e8f0' : '#94a3b8' }}>
          {`Worked for ${displayTime}`}
        </span>
      </button>

      {/* 2. Activity Stream Rows */}
      {isOpen && (
        <div
          className="antigravity-activity-list"
          style={{
            marginTop: '4px',
            paddingLeft: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {steps.map((st, idx) => {
            const isCompleted = st.status === 'completed';
            const isInProgress = st.status === 'in_progress';
            const hasDetailOrOutput = Boolean(st.detail || st.output);
            const isRowExpanded = Boolean(expandedRows[idx]);

            // Parse or fallback fields
            const action = st.action || st.title.split(' ')[0] || 'Processed';
            const target =
              st.target ||
              (st.title.includes(':') ? st.title.split(':')[1].trim() : st.title.replace(action, '').trim()) ||
              st.title;

            return (
              <div key={idx} className="antigravity-step-item" style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  onClick={() => hasDetailOrOutput && toggleRow(idx)}
                  className="antigravity-step-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    cursor: hasDetailOrOutput ? 'pointer' : 'default',
                    fontSize: '12.5px',
                    lineHeight: '1.45',
                    color: isCompleted ? '#e2e8f0' : isInProgress ? '#38bdf8' : '#94a3b8',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (hasDetailOrOutput) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Action */}
                  <span style={{ color: isInProgress ? '#38bdf8' : '#94a3b8', fontWeight: 400 }}>
                    {action}
                  </span>

                  {/* Badge (e.g. PY, TS, SQL, DAG, CLI) */}
                  {st.badge && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        lineHeight: '1.2',
                        letterSpacing: '0.02em',
                        ...getBadgeStyle(st.badge),
                      }}
                    >
                      {st.badge}
                    </span>
                  )}

                  {/* Target / File / Entity */}
                  <span style={{ color: '#f1f5f9', fontWeight: isInProgress ? 600 : 500 }}>
                    {target}
                  </span>

                  {/* Diff stats (e.g. +38 -0, +46 lines) */}
                  {st.diff && (
                    <span style={{ fontSize: '11.5px', marginLeft: '3px' }}>
                      {renderDiff(st.diff)}
                    </span>
                  )}

                  {/* In-progress spinner */}
                  {isInProgress && (
                    <Loader2
                      width={11}
                      height={11}
                      className="animate-spin"
                      style={{ color: '#38bdf8', marginLeft: '4px' }}
                    />
                  )}

                  {/* Expand Chevron */}
                  {hasDetailOrOutput && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '11px',
                      }}
                    >
                      {isRowExpanded ? <ChevronDown width={12} height={12} /> : <ChevronRight width={12} height={12} />}
                    </span>
                  )}
                </div>

                {/* Expanded Clean Indented Detail (No bulky blue boxes) */}
                {isRowExpanded && (
                  <div
                    className="antigravity-step-drawer"
                    style={{
                      marginLeft: '14px',
                      marginTop: '3px',
                      marginBottom: '6px',
                      paddingLeft: '10px',
                      borderLeft: '1.5px solid rgba(255, 255, 255, 0.12)',
                      background: 'transparent',
                      fontSize: '12px',
                      color: '#94a3b8',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '260px',
                      overflowY: 'auto',
                    }}
                  >
                    {st.output ? (
                      <div style={{ fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', fontSize: '11.5px' }}>
                        <div style={{ color: '#64748b', marginBottom: '2px', fontSize: '10.5px' }}>
                          ...\Fabric_AI &gt; {action} {target}
                        </div>
                        <div style={{ color: '#cbd5e1' }}>{st.output}</div>
                      </div>
                    ) : (
                      <div>{st.detail}</div>
                    )}
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

export default ThoughtTrace;
