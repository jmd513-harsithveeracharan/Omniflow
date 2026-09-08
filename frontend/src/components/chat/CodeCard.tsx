import React, { useState, useMemo } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markup';

interface CodeCardProps {
  language: string;
  code: string;
}

export const CodeCard: React.FC<CodeCardProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const cleanCode = code.trim();
  const lineCount = cleanCode.split('\n').length;
  const isLong = lineCount > 16;
  const normalizedLang = (language || 'python').toLowerCase().trim();

  const getGrammar = (lang: string) => {
    if (lang === 'py' || lang === 'python' || lang === 'pyspark') return Prism.languages.python;
    if (lang === 'sql' || lang === 'sparksql' || lang === 'tsql') return Prism.languages.sql;
    if (lang === 'json') return Prism.languages.json;
    if (lang === 'bash' || lang === 'sh' || lang === 'shell') return Prism.languages.bash;
    if (lang === 'yaml' || lang === 'yml') return Prism.languages.yaml;
    if (lang === 'js' || lang === 'javascript') return Prism.languages.javascript;
    if (lang === 'ts' || lang === 'typescript') return Prism.languages.typescript;
    return Prism.languages.python || Prism.languages.markup;
  };

  const highlightedHtml = useMemo(() => {
    try {
      const grammar = getGrammar(normalizedLang);
      if (grammar) {
        return Prism.highlight(cleanCode, grammar, normalizedLang);
      }
    } catch {
      // fallback
    }
    return cleanCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }, [cleanCode, normalizedLang]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`code-card ${isLong && !isExpanded ? 'is-collapsed' : ''}`} style={{ margin: '12px 0' }}>
      <div className="code-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Terminal width={13} height={13} style={{ color: '#9ca3af' }} />
          <span className="code-lang-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '11px', fontWeight: 600 }}>
            {normalizedLang || 'code'}
          </span>
          <span style={{ fontSize: '11px', color: '#71717a' }}>• {lineCount} lines</span>
        </div>
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

      <pre
        className="code-card-body"
        style={{
          maxHeight: isLong && !isExpanded ? '320px' : 'none',
          overflow: 'hidden',
          background: '#1e1f20',
          padding: '14px 16px',
          margin: 0,
          fontFamily: 'var(--font-mono, "JetBrains Mono", "Roboto Mono", monospace)',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: '1.65',
          letterSpacing: '0.01em',
        }}
      >
        <code
          className={`language-${normalizedLang}`}
          style={{ fontWeight: 500 }}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </pre>

      {isLong && (
        <div className="code-card-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: '#242528' }}>
          <button
            type="button"
            className="btn-code-show-more"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {!isExpanded ? (
              <>
                <ChevronDown width={13} height={13} />
                <span className="show-more-label">Expand full snippet ({lineCount} lines)</span>
              </>
            ) : (
              <>
                <ChevronUp width={13} height={13} />
                <span className="show-more-label">Collapse snippet</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
