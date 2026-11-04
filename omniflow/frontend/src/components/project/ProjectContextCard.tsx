import React, { useState, useEffect } from 'react';
import { Plus, FileText, FileJson, Eye, Trash2, X, UploadCloud } from 'lucide-react';
import { ProjectContextFile, IntakeTemplate } from '../../types';
import { fetchIntakeTemplates } from '../../services/api';
import { ProjectIntakeViewerModal } from './ProjectIntakeViewerModal';

interface ProjectContextCardProps {
  files: ProjectContextFile[];
  onAddFile: (file: ProjectContextFile) => Promise<void>;
  onRemoveFile: (fileId: string) => Promise<void>;
  disabled?: boolean;
}

export const ProjectContextCard: React.FC<ProjectContextCardProps> = ({
  files,
  onAddFile,
  onRemoveFile,
  disabled = false,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [viewingFile, setViewingFile] = useState<ProjectContextFile | null>(null);
  const [templates, setTemplates] = useState<IntakeTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('project_intake.json');
  const [activeTab, setActiveTab] = useState<'templates' | 'paste' | 'upload'>('templates');

  useEffect(() => {
    if (isAddModalOpen && templates.length === 0) {
      setIsLoadingTemplates(true);
      fetchIntakeTemplates()
        .then(setTemplates)
        .finally(() => setIsLoadingTemplates(false));
    }
  }, [isAddModalOpen, templates.length]);

  const handleSelectTemplate = async (tmpl: IntakeTemplate) => {
    const newFile: ProjectContextFile = {
      id: `ctx_${Date.now()}`,
      name: tmpl.filename,
      type: 'json',
      size: JSON.stringify(tmpl.data).length,
      content: JSON.stringify(tmpl.data, null, 2),
      is_intake_spec: true,
      template_filename: tmpl.filename,
      uploaded_at: 'Just now',
    };
    await onAddFile(newFile);
    setIsAddModalOpen(false);
  };

  const handleSavePasted = async () => {
    if (!customText.trim()) return;
    const newFile: ProjectContextFile = {
      id: `ctx_${Date.now()}`,
      name: customTitle.trim() || 'project_context.json',
      type: customTitle.endsWith('.sql') ? 'sql' : 'json',
      size: customText.length,
      content: customText,
      is_intake_spec: customTitle.includes('intake'),
      uploaded_at: 'Just now',
    };
    await onAddFile(newFile);
    setCustomText('');
    setIsAddModalOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      const newFile: ProjectContextFile = {
        id: `ctx_${Date.now()}`,
        name: file.name,
        type: file.name.split('.').pop() || 'text',
        size: file.size,
        content: content,
        is_intake_spec: file.name.includes('intake'),
        uploaded_at: 'Just now',
      };
      await onAddFile(newFile);
      setIsAddModalOpen(false);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="w-full rounded-2xl bg-[#17171c] border border-[#2b2b34] p-4 transition-all duration-200 hover:border-[#383842]">
        {/* Card Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-medium text-[#d1d1db] flex items-center gap-1.5">
            Context
          </span>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            disabled={disabled}
            className="p-1 rounded-lg text-[#8e8ea0] hover:text-white hover:bg-[#25252e] transition-colors"
            title="Add context file"
          >
            <Plus width={15} height={15} />
          </button>
        </div>

        {/* Card Body */}
        {files.length === 0 ? (
          <div
            onClick={() => setIsAddModalOpen(true)}
            className="cursor-pointer group rounded-xl bg-[#121217] border border-[#262630] hover:border-[#3a3a46] p-6 flex flex-col items-center justify-center text-center transition-all duration-200"
          >
            {/* 3 Stacked Document Icon Outlines */}
            <div className="relative w-12 h-10 mb-3 flex items-center justify-center">
              <div className="absolute left-1 top-0 w-7 h-8 rounded border border-[#3e3e4c] bg-[#1a1a22] opacity-40 transform -rotate-6" />
              <div className="absolute right-1 top-0 w-7 h-8 rounded border border-[#3e3e4c] bg-[#1a1a22] opacity-70 transform rotate-6" />
              <div className="relative z-10 w-7 h-8 rounded border border-emerald-500/40 bg-[#1c1c24] flex items-center justify-center text-emerald-400/80 group-hover:text-emerald-400 group-hover:border-emerald-500/70 transition-colors">
                <FileJson width={14} height={14} />
              </div>
            </div>

            <p className="text-xs text-[#8e8ea0] group-hover:text-[#c4c4cf] leading-relaxed max-w-[200px] transition-colors">
              Add PDFs, documents, or other text to reference in this project.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-[#131318] border border-[#262630] hover:border-[#383844] transition-all"
              >
                <div
                  className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 mr-2"
                  onClick={() => setViewingFile(f)}
                >
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 flex-shrink-0">
                    {f.type === 'json' ? <FileJson width={14} height={14} /> : <FileText width={14} height={14} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#ececf1] truncate group-hover:text-emerald-300 transition-colors">
                      {f.name}
                    </p>
                    <p className="text-[10px] text-[#71717a]">
                      {f.is_intake_spec ? 'Intake Spec' : f.type.toUpperCase()} • {(f.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewingFile(f)}
                    title="View file"
                    className="p-1 rounded text-[#71717a] hover:text-white hover:bg-[#25252e] transition-colors"
                  >
                    <Eye width={13} height={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(f.id)}
                    title="Remove file"
                    className="p-1 rounded text-[#71717a] hover:text-red-400 hover:bg-[#25252e] transition-colors"
                  >
                    <Trash2 width={13} height={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Context Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-lg bg-[#18181d] border border-[#303038] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2b2b34]">
              <h3 className="text-sm font-semibold text-white">Add Project Context</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#8e8ea0] hover:text-white transition-colors"
              >
                <X width={16} height={16} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 px-5 pt-3 border-b border-[#24242d] bg-[#141418]">
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`pb-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === 'templates'
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                Intake Templates
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`pb-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === 'upload'
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`pb-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === 'paste'
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                Paste JSON / Text
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {activeTab === 'templates' && (
                <div className="space-y-2">
                  <p className="text-xs text-[#8e8ea0]">
                    Select an enterprise intake specification template to anchor this project's Medallion architecture:
                  </p>
                  {isLoadingTemplates ? (
                    <div className="py-6 text-center text-xs text-[#71717a]">Loading templates...</div>
                  ) : (
                    templates.map((t) => (
                      <div
                        key={t.filename}
                        onClick={() => handleSelectTemplate(t)}
                        className="cursor-pointer p-3 rounded-xl bg-[#141419] border border-[#25252e] hover:border-emerald-500/50 hover:bg-[#1a1a22] transition-all flex items-center justify-between group"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold text-white group-hover:text-emerald-300 truncate">
                            {t.project_name}
                          </p>
                          <p className="text-[11px] text-[#71717a] truncate">
                            {t.domain} • <span className="font-mono">{t.filename}</span>
                          </p>
                        </div>
                        <span className="text-[11px] px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 font-medium group-hover:bg-emerald-500/20">
                          Attach
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'upload' && (
                <label className="cursor-pointer flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-[#2e2e38] hover:border-emerald-500/50 hover:bg-[#141419] transition-all">
                  <UploadCloud width={32} height={32} className="text-[#8e8ea0] mb-2" />
                  <span className="text-xs font-medium text-white">Choose file to upload</span>
                  <span className="text-[11px] text-[#71717a] mt-1">.json, .sql, .md, .txt, .pdf</span>
                  <input
                    type="file"
                    accept=".json,.sql,.md,.txt,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {activeTab === 'paste' && (
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="File name (e.g. project_intake.json)"
                    className="w-full px-3 py-2 rounded-lg bg-[#121216] border border-[#2e2e38] text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-emerald-500"
                  />
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Paste intake JSON or DDL schemas..."
                    rows={8}
                    className="w-full p-3 rounded-lg bg-[#121216] border border-[#2e2e38] text-xs font-mono text-[#d1d1db] placeholder-[#5c5c6b] focus:outline-none focus:border-emerald-500 leading-relaxed resize-none"
                  />
                  <button
                    type="button"
                    onClick={handleSavePasted}
                    disabled={!customText.trim()}
                    className="w-full py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Save & Attach
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Viewing Intake JSON Modal */}
      {viewingFile && (
        <ProjectIntakeViewerModal
          file={viewingFile}
          onClose={() => setViewingFile(null)}
        />
      )}
    </>
  );
};
