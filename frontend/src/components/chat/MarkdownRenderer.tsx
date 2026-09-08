import React from 'react';
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

  const renderInlineFormatted = (text: string): React.ReactNode => {
    // Process markdown tables if present
    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Detect Markdown Table
      if (line.trim().startsWith('|') && line.trim().endsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length >= 2) {
          const headers = tableLines[0].split('|').slice(1, -1).map(c => c.trim());
          const rows = tableLines.slice(2).map(r => r.split('|').slice(1, -1).map(c => c.trim()));
          nodes.push(
            <div key={`table-${i}`} className="chat-md-table-wrapper" style={{ overflowX: 'auto', margin: '10px 0' }}>
              <table className="chat-md-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', textAlign: 'left' }}>
                    {headers.map((h, hi) => (
                      <th key={hi} style={{ padding: '6px 10px', color: '#93c5fd', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {r.map((cell, ci) => (
                        <td key={ci} style={{ padding: '6px 10px', color: '#d4d4d8' }}>{formatSpan(cell)}</td>
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
        nodes.push(<h5 key={i} className="chat-md-h5" style={{ fontSize: '13.5px', fontWeight: 600, color: '#f4f4f5', margin: '10px 0 4px 0' }}>{formatSpan(line.replace('#### ', ''))}</h5>);
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        nodes.push(<h4 key={i} className="chat-md-h4" style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', margin: '12px 0 6px 0' }}>{formatSpan(line.replace('### ', ''))}</h4>);
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        nodes.push(<h3 key={i} className="chat-md-h3" style={{ fontSize: '16.5px', fontWeight: 600, color: '#f4f4f5', margin: '14px 0 8px 0' }}>{formatSpan(line.replace('## ', ''))}</h3>);
        i++;
        continue;
      }
      if (line.startsWith('# ')) {
        nodes.push(<h2 key={i} className="chat-md-h2" style={{ fontSize: '18px', fontWeight: 700, color: '#f4f4f5', margin: '16px 0 10px 0' }}>{formatSpan(line.replace('# ', ''))}</h2>);
        i++;
        continue;
      }

      // Detect Bullet Lists
      if (/^[-*•]\s+/.test(line.trim())) {
        const listItems: string[] = [];
        while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
          i++;
        }
        nodes.push(
          <ul key={`list-${i}`} className="chat-md-list" style={{ margin: '6px 0', paddingLeft: '18px', listStyleType: 'disc' }}>
            {listItems.map((item, lidx) => (
              <li key={lidx} className="chat-md-list-item" style={{ marginBottom: '4px', lineHeight: '1.5' }}>
                {formatSpan(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Empty line / spacer
      if (!line.trim()) {
        nodes.push(<div key={i} style={{ height: '8px' }} />);
        i++;
        continue;
      }

      // Standard paragraph line
      nodes.push(
        <p key={i} style={{ margin: '3px 0', lineHeight: '1.55', color: '#e4e4e7' }}>
          {formatSpan(line)}
        </p>
      );
      i++;
    }

    return nodes;
  };

  const formatSpan = (text: string): React.ReactNode => {
    // Process bold, inline code, italics, and markdown links
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
          <strong key={m.index} style={{ fontWeight: 600, color: '#ffffff' }}>
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        parts.push(
          <code
            key={m.index}
            className="chat-md-code"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 5px',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono, "Roboto Mono", monospace)',
              color: '#38bdf8',
            }}
          >
            {matchText.slice(1, -1)}
          </code>
        );
      } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
        parts.push(<em key={m.index} style={{ color: '#a1a1aa' }}>{matchText.slice(1, -1)}</em>);
      } else if (matchText.startsWith('[')) {
        const linkMatch = matchText.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          parts.push(
            <a
              key={m.index}
              href={linkMatch[2]}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#38bdf8', textDecoration: 'underline' }}
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
