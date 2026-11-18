import React, { useState } from 'react';
import { Eye, ArrowRight, X, Database, Layers, CheckCircle2 } from 'lucide-react';
import { IntakeTemplate } from '../../types';

interface ContextTemplatesTabProps {
  templates: IntakeTemplate[];
  isLoading: boolean;
  onSelectTemplate: (template: IntakeTemplate) => void;
}

export const ContextTemplatesTab: React.FC<ContextTemplatesTabProps> = ({
  templates,
  isLoading,
  onSelectTemplate,
}) => {
  const [previewTemplate, setPreviewTemplate] = useState<IntakeTemplate | null>(null);

  if (isLoading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin mb-3" />
        <p className="text-[13px] text-zinc-400">Loading enterprise intake specifications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <p className="text-[13px] text-zinc-400 leading-normal">
          Select a pre-architected enterprise intake specification to ground Medallion pipeline generation:
        </p>
        <span className="text-[11px] font-mono text-zinc-500 shrink-0">
          {templates.length} templates available
        </span>
      </div>

      <div className="space-y-2.5">
        {templates.map((t) => {
          const dataObj = (t.data as Record<string, unknown>) || {};
          const retContext = (dataObj.retrieved_context as Record<string, unknown>) || {};
          const sources = (retContext.data_sources as Array<Record<string, unknown>>) || [];
          const primarySource = sources[0] || {};
          const sourceType = (primarySource.system_type as string) || 'Relational Database';
          const tableList = (primarySource.tables as unknown[]) || [];
          const tableCount = tableList.length || 0;

          return (
            <div
              key={t.filename}
              className="p-4 rounded-xl bg-[#141418] border border-white/[0.08] hover:border-emerald-500/40 hover:bg-[#18181e] transition-all group shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3.5"
            >
              {/* Left Column: Full title, domain badge, details */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h4 className="text-[14.5px] font-semibold text-white group-hover:text-emerald-300 transition-colors tracking-tight">
                    {t.project_name}
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Layers size={11} />
                    <span>{t.domain}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-400">
                  <span className="font-mono text-zinc-500 text-[11.5px]">{t.filename}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    <Database size={11} className="text-zinc-400" />
                    <span>{sourceType}</span>
                  </span>
                  {tableCount > 0 && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-400">{tableCount} tables cataloged</span>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(t)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Preview full JSON spec"
                >
                  <Eye size={13} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTemplate(t)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                >
                  <span>Attach</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal Drawer */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-[100060] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#141418] border border-white/15 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[82vh] animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="space-y-0.5">
                <h4 className="text-[15px] font-semibold text-white tracking-tight">
                  {previewTemplate.project_name}
                </h4>
                <p className="text-[12px] text-zinc-400 font-mono">
                  {previewTemplate.filename} • {previewTemplate.domain}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <pre className="flex-1 min-h-0 overflow-y-auto p-4 mt-4 bg-black/60 border border-white/10 rounded-xl font-mono text-[11.5px] text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
              {JSON.stringify(previewTemplate.data, null, 2)}
            </pre>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10 mt-4">
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 rounded-xl text-[12.5px] text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }}
                className="px-5 py-2 rounded-xl text-[12.5px] font-semibold bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 transition-all"
              >
                <CheckCircle2 size={14} />
                <span>Attach Spec to Project</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
