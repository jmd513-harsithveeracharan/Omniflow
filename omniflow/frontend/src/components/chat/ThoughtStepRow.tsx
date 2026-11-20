import React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Database,
  Terminal,
  FileCode2,
  Layers,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { ThoughtStep } from '../../types';

interface ThoughtStepRowProps {
  step: ThoughtStep;
  index: number;
  isExpanded: boolean;
  onToggle: (index: number) => void;
}

/**
 * Resolves the appropriate icon for a thought step matching Antigravity's aesthetics.
 */
const renderStepIcon = (action: string, target: string, badge?: string) => {
  const t = target.toLowerCase();
  const b = (badge || '').toUpperCase();
  const a = action.toLowerCase();

  // 1. React / TSX
  if (t.endsWith('.tsx') || t.endsWith('.jsx')) {
    return (
      <span
        style={{
          color: '#60a5fa',
          fontSize: '12px',
          fontWeight: 700,
          fontFamily: 'monospace',
          lineHeight: 1,
        }}
        title="React Component"
      >
        ⚛
      </span>
    );
  }

  // 2. CSS Style
  if (t.endsWith('.css') || t.endsWith('.scss')) {
    return (
      <span
        style={{
          color: '#38bdf8',
          fontSize: '11px',
          fontFamily: 'monospace',
          fontWeight: 700,
          lineHeight: 1,
        }}
        title="CSS Stylesheet"
      >
        &#123;&nbsp;&#125;
      </span>
    );
  }

  // 3. Database / Schema / SQL
  if (
    b === 'SCHEMA' ||
    b === 'SQL' ||
    t.endsWith('.sql') ||
    t.includes('source_crm.') ||
    t.includes('public.') ||
    t.includes('lakehouse') ||
    t.includes('warehouse') ||
    a.includes('schema') ||
    a.includes('table')
  ) {
    return <Database width={12} height={12} style={{ color: '#c084fc', flexShrink: 0 }} />;
  }

  // 4. Python / PySpark
  if (b === 'PY' || t.endsWith('.py') || t.includes('pyspark') || t.includes('delta')) {
    return <FileCode2 width={12} height={12} style={{ color: '#38bdf8', flexShrink: 0 }} />;
  }

  // 5. Terminal / Search / Command
  if (
    b === 'CLI' ||
    b === 'REST' ||
    b === 'TERMINAL' ||
    a.startsWith('ran') ||
    a.includes('search') ||
    a.includes('select-string') ||
    a.includes('powershell')
  ) {
    return <Terminal width={12} height={12} style={{ color: '#94a3b8', flexShrink: 0 }} />;
  }

  // 6. Architecture / DAG / Phases
  if (b === 'DAG' || b === 'PHASE' || b === 'PLAN' || a.includes('dag') || a.includes('plan')) {
    return <Layers width={12} height={12} style={{ color: '#34d399', flexShrink: 0 }} />;
  }

  // 7. Governance / PII
  if (b === 'PII' || b === 'AUDIT' || a.includes('pii') || a.includes('audit')) {
    return <ShieldAlert width={12} height={12} style={{ color: '#fbbf24', flexShrink: 0 }} />;
  }

  // Default fallback
  return <CheckCircle2 width={12} height={12} style={{ color: '#38bdf8', flexShrink: 0 }} />;
};

