import React from 'react';
import { Database, FileCode, GitBranch, AlertCircle, Info, Sparkles, AlertTriangle } from 'lucide-react';
import { CodeCard } from './CodeCard';

interface MarkdownRendererProps {
  content: string;
}

interface MarkdownSegment {
  type: 'text' | 'code';
  language?: string;
  code?: string;
  text?: string;
}

const parseMarkdownSegments = (content: string): MarkdownSegment[] => {
  if (!content) return [];
  const lines = content.split('\n');
  const segments: MarkdownSegment[] = [];

  let inCode = false;
  let codeFenceChar = '`';
  let codeFenceLength = 3;
  let codeLanguage = '';
  let codeLines: string[] = [];
  let textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for code fence start/end: 3 or more backticks or tildes
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(.*)$/);

    if (fenceMatch) {
      const fenceStr = fenceMatch[1];
      const fenceChar = fenceStr[0];
      const fenceLen = fenceStr.length;
      const fenceRest = fenceMatch[2].trim();

      if (!inCode) {
        // Opening code fence
        if (textLines.length > 0) {
          segments.push({ type: 'text', text: textLines.join('\n') });
          textLines = [];
        }
        inCode = true;
        codeFenceChar = fenceChar;
        codeFenceLength = fenceLen;
        // Clean language identifier (e.g., "python", "json", "ts:app.ts" -> "ts")
        const rawLang = fenceRest.split(/[\s:{]/)[0] || '';
        codeLanguage = rawLang.toLowerCase().replace(/[^a-z0-9_-]/g, '').trim();
        codeLines = [];
      } else {
        // Closing code fence check: must match fence char and have AT LEAST the opening length
        if (fenceChar === codeFenceChar && fenceLen >= codeFenceLength && (fenceRest === '' || fenceRest.startsWith(fenceChar))) {
          const fullCode = codeLines.join('\n');
          if (fullCode.trim().length > 0) {
            segments.push({
              type: 'code',
              language: codeLanguage || 'python',
              code: fullCode,
            });
          }
          inCode = false;
          codeLines = [];
          codeLanguage = '';
        } else {
          // Inner code fence (e.g. 3 backticks inside 4-backtick markdown example)
          codeLines.push(line);
        }
      }
    } else {
      if (inCode) {
        codeLines.push(line);
      } else {
        textLines.push(line);
      }
    }
  }

  // Flush remaining at EOF (handles active streaming code blocks seamlessly)
  if (inCode && codeLines.length > 0) {
    const fullCode = codeLines.join('\n');
    if (fullCode.trim().length > 0) {
      segments.push({
        type: 'code',
        language: codeLanguage || 'python',
        code: fullCode,
      });
    }
  } else if (textLines.length > 0) {
    segments.push({
      type: 'text',
      text: textLines.join('\n'),
    });
  }

  return segments;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // 1. Separate code blocks and text segments using GFM fence parsing
  const segments = parseMarkdownSegments(content);

  const renderFabricItemBadge = (line: string): React.ReactNode | null => {
    const trimmed = line.trim();
    // Detect item formats like:
    // - [Lakehouse] lh_retail_bronze: description
    // - Lakehouse: lh_retail_bronze
    // - [Notebook] nb_clean_orders: description
    // - [Pipeline] pl_retail_etl
    const lakehouseMatch = trimmed.match(/^(?:[-*•]\s+)?(?:\[Lakehouse\]|Lakehouse:\s*|Lakehouse\s*-\s*)([a-zA-Z0-9_-]+)(?::|\s*-)?\s*(.*)$/i);
    if (lakehouseMatch) {
      const [, name, desc] = lakehouseMatch;
      return (
        <div className="chat-fabric-item-card lakehouse-card">
          <div className="item-badge-header">
            <span className="item-badge-pill pill-lakehouse">
              <Database width={12} height={12} />
              <span>Lakehouse</span>
            </span>
            <span className="item-badge-name">{name}</span>
          </div>
          {desc && <span className="item-badge-desc">{desc}</span>}
        </div>
      );
    }

    const notebookMatch = trimmed.match(/^(?:[-*•]\s+)?(?:\[Notebook\]|Notebook:\s*|Notebook\s*-\s*|PySpark:\s*)([a-zA-Z0-9_-]+)(?::|\s*-)?\s*(.*)$/i);
    if (notebookMatch) {
      const [, name, desc] = notebookMatch;
      return (
        <div className="chat-fabric-item-card notebook-card">
          <div className="item-badge-header">
            <span className="item-badge-pill pill-notebook">
              <FileCode width={12} height={12} />
              <span>PySpark</span>
            </span>
            <span className="item-badge-name">{name}</span>
          </div>
          {desc && <span className="item-badge-desc">{desc}</span>}
        </div>
      );
    }

    const pipelineMatch = trimmed.match(/^(?:[-*•]\s+)?(?:\[Pipeline\]|Pipeline:\s*|Pipeline\s*-\s*|DataPipeline:\s*)([a-zA-Z0-9_-]+)(?::|\s*-)?\s*(.*)$/i);
    if (pipelineMatch) {
      const [, name, desc] = pipelineMatch;
      return (
        <div className="chat-fabric-item-card pipeline-card">
          <div className="item-badge-header">
            <span className="item-badge-pill pill-pipeline">
              <GitBranch width={12} height={12} />
              <span>Pipeline</span>
            </span>
            <span className="item-badge-name">{name}</span>
          </div>
          {desc && <span className="item-badge-desc">{desc}</span>}
        </div>
      );
    }

    return null;
  };

  const renderInlineFormatted = (text: string): React.ReactNode => {
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect Fabric item card line
      const fabricBadge = renderFabricItemBadge(trimmed);
      if (fabricBadge) {
        nodes.push(<React.Fragment key={`fb-${i}`}>{fabricBadge}</React.Fragment>);
        i++;
        continue;
      }

      // Detect Blockquote / Callout (e.g., > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION])
      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        const fullQuote = quoteLines.join('\n');
        const alertMatch = fullQuote.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)$/i);
        if (alertMatch) {
          const type = alertMatch[1].toUpperCase();
          const alertBody = alertMatch[2].trim();
          nodes.push(
            <div key={`callout-${i}`} className={`chat-md-callout callout-${type.toLowerCase()}`}>
              <div className="callout-header">
                {type === 'NOTE' && <Info width={14} height={14} />}
                {type === 'TIP' && <Sparkles width={14} height={14} />}
                {type === 'IMPORTANT' && <AlertCircle width={14} height={14} />}
                {(type === 'WARNING' || type === 'CAUTION') && <AlertTriangle width={14} height={14} />}
                <span className="callout-type">{type}</span>
              </div>
              <div className="callout-body">{formatSpan(alertBody)}</div>
            </div>
          );
        } else {
          nodes.push(
            <blockquote key={`quote-${i}`} className="chat-md-blockquote">
              {formatSpan(fullQuote)}
            </blockquote>
          );
        }
        continue;
      }

      // Detect Horizontal Rules
      if (/^(\*\*\*|---|___)$/.test(trimmed)) {
        nodes.push(<hr key={`hr-${i}`} className="chat-md-hr" />);
        i++;
        continue;
      }

      // Detect Markdown Table
      if (trimmed.includes('|') && i + 1 < lines.length && /\|?\s*[:-]+[-| :]+\s*\|?/.test(lines[i + 1])) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().includes('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length >= 2) {
          const splitCells = (row: string) => {
            let r = row.trim();
            if (r.startsWith('|')) r = r.substring(1);
            if (r.endsWith('|')) r = r.substring(0, r.length - 1);
            return r.split('|').map((c) => c.trim());
          };
          const headers = splitCells(tableLines[0]);
          const rows = tableLines.slice(2).map(splitCells);
          nodes.push(
            <div key={`table-${i}`} className="chat-md-table-wrapper">
              <table className="chat-md-table">
                <thead>
                  <tr>
                    {headers.map((h, hi) => (
                      <th key={hi}>{formatSpan(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((cell, ci) => (
                        <td key={ci}>{formatSpan(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Detect Headings (# to ######)
      if (trimmed.startsWith('###### ')) {
        nodes.push(<h6 key={i} className="chat-md-h6">{formatSpan(trimmed.replace('###### ', ''))}</h6>);
        i++;
        continue;
      }
      if (trimmed.startsWith('##### ')) {
        nodes.push(<h5 key={i} className="chat-md-h5">{formatSpan(trimmed.replace('##### ', ''))}</h5>);
        i++;
        continue;
      }
      if (trimmed.startsWith('#### ')) {
        nodes.push(<h5 key={i} className="chat-md-h5">{formatSpan(trimmed.replace('#### ', ''))}</h5>);
        i++;
        continue;
      }
      if (trimmed.startsWith('### ')) {
        nodes.push(<h4 key={i} className="chat-md-h4">{formatSpan(trimmed.replace('### ', ''))}</h4>);
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        nodes.push(<h3 key={i} className="chat-md-h3">{formatSpan(trimmed.replace('## ', ''))}</h3>);
        i++;
        continue;
      }
      if (trimmed.startsWith('# ')) {
        nodes.push(<h2 key={i} className="chat-md-h2">{formatSpan(trimmed.replace('# ', ''))}</h2>);
        i++;
        continue;
      }

      // Detect Task List Checkboxes (- [ ] or - [x])
      if (/^[-*•]\s+\[([ xX])\]\s+/.test(trimmed)) {
        const taskMatch = trimmed.match(/^[-*•]\s+\[([ xX])\]\s+(.*)$/);
        if (taskMatch) {
          const isChecked = taskMatch[1].toLowerCase() === 'x';
          const taskContent = taskMatch[2];
          nodes.push(
            <div key={`task-${i}`} className="chat-md-task-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
              <input type="checkbox" checked={isChecked} readOnly style={{ accentColor: '#38bdf8', cursor: 'default' }} />
              <span style={{ textDecoration: isChecked ? 'line-through' : 'none', color: isChecked ? '#71717a' : '#f4f4f5' }}>
                {formatSpan(taskContent)}
              </span>
            </div>
          );
          i++;
          continue;
        }
      }

      // Detect Ordered Lists (1. 2. 3.)
      if (/^\d+\.\s+/.test(trimmed)) {
        const numItems: string[] = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          numItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
          i++;
        }
        nodes.push(
          <ol key={`ol-${i}`} className="chat-md-ordered-list">
            {numItems.map((item, nidx) => {
              const fb = renderFabricItemBadge(item);
              return (
                <li key={nidx} className="chat-md-ordered-item">
                  <span className="order-counter">{nidx + 1}</span>
                  <div className="order-content">{fb || formatSpan(item)}</div>
                </li>
              );
            })}
          </ol>
        );
        continue;
      }

      // Detect Bullet Lists (- * • +)
      if (/^[-*•+]\s+/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && /^[-*•+]\s+/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^[-*•+]\s+/, ''));
          i++;
        }
        nodes.push(
          <ul key={`list-${i}`} className="chat-md-bullet-list">
            {listItems.map((item, lidx) => {
              const fb = renderFabricItemBadge(item);
              return (
                <li key={lidx} className="chat-md-bullet-item">
                  <span className="bullet-disc">•</span>
                  <div className="bullet-content">{fb || formatSpan(item)}</div>
                </li>
              );
            })}
          </ul>
        );
        continue;
      }

      // Empty line / spacer
      if (!trimmed) {
        nodes.push(<div key={`sp-${i}`} className="chat-md-spacer" />);
        i++;
        continue;
      }

      // Standard paragraph line
      nodes.push(
        <p key={i} className="chat-md-paragraph">
          {formatSpan(line)}
        </p>
      );
      i++;
    }

    return nodes;
  };

  const formatSpan = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    // Matches **bold**, __bold__, `code`, ~~strikethrough~~, *italic*, _italic_, [link](url)
    const inlineRegex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|~~[^~]+~~|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = inlineRegex.exec(text)) !== null) {
      if (m.index > last) {
        parts.push(text.substring(last, m.index));
      }
      const matchText = m[0];
      if ((matchText.startsWith('**') && matchText.endsWith('**')) || (matchText.startsWith('__') && matchText.endsWith('__'))) {
        parts.push(
          <strong key={m.index} className="chat-md-bold">
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        parts.push(
          <code key={m.index} className="chat-md-inline-code">
            {matchText.slice(1, -1)}
          </code>
        );
      } else if (matchText.startsWith('~~') && matchText.endsWith('~~')) {
        parts.push(
          <s key={m.index} className="chat-md-strike" style={{ textDecoration: 'line-through', color: '#71717a' }}>
            {matchText.slice(2, -2)}
          </s>
        );
      } else if ((matchText.startsWith('*') && matchText.endsWith('*')) || (matchText.startsWith('_') && matchText.endsWith('_'))) {
        parts.push(<em key={m.index} className="chat-md-italic">{matchText.slice(1, -1)}</em>);
      } else if (matchText.startsWith('[')) {
        const linkMatch = matchText.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          parts.push(
            <a
              key={m.index}
              href={linkMatch[2]}
              target="_blank"
              rel="noreferrer"
              className="chat-md-link"
            >
              {linkMatch[1]}
            </a>
          );
        }
      }
      last = inlineRegex.lastIndex;
    }

    if (last < text.length) {
      parts.push(text.substring(last));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="chat-markdown-renderer">
      {segments.map((seg, idx) => {
        if (seg.type === 'code') {
          if (!seg.code || !seg.code.trim()) return null;
          return <CodeCard key={idx} language={seg.language || 'python'} code={seg.code || ''} />;
        }
        return <React.Fragment key={idx}>{renderInlineFormatted(seg.text || '')}</React.Fragment>;
      })}
    </div>
  );
};

