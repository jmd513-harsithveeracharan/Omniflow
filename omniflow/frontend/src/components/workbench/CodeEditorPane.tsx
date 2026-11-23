import React, { useState } from 'react';
import { Copy, Check, FileCode, Database, ShieldCheck } from 'lucide-react';
import { CodeCard } from '../chat/CodeCard';

interface CodeEditorPaneProps {
  pysparkCode: string;
  sqlCode: string;
  qualityCode?: string;
  domain?: string;
  selectedLabel?: string;
}

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({
  pysparkCode,
  sqlCode,
  qualityCode,
  domain = 'postgres_medallion',
  selectedLabel,
}) => {
  const [activeFile, setActiveFile] = useState<'pyspark' | 'quality' | 'sql'>('pyspark');
  const [copied, setCopied] = useState(false);

  const cleanDomain = domain.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  const pyFileName = selectedLabel && selectedLabel.includes('.py') ? selectedLabel : `nb_${cleanDomain}_curate.py`;
  const qualityFileName = `nb_${cleanDomain}_quality_suite.py`;
  const sqlFileName = `wh_${cleanDomain}_gold.sql`;

  let codeToShow = pysparkCode;
  let activeLang = 'python';
  let activeLabel = pyFileName;

  if (activeFile === 'quality') {
    codeToShow = qualityCode || '# PySpark Great Expectations Quality Suite';
    activeLang = 'python';
    activeLabel = qualityFileName;
  } else if (activeFile === 'sql') {
    codeToShow = sqlCode || '-- No T-SQL Warehouse DDL generated yet.';
    activeLang = 'sql';
    activeLabel = sqlFileName;
  }

  const linesCount = codeToShow.split('\n').length;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeToShow);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="wb-view-pane active" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#121214' }}>
      <div className="code-editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#18181b', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
          {qualityCode && (
            <button
              type="button"
              onClick={() => setActiveFile('quality')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                border: activeFile === 'quality' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                background: activeFile === 'quality' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeFile === 'quality' ? '#38bdf8' : '#94a3b8',
              }}
            >
              <ShieldCheck width={13} height={13} />
              <span>{qualityFileName}</span>
            </button>
          )}
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
            {activeFile === 'pyspark' ? 'Delta MERGE Curation' : (activeFile === 'quality' ? 'Quality & Schema Rules' : 'Direct Lake Mart DDL')}
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
          language={activeLang}
          code={codeToShow}
          filename={activeLabel}
        />
      </div>
    </div>
  );
};
