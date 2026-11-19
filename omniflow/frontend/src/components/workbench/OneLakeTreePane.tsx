import React, { useState } from 'react';
import { FolderTree, Copy, Check } from 'lucide-react';

interface OneLakeTreePaneProps {
  treeItems: string[];
  rootFolder?: string;
  workspaceName?: string;
}

export const OneLakeTreePane: React.FC<OneLakeTreePaneProps> = ({
  treeItems,
  rootFolder = 'Postgres_Medallion_Platform',
  workspaceName = 'PBT_DATA_AGENT',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(treeItems.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const itemCount = treeItems.filter((it) => it.includes('🏢') || it.includes('📜') || it.includes('⚡') || it.includes('🏛️') || it.includes('📊')).length || 9;

  if (!treeItems || treeItems.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '260px', color: '#94a3b8', textAlign: 'center', padding: '32px' }}>
        <FolderTree width={32} height={32} style={{ opacity: 0.35, marginBottom: '10px' }} />
        <p style={{ margin: 0, fontSize: '13px' }}>No OneLake workspace folder hierarchy generated yet.</p>
      </div>
    );
  }

  return (
    <div className="wb-view-pane active" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', minHeight: 0 }}>
      <div className="code-editor-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0, 0, 0, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderTree width={14} height={14} style={{ color: '#10b981' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{rootFolder} ({workspaceName})</span>
          <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>
            {itemCount} Enterprise Assets
          </span>
        </div>
        <button
          className="btn-copy-code"
          type="button"
          onClick={handleCopy}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
        >
          {copied ? <Check width={12} height={12} /> : <Copy width={12} height={12} />}
          <span>{copied ? 'Copied Tree' : 'Copy Tree'}</span>
        </button>
      </div>
      <div className="tree-container" style={{ flex: 1, minHeight: 0, height: '100%', padding: '16px 20px', overflowY: 'auto', background: '#090a0f' }}>
        {treeItems.map((item, idx) => {
          const isNested = item.startsWith('    ') || item.includes('│   ├──') || item.includes('│   └──');
          const isChild = item.startsWith('├──') || item.startsWith('└──');
          const padClass = isNested ? 'pl-8' : (isChild ? 'pl-4' : '');
          return (
            <div
              key={idx}
              className={`tree-node-item ${padClass}`}
              style={{
                whiteSpace: 'pre',
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '12.5px',
                lineHeight: '1.9',
                color: item.includes('📁') ? '#e2e8f0' : (item.includes('🏢') ? '#38bdf8' : (item.includes('📜') ? '#fbbf24' : (item.includes('⚡') ? '#f472b6' : '#a78bfa'))),
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
};
