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
  if (b === 'SCHEMA') {
    return {
      background: 'rgba(56, 189, 248, 0.12)',
      color: '#38bdf8',
      border: '1px solid rgba(56, 189, 248, 0.25)',
    };
  }
  if (b === 'PII') {
    return {
      background: 'rgba(245, 158, 11, 0.14)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.3)',
    };
  }
  if (b === 'PHASE') {
    return {
      background: 'rgba(16, 185, 129, 0.12)',
      color: '#34d399',
      border: '1px solid rgba(16, 185, 129, 0.25)',
    };
  }
  if (b === 'AST' || b === 'TEST' || b === 'AUDIT') {
    return {
      background: 'rgba(192, 132, 252, 0.14)',
      color: '#c084fc',
      border: '1px solid rgba(192, 132, 252, 0.3)',
    };
  }
  if (b === 'ADF' || b === 'REST') {
    return {
      background: 'rgba(14, 165, 233, 0.14)',
      color: '#38bdf8',
      border: '1px solid rgba(14, 165, 233, 0.3)',
    };
  }
  if (b === 'DAG' || b === 'DELTA') {
    return {
      background: 'rgba(52, 211, 153, 0.12)',
      color: '#34d399',
      border: '1px solid rgba(52, 211, 153, 0.25)',
    };
  }
  if (b === 'JOB' || b === 'PIPELINE') {
    return {
      background: 'rgba(251, 191, 36, 0.12)',
      color: '#fbbf24',
      border: '1px solid rgba(251, 191, 36, 0.25)',
    };
  }
  if (b === 'FAB' || b === 'FABRIC' || b === 'LAKEHOUSE') {
    return {
      background: 'rgba(167, 139, 250, 0.12)',
      color: '#a78bfa',
      border: '1px solid rgba(167, 139, 250, 0.25)',
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

  const formatTime = (secs: number | string) => {
    const n = Number(secs) || 0;
    if (n >= 60) {
      const mins = Math.floor(n / 60);
      const rem = Math.round(n % 60);
      return `${mins}m ${rem}s`;
    }
    return typeof secs === 'string' && secs.includes('.') ? `${secs}s` : `${n}s`;
  };

  const displayTime = isStreaming
    ? formatTime(elapsedSeconds)
    : meta.elapsed
    ? formatTime(meta.elapsed)
    : formatTime(Math.max(1, elapsedSeconds));

  return (
    <div
      className="antigravity-thought-container"
      style={{
        width: '100%',
        marginBottom: '10px',
        fontFamily: 'var(--font-sans)',
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

            // Parse and format fields cleanly (guaranteed zero duplicate words like 'Architect Architect')
            let action = (st.action || '').trim();
            let target = (st.target || '').trim();
            const title = (st.title || '').trim();

            if (!action) {
              if (title.includes(':')) {
                action = title.split(':')[0].trim().replace(/\s+(Agent|Engine|Module)$/i, '');
                target = title.split(':')[1].trim();
              } else {
                const words = title.split(' ');
                action = words[0] || 'Task';
                target = words.slice(1).join(' ') || title;
              }
            } else if (!target && title.includes(':')) {
              target = title.split(':')[1].trim();
            }

            // Deduplicate: If target starts with action or is identical, clean it up
            if (target.toLowerCase() === action.toLowerCase()) {
              target = title.includes(':') ? title.split(':')[1].trim() : (st.detail || title);
            }
            if (target.toLowerCase().startsWith(action.toLowerCase() + ' ')) {
              target = target.slice(action.length).trim();
            }
            const cleanTarget = target.replace(/^[:\s-]+/, '').trim() || title;
            const displayAction = (cleanTarget.toLowerCase() === action.toLowerCase()) ? '' : action;

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
                  {displayAction && (
                    <span style={{ color: isInProgress ? '#38bdf8' : '#94a3b8', fontWeight: 400 }}>
                      {displayAction}
                    </span>
                  )}

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
                    {cleanTarget}
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
                    {st.detail && (
                      <div style={{ color: '#94a3b8', marginBottom: st.output ? '6px' : '0' }}>{st.detail}</div>
                    )}
                    {st.output && (
                      <div style={{
                        fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                        fontSize: '11px',
                        background: 'rgba(5, 7, 12, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        marginTop: '4px',
                        overflowX: 'auto',
                      }}>
                        <div style={{ color: '#38bdf8', marginBottom: '4px', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#10b981' }}>❯</span>
                          <span>Fabric_AI &gt; {action} {cleanTarget}</span>
                        </div>
                        <div style={{ color: '#cbd5e1', whiteSpace: 'pre', lineHeight: '1.45' }}>{st.output}</div>
                      </div>
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
