import React from 'react';
import { Database, Sparkles, Layers, ShieldCheck } from 'lucide-react';

interface PlaygroundHomeProps {
  onSelectPrompt: (prompt: string) => void;
}

const SUGGESTIONS = [
  {
    icon: Database,
    title: 'Ingest Orders to Bronze',
    desc: 'Auto-discover schema, assign full/incremental strategy, and provision Lakehouse.',
    prompt: 'Ingest Orders table from Azure SQL to Bronze Lakehouse with watermark column.',
  },
  {
    icon: Layers,
    title: 'Build SCD2 Silver MERGE',
    desc: 'Generate idempotent PySpark Delta notebook with schema evolution and hash dedup.',
    prompt: 'Generate PySpark notebook to MERGE Orders into Silver Delta table using primary key order_id.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit Blast-Zone Lineage',
    desc: 'Traverse downstream DAG to identify all impacted Gold tables and Power BI reports.',
    prompt: 'Analyze downstream blast radius for dropping column customer_id from Silver customer table.',
  },
  {
    icon: Sparkles,
    title: 'Transpile T-SQL Stored Proc',
    desc: 'Transpile complex T-SQL / Oracle syntax to native Spark SQL via SQLGlot AST.',
    prompt: 'Transpile SELECT ISNULL(total, 0), GETDATE() FROM Orders TOP 10 to Spark SQL.',
  },
];

export const PlaygroundHome: React.FC<PlaygroundHomeProps> = ({ onSelectPrompt }) => {
  return (
    <div className="playground-home">
      <h1 className="playground-title">
        <img
          src="/assets/logos/abstract-shape(1).png"
          alt="Brand Logo"
          className="playground-title-logo"
        />
        <span>It's a late-night jam session.</span>
      </h1>

      <div className="playground-suggestions-grid">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.title}
              type="button"
              className="playground-suggestion-card"
              onClick={() => onSelectPrompt(s.prompt)}
            >
              <div className="suggestion-card-icon">
                <Icon width={18} height={18} />
              </div>
              <div className="suggestion-card-content">
                <span className="suggestion-card-title">{s.title}</span>
                <span className="suggestion-card-desc">{s.desc}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
