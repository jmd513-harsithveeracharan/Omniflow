import React, { useState } from 'react';
import { Copy, Check, FileCode, Database } from 'lucide-react';
import { CodeCard } from '../chat/CodeCard';

interface CodeEditorPaneProps {
  pysparkCode: string;
  sqlCode: string;
  domain?: string;
  selectedLabel?: string;
}

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({
  pysparkCode,
  sqlCode,
  domain = 'postgres_medallion',
  selectedLabel,
}) => {
  const [activeFile, setActiveFile] = useState<'pyspark' | 'sql'>('pyspark');
  const [copied, setCopied] = useState(false);

  const cleanDomain = domain.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const pyFileName = selectedLabel && selectedLabel.includes('.py') ? selectedLabel : `nb_${cleanDomain}_curate.py`;
  const sqlFileName = `wh_${cleanDomain}_gold.sql`;

  const codeToShow = activeFile === 'pyspark' ? pysparkCode : (sqlCode || '-- No T-SQL Warehouse DDL generated yet.');
  const linesCount = codeToShow.split('\n').length;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeToShow);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="wb-view-pane active" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#090a0f' }}>
      <div className="code-editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveFile('pyspark')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              border: activeFile === 'pyspark' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
              background: activeFile === 'pyspark' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: activeFile === 'pyspark' ? '#34d399' : '#94a3b8',
            }}
          >
            <FileCode width={13} height={13} />
            <span>{pyFileName}</span>
          </button>
          {sqlCode && (
            <button
              type="button"
              onClick={() => setActiveFile('sql')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                border: activeFile === 'sql' ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.08)',
                background: activeFile === 'sql' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                color: activeFile === 'sql' ? '#c4b5fd' : '#94a3b8',
              }}
            >
              <Database width={13} height={13} />
              <span>{sqlFileName}</span>
            </button>
          )}
          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
            {activeFile === 'pyspark' ? 'Delta MERGE Curation' : 'Direct Lake Mart DDL'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11.5px', color: '#64748b', fontFamily: 'monospace' }}>
            {linesCount} lines
          </span>
          <button
            className="btn-copy-code"
            type="button"
            onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
          >
            {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px' }}>
        <CodeCard
          language={activeFile === 'pyspark' ? 'python' : 'sql'}
          code={codeToShow}
          filename={activeFile === 'pyspark' ? pyFileName : sqlFileName}
        />
      </div>
    </div>
  );
};
