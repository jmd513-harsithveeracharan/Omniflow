import React, { useState, useEffect } from 'react';
import { X, Sparkles, UploadCloud, FileCode, FolderArchive } from 'lucide-react';
import { ProjectContextFile, IntakeTemplate } from '../../types';
import { fetchIntakeTemplates } from '../../services/api';
import { ContextTemplatesTab } from './ContextTemplatesTab';
import { ContextUploadTab } from './ContextUploadTab';
import { ContextPasteTab } from './ContextPasteTab';

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
  const [activeTab, setActiveTab] = useState<'templates' | 'upload' | 'paste'>('templates');

  const [customText, setCustomText] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('project_intake.json');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  useEffect(() => {
    setIsLoadingTemplates(true);
    fetchIntakeTemplates()
      .then(setTemplates)
      .finally(() => setIsLoadingTemplates(false));
  }, []);

  // Validate JSON in real-time when on paste tab
  useEffect(() => {
    if (!customText.trim() || !customTitle.endsWith('.json')) {
      setJsonError(null);
      return;
    }
    try {
      JSON.parse(customText);
      setJsonError(null);
    } catch (e: unknown) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON format');
    }
  }, [customText, customTitle]);

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(customText);
      setCustomText(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (e: unknown) {
      setJsonError(e instanceof Error ? e.message : 'Cannot prettify: Invalid JSON');
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
      className="fixed inset-0 z-[100050] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-gradient-to-b from-[#18181c] to-[#101014] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-sans select-none ring-1 ring-white/5 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with generous, spacious padding */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/20">
              <FolderArchive size={20} />
            </div>
            <div>
              <h3 className="text-[18px] font-semibold text-white tracking-tight">Add Project Context</h3>
              <p className="text-[13px] text-zinc-400 mt-1">
                Attach intake specs, DDL schemas, or architectural documentation to anchor pipeline synthesis
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close dialog (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-8 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/[0.08] rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-[#222228] text-white shadow-sm border border-white/10'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
              }`}
            >
              <Sparkles size={14} className={activeTab === 'templates' ? 'text-emerald-400' : 'text-zinc-500'} />
              <span>Intake Specs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-[#222228] text-white shadow-sm border border-white/10'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
              }`}
            >
              <UploadCloud size={14} className={activeTab === 'upload' ? 'text-emerald-400' : 'text-zinc-500'} />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[12.5px] font-medium transition-all cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-[#222228] text-white shadow-sm border border-white/10'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
              }`}
            >
              <FileCode size={14} className={activeTab === 'paste' ? 'text-emerald-400' : 'text-zinc-500'} />
              <span>Paste JSON / DDL</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="px-8 py-5 flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'templates' && (
            <ContextTemplatesTab
              templates={templates}
              isLoading={isLoadingTemplates}
              onSelectTemplate={handleSelectTemplate}
            />
          )}

          {activeTab === 'upload' && (
            <ContextUploadTab
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              onProcessFile={processFile}
            />
          )}

          {activeTab === 'paste' && (
            <ContextPasteTab
              customTitle={customTitle}
              setCustomTitle={setCustomTitle}
              customText={customText}
              setCustomText={setCustomText}
              jsonError={jsonError}
              onFormatJson={handleFormatJson}
              onSavePasted={handleSavePasted}
            />
          )}
        </div>
      </div>
    </div>
  );
};
