import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export interface ThoughtStep {
  title: string;
  detail?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
}

export interface ThoughtMeta {
  elapsed?: string;
  steps: ThoughtStep[];
}

interface ThoughtTraceProps {
  meta: ThoughtMeta;
}

export const ThoughtTrace: React.FC<ThoughtTraceProps> = ({ meta }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="chat-thought-wrapper-inline" style={{ width: '100%', marginBottom: '8px' }}>
      <button
        type="button"
        className="agent-thought-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          padding: '4px 8px',
          cursor: 'pointer',
          color: '#a1a1aa',
          fontSize: '12px',
          fontFamily: 'var(--font-sans, "Google Sans Text", sans-serif)',
          borderRadius: '4px',
        }}
      >
        <ChevronRight
          width={12}
          height={12}
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
        <span>Thought for {meta.elapsed || '24.2'}s</span>
      </button>

      {isOpen && (
        <div
          className="agent-thought-body"
          style={{
            marginTop: '6px',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {meta.steps.map((st, idx) => {
            const isCompleted = st.status === 'completed';
            return (
              <div
                key={idx}
                className={`agent-working-step ${isCompleted ? 'completed' : 'in_progress'}`}
                style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      color: isCompleted ? '#10b981' : '#38bdf8',
                      fontWeight: 'bold',
                    }}
                  >
                    {isCompleted ? '✓' : '●'}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isCompleted ? '#e4e4e7' : '#38bdf8',
                    }}
                  >
                    {st.title}
                  </span>
                </div>
                {st.detail && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#71717a',
                      paddingLeft: '16px',
                      lineHeight: '1.4',
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
