import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, ChevronDown, ChevronUp } from 'lucide-react';
import Prism from 'prismjs';

// Import all required Prism language grammars
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';

// Enhance Python grammar to highlight method calls like .filter(), .table(), .join() as functions
if (Prism.languages.python) {
  Prism.languages.insertBefore('python', 'operator', {
    'function-call': {
      pattern: /\b[a-zA-Z_]\w*(?=\s*\()/,
      alias: 'function',
    },
  });
}

// Enhance SQL grammar for common keywords and function calls
if (Prism.languages.sql) {
  Prism.languages.insertBefore('sql', 'operator', {
    'function-call': {
      pattern: /\b[a-zA-Z_]\w*(?=\s*\()/,
      alias: 'function',
    },
  });
}

interface CodeCardProps {
  language: string;
  code: string;
  filename?: string;
}

interface LanguageMeta {
  display: string;
  ext: string;
  grammar: Prism.Grammar;
  prismLang: string;
}

const getLanguageMeta = (langRaw: string): LanguageMeta => {
  const l = (langRaw || 'python').toLowerCase().trim();

  if (l === 'py' || l === 'python') {
    return { display: 'Python', ext: 'py', grammar: Prism.languages.python, prismLang: 'python' };
  }
  if (l === 'pyspark' || l === 'spark') {
    return { display: 'PySpark', ext: 'py', grammar: Prism.languages.python, prismLang: 'python' };
  }
  if (l === 'sql' || l === 'sparksql' || l === 'tsql' || l === 'mysql' || l === 'pgsql') {
    return { display: 'SQL', ext: 'sql', grammar: Prism.languages.sql, prismLang: 'sql' };
  }
  if (l === 'ts' || l === 'typescript') {
    return { display: 'TypeScript', ext: 'ts', grammar: Prism.languages.typescript, prismLang: 'typescript' };
  }
  if (l === 'tsx') {
    return { display: 'TSX', ext: 'tsx', grammar: Prism.languages.typescript, prismLang: 'typescript' };
  }
  if (l === 'js' || l === 'javascript') {
    return { display: 'JavaScript', ext: 'js', grammar: Prism.languages.javascript, prismLang: 'javascript' };
  }
  if (l === 'jsx') {
    return { display: 'JSX', ext: 'jsx', grammar: Prism.languages.javascript, prismLang: 'javascript' };
  }
  if (l === 'json' || l === 'jsonc') {
    return { display: 'JSON', ext: 'json', grammar: Prism.languages.json, prismLang: 'json' };
  }
  if (l === 'bash' || l === 'sh' || l === 'shell' || l === 'zsh') {
    return { display: 'Bash', ext: 'sh', grammar: Prism.languages.bash, prismLang: 'bash' };
  }
  if (l === 'powershell' || l === 'ps1') {
    return { display: 'PowerShell', ext: 'ps1', grammar: Prism.languages.powershell || Prism.languages.bash, prismLang: 'powershell' };
  }
  if (l === 'yaml' || l === 'yml') {
    return { display: 'YAML', ext: 'yaml', grammar: Prism.languages.yaml, prismLang: 'yaml' };
  }
  if (l === 'markdown' || l === 'md') {
    return { display: 'Markdown', ext: 'md', grammar: Prism.languages.markdown, prismLang: 'markdown' };
  }
  if (l === 'docker' || l === 'dockerfile') {
    return { display: 'Dockerfile', ext: 'dockerfile', grammar: Prism.languages.docker, prismLang: 'docker' };
  }
  if (l === 'kql' || l === 'kusto') {
    return { display: 'KQL', ext: 'kql', grammar: Prism.languages.sql, prismLang: 'sql' };
  }
  if (l === 'css' || l === 'scss') {
    return { display: 'CSS', ext: 'css', grammar: Prism.languages.css, prismLang: 'css' };
  }
  if (l === 'html' || l === 'xml' || l === 'markup' || l === 'svg') {
    return { display: 'HTML', ext: 'html', grammar: Prism.languages.markup, prismLang: 'markup' };
  }

  // Capitalize custom/unknown language name
  const capitalized = l.charAt(0).toUpperCase() + l.slice(1);
  return {
    display: capitalized || 'Code',
    ext: 'txt',
    grammar: Prism.languages.python || Prism.languages.markup,
    prismLang: 'python',
  };
};

export const CodeCard: React.FC<CodeCardProps> = ({ language, code, filename }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const cleanCode = code.trim();
  const lineCount = cleanCode.split('\n').length;
  const isLong = lineCount > 18;
  const langMeta = useMemo(() => getLanguageMeta(language), [language]);

  const highlightedHtml = useMemo(() => {
    try {
      if (langMeta.grammar) {
        return Prism.highlight(cleanCode, langMeta.grammar, langMeta.prismLang);
      }
    } catch {
      // fallback
    }
    return cleanCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }, [cleanCode, langMeta]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const downloadName = filename || `snippet.${langMeta.ext}`;
    const blob = new Blob([cleanCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`modern-code-card ${isLong && !isExpanded ? 'is-collapsed' : ''}`}
      style={{ background: '#16181d', border: '1px solid rgba(255, 255, 255, 0.08)' }}
    >
      {/* Code Header Bar */}
      <div
        className="modern-code-header"
        style={{ background: '#16181d', border: 'none', borderBottom: 'none' }}
      >
        <div className="modern-code-title-group">
          <span className="modern-code-lang-label">
            {langMeta.display}
          </span>
        </div>

        <div className="modern-code-actions">
          {/* Download snippet button */}
          <button
            type="button"
            className="modern-code-btn"
            onClick={handleDownload}
            title={`Download ${langMeta.display} snippet`}
            aria-label="Download snippet"
          >
            <Download width={14} height={14} className="modern-code-icon" />
          </button>

          {/* Copy code button */}
          <button
            type="button"
            className={`modern-code-btn ${copied ? 'is-copied' : ''}`}
            onClick={handleCopy}
            title="Copy code to clipboard"
            aria-label="Copy code"
          >
            {copied ? (
              <Check width={14} height={14} className="modern-code-icon text-emerald-400" />
            ) : (
              <Copy width={14} height={14} className="modern-code-icon" />
            )}
          </button>
        </div>
      </div>

      {/* Code Content Pre/Code */}
      <div className="modern-code-body-wrapper" style={{ background: '#16181d' }}>
        <pre
          className="modern-code-pre"
          style={{
            maxHeight: isLong && !isExpanded ? '360px' : 'none',
            overflowY: isLong && !isExpanded ? 'hidden' : 'visible',
            overflowX: 'auto',
            background: '#16181d',
            border: 'none',
            borderRadius: 0,
            margin: 0,
          }}
        >
          <code
            className={`language-${langMeta.prismLang} modern-code-content`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>

        {/* Floating Blur Gradient with Inline Expand Button */}
        {isLong && !isExpanded && (
          <div className="modern-code-fade-gradient">
            <button
              type="button"
              className="modern-code-expand-btn"
              onClick={() => setIsExpanded(true)}
            >
              <ChevronDown width={13} height={13} />
              <span>Expand</span>
            </button>
          </div>
        )}
      </div>

      {/* Clean borderless collapse button when expanded */}
      {isLong && isExpanded && (
        <div className="modern-code-collapse-footer">
          <button
            type="button"
            className="modern-code-expand-btn"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronUp width={13} height={13} />
            <span>Collapse</span>
          </button>
        </div>
      )}
    </div>
  );
};


