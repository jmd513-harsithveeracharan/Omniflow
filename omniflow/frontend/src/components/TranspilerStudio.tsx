import React, { useState } from 'react';
import { Terminal, ArrowRight, Copy, Check, Sparkles, Loader2 } from 'lucide-react';
import { transpileSql } from '../services/api';
import { TranspileResult } from '../types';

export const TranspilerStudio: React.FC = () => {
  const [sourceSql, setSourceSql] = useState(
    'SELECT TOP 50 OrderID, CustomerID, ISNULL(Discount, 0) as Discount, GETDATE() as IngestTime FROM [dbo].[Orders] WITH (NOLOCK) WHERE Status = 1'
  );
  const [dialect, setDialect] = useState('tsql');
  const [result, setResult] = useState<TranspileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTranspile = async () => {
    if (!sourceSql.trim()) return;
    setLoading(true);
    try {
      const res = await transpileSql(sourceSql, dialect);
      setResult(res);
    } catch (e) {
      alert(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.sparkSql) return;
    navigator.clipboard.writeText(result.sparkSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080d17] p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Terminal className="w-4 h-4 text-brand-cyan" />
          <span>SQLGlot AST Transpilation & Lineage Engine</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
            className="bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
          >
            <option value="tsql">T-SQL (SQL Server / Azure SQL)</option>
            <option value="oracle">Oracle PL/SQL</option>
            <option value="snowflake">Snowflake</option>
            <option value="postgres">PostgreSQL</option>
          </select>

          <button
            onClick={handleTranspile}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg bg-brand-primary hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-brand-primary/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Transpile to Spark SQL
          </button>
        </div>
      </div>

      {/* Editor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {/* Source SQL Editor */}
        <div className="flex flex-col glass-panel rounded-xl p-3 border border-border">
          <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center justify-between">
            <span className="uppercase font-semibold text-brand-cyan">Source Dialect ({dialect})</span>
            <span>Raw Query</span>
          </div>
          <textarea
            value={sourceSql}
            onChange={(e) => setSourceSql(e.target.value)}
            className="flex-1 w-full bg-slate-950/60 rounded-lg p-3 text-xs font-mono text-slate-200 border border-border/50 focus:outline-none focus:border-brand-primary resize-none"
            rows={12}
          />
        </div>

        {/* Transpiled Spark SQL */}
        <div className="flex flex-col glass-panel rounded-xl p-3 border border-border relative">
          <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center justify-between">
            <span className="uppercase font-semibold text-emerald-400 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> Target Dialect (Spark SQL)
            </span>
            {result?.sparkSql && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <pre className="flex-1 w-full bg-slate-950/60 rounded-lg p-3 text-xs font-mono text-emerald-300 border border-border/50 overflow-auto whitespace-pre-wrap">
            {result ? result.sparkSql : '-- Click "Transpile to Spark SQL" to convert syntax...'}
          </pre>
        </div>
      </div>
    </div>
  );
};
