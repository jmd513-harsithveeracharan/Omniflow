import React, { useState, useEffect } from 'react';
import { X, UploadCloud } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'templates' | 'paste' | 'upload'>('templates');

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
        is_intake_spec: file.name.includes('intake'),
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
      is_intake_spec: customTitle.includes('intake'),
      uploaded_at: 'Just now',
    });
    setCustomText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in-50">
      <div className="w-full max-w-lg bg-[#1a1a1c] border border-[#2a2b30] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232326]">
          <h3 className="text-sm font-semibold text-[#f0f0f2]">Add Project Context</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8e918f] hover:text-white transition-colors"
          >
            <X width={16} height={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-[#232326] bg-[#141416]">
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`pb-2.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === 'templates'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
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
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
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
                : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
            }`}
          >
            Paste JSON / Text
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {activeTab === 'templates' && (
            <div className="space-y-2">
              <p className="text-xs text-[#8e918f]">
                Select an enterprise intake specification template to anchor this project's Medallion architecture:
              </p>
              {isLoadingTemplates ? (
                <div className="py-6 text-center text-xs text-[#71717a]">Loading templates...</div>
              ) : (
                templates.map((t) => (
                  <div
                    key={t.filename}
                    onClick={() => handleSelectTemplate(t)}
                    className="cursor-pointer p-3 rounded-xl bg-[#141416] border border-[#232326] hover:border-emerald-500/50 hover:bg-[#1a1a1c] transition-all flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-[#f0f0f2] group-hover:text-emerald-300 truncate">
                        {t.project_name}
                      </p>
                      <p className="text-[11px] text-[#8e918f] truncate">
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
            <label className="cursor-pointer flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-[#2a2b30] hover:border-emerald-500/50 hover:bg-[#141416] transition-all">
              <UploadCloud width={32} height={32} className="text-[#8e918f] mb-2" />
              <span className="text-xs font-medium text-white">Choose file to upload</span>
              <span className="text-[11px] text-[#8e918f] mt-1">.json, .sql, .md, .txt, .pdf</span>
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
                className="w-full px-3 py-2 rounded-lg bg-[#141416] border border-[#232326] text-xs text-[#f0f0f2] placeholder-[#71717a] focus:outline-none focus:border-emerald-500"
              />
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste intake JSON or DDL schemas..."
                rows={8}
                className="w-full p-3 rounded-lg bg-[#141416] border border-[#232326] text-xs font-mono text-[#c4c7c5] placeholder-[#5c5c6b] focus:outline-none focus:border-emerald-500 leading-relaxed resize-none"
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
  );
};

