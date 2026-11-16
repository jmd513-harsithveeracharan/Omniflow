import React, { useState, useEffect } from 'react';
import { X, UploadCloud, FileCode, Sparkles, FolderArchive, ArrowRight, FileText, Check, AlertCircle, Eye } from 'lucide-react';
import { ProjectContextFile, IntakeTemplate } from '../../types';
import { fetchIntakeTemplates } from '../../services/api';

interface ProjectAddContextModalProps {
  onAddFile: (file: ProjectContextFile) => Promise<void>;
  onClose: () => void;
}

export const ProjectAddContextModal: React.FC<ProjectAddContextModalProps> = ({
  onAddFile,
  onClose,
}) => {
  const [templates, setTemplates] = useState<IntakeTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);
  const [previewTemplate, setPreviewTemplate] = useState<IntakeTemplate | null>(null);

  const [customText, setCustomText] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('project_intake.json');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'templates' | 'upload' | 'paste'>('templates');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  useEffect(() => {
    setIsLoadingTemplates(true);
    fetchIntakeTemplates()
      .then(setTemplates)
      .finally(() => setIsLoadingTemplates(false));
  }, []);

  // Validate JSON on the fly in paste tab
  useEffect(() => {
    if (!customText.trim() || !customTitle.endsWith('.json')) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(customText);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON syntax');
    }
  }, [customText, customTitle]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(customText);
      setCustomText(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message || 'Cannot format: Invalid JSON');
    }
  };

  const handleSelectTemplate = async (tmpl: IntakeTemplate) => {
    const rawContent = JSON.stringify(tmpl.data, null, 2);
    const newFile: ProjectContextFile = {
      id: `ctx_${Date.now()}`,
      name: tmpl.filename,
      type: 'json',
      size: rawContent.length,
      content: rawContent,
      is_intake_spec: true,
      template_filename: tmpl.filename,
      uploaded_at: 'Just now',
    };
    await onAddFile(newFile);
    onClose();
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = (ev.target?.result as string) || '';
      const newFile: ProjectContextFile = {
        id: `ctx_${Date.now()}`,
        name: file.name,
        type: file.name.split('.').pop() || 'text',
        size: file.size,
        content: content,
        is_intake_spec: file.name.toLowerCase().includes('intake'),
        uploaded_at: 'Just now',
      };
      await onAddFile(newFile);
      onClose();
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleSavePasted = async () => {
    if (!customText.trim()) return;
    await onAddFile({
      id: `ctx_${Date.now()}`,
      name: customTitle.trim() || 'project_context.json',
      type: customTitle.endsWith('.sql') ? 'sql' : 'json',
      size: customText.length,
      content: customText,
      is_intake_spec: customTitle.toLowerCase().includes('intake'),
      uploaded_at: 'Just now',
    });
    setCustomText('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100050] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-gradient-to-b from-[#161619] to-[#0f0f12] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-sans select-none ring-1 ring-white/5 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-inner">
              <FolderArchive size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#f4f4f5] tracking-tight">Add Project Context</h3>
              <p className="text-[12px] text-[#8e918f] mt-0.5">Attach intake specs, DDL schemas, or architectural docs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors cursor-pointer"
            title="Close dialog (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3.5 pb-1 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/[0.08] rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-[#222226] text-white shadow-sm border border-white/10'
                  : 'text-[#8e918f] hover:text-[#d4d4d8] hover:bg-white/[0.03]'
              }`}
            >
              <Sparkles size={13} className={activeTab === 'templates' ? 'text-emerald-400' : 'text-zinc-500'} />
              <span>Intake Specs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-[#222226] text-white shadow-sm border border-white/10'
                  : 'text-[#8e918f] hover:text-[#d4d4d8] hover:bg-white/[0.03]'
              }`}
            >
              <UploadCloud size={13} className={activeTab === 'upload' ? 'text-emerald-400' : 'text-zinc-500'} />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-[#222226] text-white shadow-sm border border-white/10'
                  : 'text-[#8e918f] hover:text-[#d4d4d8] hover:bg-white/[0.03]'
              }`}
            >
              <FileCode size={13} className={activeTab === 'paste' ? 'text-emerald-400' : 'text-zinc-500'} />
              <span>Paste JSON / DDL</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-3">
          {activeTab === 'templates' && (
            <div className="space-y-3">
              <p className="text-[12px] text-zinc-400">
                Select an enterprise intake specification template to anchor this project's Medallion architecture:
              </p>
              {isLoadingTemplates ? (
                <div className="py-12 text-center text-[12px] text-zinc-500">Loading templates...</div>
              ) : (
                templates.map((t) => {
                  const dataObj = (t.data as Record<string, any>) || {};
                  const sources = dataObj.retrieved_context?.data_sources || [];
                  const sourceType = sources[0]?.system_type || 'Relational DB';
                  const tableCount = sources[0]?.tables?.length || 0;

                  return (
                    <div
                      key={t.filename}
                      className="p-3.5 rounded-xl bg-[#131316] border border-white/[0.07] hover:border-emerald-500/35 hover:bg-[#18181d] transition-all flex items-center justify-between group shadow-sm"
                    >
                      <div className="min-w-0 pr-3 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[13.5px] font-semibold text-[#f4f4f5] group-hover:text-emerald-300 truncate tracking-tight transition-colors">
                            {t.project_name}
                          </p>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 border border-white/[0.08] whitespace-nowrap">
                            {t.domain}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                          <span className="font-mono text-zinc-500">{t.filename}</span>
                          <span>•</span>
                          <span>Source: <strong className="text-zinc-300 font-normal">{sourceType}</strong></span>
                          {tableCount > 0 && (
                            <>
                              <span>•</span>
                              <span>{tableCount} tables in scope</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(t)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Preview template content"
                        >
                          <Eye size={12} />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectTemplate(t)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer"
                        >
                          <span>Attach</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Preview Drawer / Modal */}
              {previewTemplate && (
                <div className="fixed inset-0 z-[100060] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                  <div className="w-full max-w-xl bg-[#141417] border border-white/15 rounded-2xl p-5 shadow-2xl flex flex-col max-h-[80vh]">
                    <div className="flex items-center justify-between pb-3 border-b border-white/10">
                      <div>
                        <h4 className="text-[14px] font-semibold text-white">{previewTemplate.project_name}</h4>
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{previewTemplate.filename}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewTemplate(null)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <pre className="flex-1 min-h-0 overflow-y-auto p-3 mt-3 bg-black/50 border border-white/10 rounded-xl font-mono text-[11px] text-zinc-300 whitespace-pre-wrap">
                      {JSON.stringify(previewTemplate.data, null, 2)}
                    </pre>
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10 mt-3">
                      <button
                        type="button"
                        onClick={() => setPreviewTemplate(null)}
                        className="px-3 py-1.5 rounded-lg text-[12px] text-zinc-400 hover:text-white"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectTemplate(previewTemplate);
                          setPreviewTemplate(null);
                        }}
                        className="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        Attach This Spec
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <label
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
              }}
              className={`cursor-pointer flex flex-col items-center justify-center p-9 rounded-2xl border-2 border-dashed transition-all group ${
                isDragging
                  ? 'border-emerald-500/80 bg-emerald-500/[0.05]'
                  : 'border-white/10 hover:border-emerald-500/40 bg-zinc-950/40 hover:bg-zinc-900/30'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all mb-3 shadow-inner">
                <UploadCloud size={22} />
              </div>
              <span className="text-[13px] font-semibold text-zinc-200 group-hover:text-white transition-colors">
                Choose file to upload or drag & drop
              </span>
              <span className="text-[11.5px] text-[#8e918f] mt-1">
                Attach intake specs, DDL schemas, or architectural docs
              </span>
              <div className="flex items-center gap-1.5 mt-4">
                {['.JSON', '.SQL', '.MD', '.TXT', '.PDF'].map((ext) => (
                  <span key={ext} className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                    {ext}
                  </span>
                ))}
              </div>
              <input
                type="file"
                accept=".json,.sql,.md,.txt,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10.5px] font-semibold text-[#71717a] tracking-wider uppercase mb-1 px-0.5">
                  File Name
                </label>
                <div className="flex items-center gap-2 bg-[#131316] border border-white/10 focus-within:border-emerald-500/50 rounded-xl px-3 py-2 transition-all">
                  <FileText size={14} className="text-zinc-500 flex-shrink-0" />
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. project_intake.json or schema.sql"
                    className="w-full bg-transparent text-[12px] text-zinc-100 placeholder-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <div className="flex items-center gap-2">
                    <label className="text-[10.5px] font-semibold text-[#71717a] tracking-wider uppercase">
                      Specification or DDL Content
                    </label>
                    {jsonError ? (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1">
                        <AlertCircle size={10} />
                        <span>Invalid JSON</span>
                      </span>
                    ) : customText.trim() && customTitle.endsWith('.json') ? (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check size={10} />
                        <span>Valid JSON</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {customTitle.endsWith('.json') && customText.trim() && (
                      <button
                        type="button"
                        onClick={handleFormatJson}
                        className="text-[10.5px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                      >
                        Format / Prettify
                      </button>
                    )}
                    <span className="text-[10.5px] font-mono text-zinc-500">
                      {customText.length} chars
                    </span>
                  </div>
                </div>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Paste intake JSON spec, DDL schemas, or architecture markdown here..."
                  rows={9}
                  className={`w-full p-3.5 rounded-xl bg-[#0f0f12] border text-[12px] font-mono text-zinc-200 placeholder-zinc-600 leading-relaxed resize-none transition-all outline-none ${
                    jsonError ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 focus:border-emerald-500/50'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleSavePasted}
                disabled={!customText.trim() || Boolean(jsonError)}
                className="w-full py-2.5 text-[12.5px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-2"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>Save & Attach to Context</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
