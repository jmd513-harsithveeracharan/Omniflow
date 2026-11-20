import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { ThoughtMeta, ThoughtStep } from '../../types';
import { ThoughtStepRow } from './ThoughtStepRow';

export type { ThoughtMeta, ThoughtStep };

interface ThoughtTraceProps {
  meta: ThoughtMeta;
  isStreaming?: boolean;
}

export const ThoughtTrace: React.FC<ThoughtTraceProps> = ({ meta, isStreaming = false }) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isSubGroupOpen, setIsSubGroupOpen] = useState<boolean>(true);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

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

  const formatTime = (secs: number | string) => {
    const n = Number(secs) || 0;
    if (n >= 60) {
      const mins = Math.floor(n / 60);
      const rem = Math.round(n % 60);
      return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
    }
    return typeof secs === 'string' && secs.includes('.') ? `${secs}s` : `${n}s`;
  };

  const displayTime = isStreaming
    ? formatTime(elapsedSeconds)
    : meta.elapsed
    ? formatTime(meta.elapsed)
    : formatTime(Math.max(1, elapsedSeconds));

  // Compute a smart, natural summary title for the sub-group (e.g. "Discovered 4 schemas, synthesized 7 artifacts")
  const subGroupSummary = useMemo(() => {
    if (steps.length === 0) return 'Thinking and analyzing...';

    const schemaCount = steps.filter(
      (s) => (s.badge || '').toUpperCase() === 'SCHEMA' || (s.action || '').toLowerCase().includes('discover')
    ).length;
    const artifactCount = steps.filter(
      (s) => (s.badge || '').toUpperCase() === 'CODE' || (s.badge || '').toUpperCase() === 'PY' || (s.action || '').toLowerCase().includes('synth')
    ).length;

    const parts: string[] = [];
    if (schemaCount > 0) parts.push(`Discovered ${schemaCount} schema${schemaCount > 1 ? 's' : ''}`);
    if (artifactCount > 0) parts.push(`synthesized ${artifactCount} artifact${artifactCount > 1 ? 's' : ''}`);
    parts.push('verified DAG');

    return parts.length > 0 ? parts.join(', ') : 'Explored files, ran commands, edited files';
  }, [steps]);

  if (steps.length === 0 && !isStreaming) return null;

  return (
    <div
      className="antigravity-thought-container"
      style={{
        width: '100%',
        marginBottom: '10px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* 1. Top Level Header: "Worked for 4m" / "Worked for 23s" */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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
          {isStreaming ? `Thinking (${displayTime})` : `Worked for ${displayTime}`}
        </span>
      </button>

      {/* 2. Hierarchical Activity Stream */}
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
          {/* Sub-group Accordion Header */}
          <div
            onClick={() => setIsSubGroupOpen(!isSubGroupOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 4px',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '12.5px',
              userSelect: 'none',
              marginBottom: '2px',
            }}
          >
            <span>{subGroupSummary}</span>
            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
              {isSubGroupOpen ? <ChevronDown width={12} height={12} /> : <ChevronRight width={12} height={12} />}
            </span>
          </div>

          {/* Child Activity Steps */}
          {isSubGroupOpen && (
            <div
              style={{
                paddingLeft: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5px',
              }}
            >
              {steps.map((st, idx) => (
                <ThoughtStepRow
                  key={idx}
                  step={st}
                  index={idx}
                  isExpanded={Boolean(expandedRows[idx])}
                  onToggle={toggleRow}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThoughtTrace;