export const ThoughtStepRow: React.FC<ThoughtStepRowProps> = ({
  step,
  index,
  isExpanded,
  onToggle,
}) => {
  const isCompleted = step.status === 'completed';
  const isInProgress = step.status === 'in_progress';
  const hasDetailOrOutput = Boolean(step.detail || step.output);

  // Parse action and target cleanly with zero word concatenation
  let action = (step.action || '').trim();
  let target = (step.target || '').trim();
  const title = (step.title || '').trim();

  if (!action) {
    if (title.includes(':')) {
      const parts = title.split(':');
      action = parts[0].trim().replace(/\s+(Agent|Engine|Module)$/i, '');
      target = parts.slice(1).join(':').trim();
    } else {
      const words = title.split(' ');
      action = words[0] || 'Task';
      target = words.slice(1).join(' ') || title;
    }
  } else if (!target && title.includes(':')) {
    target = title.split(':').slice(1).join(':').trim();
  }

  // Clean deduplication between action and target
  if (target.toLowerCase() === action.toLowerCase()) {
    target = step.detail || title;
  }
  if (target.toLowerCase().startsWith(action.toLowerCase() + ' ')) {
    target = target.slice(action.length).trim();
  }
  const cleanTarget = target.replace(/^[:\s-]+/, '').trim() || title;
  const displayAction = cleanTarget.toLowerCase() === action.toLowerCase() ? '' : action;

  // Derive secondary stats (e.g. line count, attributes count, PK)
  let statsTag = '';
  if (step.diff) {
    statsTag = step.diff;
  } else if (step.detail && step.detail.includes('attributes')) {
    // Extract concise stats like "(8 attributes, PK: id)"
    const attrMatch = step.detail.match(/(\d+)\s+attributes/i);
    const pkMatch = step.detail.match(/PK:\s*([^\s|]+)/i);
    if (attrMatch) {
      statsTag = `${attrMatch[1]} attributes${pkMatch ? `, PK: ${pkMatch[1]}` : ''}`;
    }
  }

  // Derive terminal command prompt for expanded view
  const terminalCommand =
    step.target?.startsWith('fabric build') || step.target?.startsWith('Select-String')
      ? step.target
      : `${action.toLowerCase()} ${cleanTarget}`;

  return (
    <div
      className="antigravity-step-item"
      style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
    >
      <div
        onClick={() => hasDetailOrOutput && onToggle(index)}
        className="antigravity-step-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2.5px 6px',
          borderRadius: '4px',
          cursor: hasDetailOrOutput ? 'pointer' : 'default',
          fontSize: '12.5px',
          lineHeight: '1.45',
          color: isCompleted ? '#e2e8f0' : isInProgress ? '#38bdf8' : '#94a3b8',
          transition: 'background 0.15s ease',
          userSelect: 'text',
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
        {/* Action Verb (e.g. Analyzed, Ran search, Discovered, Synthesized) */}
        {displayAction && (
          <span style={{ color: isInProgress ? '#38bdf8' : '#94a3b8', fontWeight: 400 }}>
            {displayAction}
          </span>
        )}

        {/* Antigravity Aesthetic Icon */}
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          {renderStepIcon(displayAction, cleanTarget, step.badge)}
        </span>

        {/* Target Entity / File */}
        <span
          style={{
            color: isInProgress ? '#38bdf8' : '#f1f5f9',
            fontWeight: isInProgress ? 600 : 500,
          }}
        >
          {cleanTarget}
        </span>

        {/* Secondary Metadata / Stats (e.g. #L1-180, 8 attributes, +46 lines) */}
        {statsTag && (
          <span style={{ color: '#64748b', fontSize: '11.5px', marginLeft: '2px' }}>
            {statsTag.startsWith('+') || statsTag.startsWith('#') ? statsTag : `(${statsTag})`}
          </span>
        )}

        {/* Live In-Progress Spinner */}
        {isInProgress && (
          <Loader2
            width={11}
            height={11}
            className="animate-spin"
            style={{ color: '#38bdf8', marginLeft: '4px' }}
          />
        )}

        {/* Expand / Collapse Chevron */}
        {hasDetailOrOutput && (
          <span
            style={{
              marginLeft: 'auto',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isExpanded ? <ChevronDown width={12} height={12} /> : <ChevronRight width={12} height={12} />}
          </span>
        )}
      </div>

      {/* Expanded Code & Output Drawer */}
      {isExpanded && (
        <div
          className="antigravity-step-drawer"
          style={{
            marginLeft: '18px',
            marginTop: '3px',
            marginBottom: '6px',
            paddingLeft: '10px',
            borderLeft: '1.5px solid rgba(255, 255, 255, 0.12)',
            fontSize: '12px',
          }}
        >
          {step.detail && !step.output && (
            <div style={{ color: '#94a3b8', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {step.detail}
            </div>
          )}

          {step.output && (
            <div
              style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", Consolas, monospace)',
                fontSize: '11px',
                background: '#0d1117',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '8px 12px',
                marginTop: '4px',
                overflowX: 'auto',
              }}
            >
              <div
                style={{
                  color: '#38bdf8',
                  marginBottom: '4px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ color: '#10b981' }}>..\Fabric_AI $</span>
                <span style={{ color: '#f1f5f9' }}>{terminalCommand}</span>
              </div>
              <pre
                style={{
                  margin: 0,
                  color: '#cbd5e1',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.45',
                  fontFamily: 'inherit',
                }}
              >
                {step.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThoughtStepRow;
