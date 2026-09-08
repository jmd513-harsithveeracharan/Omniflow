import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface CodeCardProps {
  language: string;
  code: string;
}

export const CodeCard: React.FC<CodeCardProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const cleanCode = code.trim();
  const lineCount = cleanCode.split('\n').length;
  const isLong = lineCount > 10;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`code-card ${isLong && isCollapsed ? 'is-collapsed' : ''}`}>
      <div className="code-card-header">
        <span className="code-lang-label">{language || 'code'}</span>
        <button
          type="button"
          className="code-copy-btn"
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? (
            <>
              <Check width={13} height={13} style={{ color: '#10b981' }} />
              <span className="copy-text" style={{ color: '#10b981' }}>Copied!</span>
            </>
          ) : (
            <>
              <Copy width={13} height={13} />
              <span className="copy-text">Copy code</span>
            </>
          )}
        </button>
      </div>

      <pre className="code-card-body">
        <code className={`language-${language}`}>{cleanCode}</code>
      </pre>

      {isLong && (
        <div className="code-card-footer">
          <button
            type="button"
            className="btn-code-show-more"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <>
                <ChevronDown width={13} height={13} />
                <span className="show-more-label">Show more ({lineCount} lines)</span>
              </>
            ) : (
              <>
                <ChevronUp width={13} height={13} />
                <span className="show-more-label">Show less</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
