import React, { useState, useEffect } from 'react';
import { X, UploadCloud, FileCode, Sparkles, FolderArchive } from 'lucide-react';
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
  const [customText, setCustomText] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('project_intake.json');
  const [activeTab, setActiveTab] = useState<'templates' | 'upload' | 'paste'>('templates');

  useEffect(() => {
    setIsLoadingTemplates(true);
    fetchIntakeTemplates()
      .then(setTemplates)
      .finally(() => setIsLoadingTemplates(false));
  }, []);

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
    onClose();
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
        is_intake_spec: file.name.toLowerCase().includes('intake'),
        uploaded_at: 'Just now',
      };
      await onAddFile(newFile);
      onClose();
    };
    reader.readAsText(file);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#1a1a1c] border border-[#2e2f35] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#232326]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FolderArchive width={18} height={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f0f0f2]">Add Project Context</h3>
              <p className="text-[11px] text-[#8e918f]">Attach intake specs, DDL schemas, or architectural docs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8e918f] hover:text-[#f0f0f2] hover:bg-[#222225] transition-colors"
          >
            <X width={16} height={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#232326] bg-[#141416]/50">
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`pb-2.5 px-1 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'templates'
                ? 'border-emerald-500 text-[#f0f0f2]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            <Sparkles width={13} height={13} className={activeTab === 'templates' ? 'text-emerald-400' : ''} />
            <span>Intake Specs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 px-1 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'upload'
                ? 'border-emerald-500 text-[#f0f0f2]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            <UploadCloud width={13} height={13} className={activeTab === 'upload' ? 'text-emerald-400' : ''} />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`pb-2.5 px-1 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'paste'
                ? 'border-emerald-500 text-[#f0f0f2]'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            <FileCode width={13} height={13} className={activeTab === 'paste' ? 'text-emerald-400' : ''} />
            <span>Paste JSON / DDL</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-3">
          {activeTab === 'templates' && (
            <div className="space-y-2.5">
              <p className="text-xs text-[#8e918f]">
                Select an enterprise intake specification template to anchor this project's Medallion architecture:
              </p>
              {isLoadingTemplates ? (
                <div className="py-8 text-center text-xs text-[#71717a]">Loading templates...</div>
              ) : (
                templates.map((t) => (
                  <div
                    key={t.filename}
                    onClick={() => handleSelectTemplate(t)}
                    className="cursor-pointer p-3.5 rounded-xl bg-[#141416] border border-[#232326] hover:border-emerald-500/50 hover:bg-[#1a1a1c] transition-all flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-semibold text-[#f0f0f2] group-hover:text-emerald-300 truncate">
                        {t.project_name}
                      </p>
                      <p className="text-[11px] text-[#8e918f] truncate mt-0.5">
                        {t.domain} • <span className="font-mono text-[#a1a1aa]">{t.filename}</span>
                      </p>
                    </div>
                    <span className="text-[11px] px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium group-hover:bg-emerald-500/20 transition-colors flex-shrink-0">
                      Attach
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <label className="cursor-pointer flex flex-col items-center justify-center p-10 rounded-xl border-2 border-dashed border-[#2a2b30] hover:border-emerald-500/50 hover:bg-[#141416] transition-all">
              <UploadCloud width={36} height={36} className="text-[#8e918f] mb-3" />
              <span className="text-xs font-medium text-white">Choose file to upload</span>
              <span className="text-[11px] text-[#8e918f] mt-1">.json, .sql, .md, .txt, .pdf (up to 25MB)</span>
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
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="File name (e.g. project_intake.json, schema.sql)"
                className="w-full px-3.5 py-2 rounded-lg bg-[#141416] border border-[#232326] text-xs text-[#f0f0f2] placeholder-[#71717a] focus:outline-none focus:border-emerald-500/60"
              />
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste intake JSON or DDL schemas..."
                rows={9}
                className="w-full p-3.5 rounded-lg bg-[#141416] border border-[#232326] text-xs font-mono text-[#c4c7c5] placeholder-[#5c5c6b] focus:outline-none focus:border-emerald-500/60 leading-relaxed resize-none"
              />
              <button
                type="button"
                onClick={handleSavePasted}
                disabled={!customText.trim()}
                className="w-full py-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50 shadow-md"
              >
                Save & Attach to Context
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
