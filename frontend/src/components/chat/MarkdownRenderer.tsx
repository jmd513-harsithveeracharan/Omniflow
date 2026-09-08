import React from 'react';
import { Database, FileCode, GitBranch, AlertCircle, Info, Sparkles, AlertTriangle } from 'lucide-react';
import { CodeCard } from './CodeCard';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // 1. Separate code blocks and text segments
  const segments: Array<{ type: 'text' | 'code'; language?: string; code?: string; text?: string }> = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        text: content.substring(lastIndex, match.index),
      });
    }
    segments.push({
      type: 'code',
      language: (match[1] || 'python').toLowerCase().trim(),
      code: match[2] || '',
    });
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      text: content.substring(lastIndex),
    });
  }

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

      // Detect Blockquote / Callout (e.g., > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING])
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
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length >= 2) {
          const headers = tableLines[0].split('|').slice(1, -1).map((c) => c.trim());
          const rows = tableLines.slice(2).map((r) => r.split('|').slice(1, -1).map((c) => c.trim()));
          nodes.push(
            <div key={`table-${i}`} className="chat-md-table-wrapper">
              <table className="chat-md-table">
                <thead>
                  <tr>
                    {headers.map((h, hi) => (
                      <th key={hi}>{h}</th>
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

      // Detect Headings
      if (line.startsWith('#### ')) {
        nodes.push(<h5 key={i} className="chat-md-h5">{formatSpan(line.replace('#### ', ''))}</h5>);
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        nodes.push(<h4 key={i} className="chat-md-h4">{formatSpan(line.replace('### ', ''))}</h4>);
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        nodes.push(<h3 key={i} className="chat-md-h3">{formatSpan(line.replace('## ', ''))}</h3>);
        i++;
        continue;
      }
      if (line.startsWith('# ')) {
        nodes.push(<h2 key={i} className="chat-md-h2">{formatSpan(line.replace('# ', ''))}</h2>);
        i++;
        continue;
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

      // Detect Bullet Lists (- * •)
      if (/^[-*•]\s+/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
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
    const inlineRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = inlineRegex.exec(text)) !== null) {
      if (m.index > last) {
        parts.push(text.substring(last, m.index));
      }
      const matchText = m[0];
      if (matchText.startsWith('**') && matchText.endsWith('**')) {
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
      } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
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
          return <CodeCard key={idx} language={seg.language || 'python'} code={seg.code || ''} />;
        }
        return <React.Fragment key={idx}>{renderInlineFormatted(seg.text || '')}</React.Fragment>;
      })}
    </div>
  );
};

