import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Database, FileCode, GitBranch, AlertCircle, Info, Sparkles, AlertTriangle } from 'lucide-react';
import { CodeCard } from './CodeCard';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  const renderFabricItemBadge = (text: string): React.ReactNode | null => {
    const trimmed = text.trim();
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

  return (
    <div className="chat-markdown-renderer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children || '').replace(/\n$/, '');
            const isInline = inline ?? (!match && !String(children || '').includes('\n'));

            if (!isInline && codeString.trim()) {
              const lang = match ? match[1] : 'python';
              return <CodeCard language={lang} code={codeString} />;
            }

            return (
              <code className="chat-md-inline-code" {...props}>
                {children}
              </code>
            );
          },
          blockquote({ children }: any) {
            const extractText = (c: any): string => {
              if (typeof c === 'string') return c;
              if (Array.isArray(c)) return c.map(extractText).join(' ');
              if (c?.props?.children) return extractText(c.props.children);
              return '';
            };
            const textContent = extractText(children).trim();

            const alertMatch = textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)$/i);
            if (alertMatch) {
              const type = alertMatch[1].toUpperCase();
              const alertBody = alertMatch[2].trim();
              return (
                <div className={`chat-md-callout callout-${type.toLowerCase()}`}>
                  <div className="callout-header">
                    {type === 'NOTE' && <Info width={14} height={14} />}
                    {type === 'TIP' && <Sparkles width={14} height={14} />}
                    {type === 'IMPORTANT' && <AlertCircle width={14} height={14} />}
                    {(type === 'WARNING' || type === 'CAUTION') && <AlertTriangle width={14} height={14} />}
                    <span className="callout-type">{type}</span>
                  </div>
                  <div className="callout-body">{alertBody}</div>
                </div>
              );
            }

            return <blockquote className="chat-md-blockquote">{children}</blockquote>;
          },
          table({ children }: any) {
            return (
              <div className="chat-md-table-wrapper">
                <table className="chat-md-table">{children}</table>
              </div>
            );
          },
          a({ href, children }: any) {
            return (
              <a href={href} target="_blank" rel="noreferrer" className="chat-md-link">
                {children}
              </a>
            );
          },
          li({ children, ...props }: any) {
            const str = typeof children === 'string' ? children : (Array.isArray(children) && typeof children[0] === 'string' ? children[0] : '');
            if (str) {
              const fb = renderFabricItemBadge(str);
              if (fb) return <li>{fb}</li>;
            }
            return <li {...props}>{children}</li>;
          },
          p({ children }: any) {
            if (typeof children === 'string') {
              const fb = renderFabricItemBadge(children);
              if (fb) return <>{fb}</>;
            }
            return <p className="chat-md-paragraph">{children}</p>;
          },
          h1: ({ children }: any) => <h1 className="chat-md-h1">{children}</h1>,
          h2: ({ children }: any) => <h2 className="chat-md-h2">{children}</h2>,
          h3: ({ children }: any) => <h3 className="chat-md-h3">{children}</h3>,
          h4: ({ children }: any) => <h4 className="chat-md-h4">{children}</h4>,
          h5: ({ children }: any) => <h5 className="chat-md-h5">{children}</h5>,
          h6: ({ children }: any) => <h6 className="chat-md-h6">{children}</h6>,
          hr: () => <hr className="chat-md-hr" />,
          ul: ({ children }: any) => <ul className="chat-md-bullet-list">{children}</ul>,
          ol: ({ children }: any) => <ol className="chat-md-ordered-list">{children}</ol>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

