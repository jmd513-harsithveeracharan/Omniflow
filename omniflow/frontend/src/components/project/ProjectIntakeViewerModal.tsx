import React, { useState, useEffect } from 'react';
import { X, FileJson, Layers, Database, Code2, Copy, Check, Download, Loader2 } from 'lucide-react';
import { ProjectContextFile } from '../../types';
import { fetchIntakeTemplateContent } from '../../services/api';
import { IntakeArchitectureTab } from './IntakeArchitectureTab';
import { IntakeSourcesTab } from './IntakeSourcesTab';
import { IntakeRawJsonTab } from './IntakeRawJsonTab';

interface ProjectIntakeViewerModalProps {
  file: ProjectContextFile;
  onClose: () => void;
}

export const ProjectIntakeViewerModal: React.FC<ProjectIntakeViewerModalProps> = ({
  file,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'sources' | 'raw'>('architecture');
  const [content, setContent] = useState<string>(file.content || '');
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(!file.content && Boolean(file.template_filename));
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!content && file.template_filename) {
      setIsLoadingContent(true);
      fetchIntakeTemplateContent(file.template_filename)
        .then((fetched) => {
          if (fetched) setContent(fetched);
        })
        .finally(() => setIsLoadingContent(false));
    }
  }, [file, content]);

  let parsed: Record<string, any> = {};
  try {
    if (content) {
      parsed = JSON.parse(content);
    }
  } catch {
    parsed = {};
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content || '');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content || '{}'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'project_intake.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasSources = (parsed.retrieved_context?.data_sources || []).length > 0;
  const fileSizeKb = ((content?.length || file.size || 0) / 1024).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-gradient-to-b from-[#161619] to-[#0f0f12] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/5 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-inner">
              <FileJson size={18} />
            </div>
            <div>
              <h3 className="text-[14.5px] font-semibold text-[#f4f4f5] tracking-tight">{file.name}</h3>
              <p className="text-[11.5px] text-[#8e918f] mt-0.5">
                Project Intake Specification • {fileSizeKb} KB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium text-zinc-300 hover:text-white rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
            >
              {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium text-zinc-300 hover:text-white rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
              title="Download specification as JSON"
            >
              <Download size={13} />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
              title="Close modal (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-white/[0.08] bg-black/20 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-[12px] font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'architecture'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers size={13} className={activeTab === 'architecture' ? 'text-emerald-400' : 'text-zinc-500'} />
            <span>Architecture & Overview</span>
          </button>

          {hasSources && (
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className={`flex items-center gap-2 pb-2.5 px-3 text-[12px] font-medium border-b-2 transition-all cursor-pointer ${
                activeTab === 'sources'
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Database size={13} className={activeTab === 'sources' ? 'text-emerald-400' : 'text-zinc-500'} />
              <span>Data Sources & Tables</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-[12px] font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'raw'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code2 size={13} className={activeTab === 'raw' ? 'text-emerald-400' : 'text-zinc-500'} />
            <span>Raw JSON</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto">
          {isLoadingContent ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
              <span className="text-[12px]">Loading specification content...</span>
            </div>
          ) : activeTab === 'architecture' ? (
            <IntakeArchitectureTab parsed={parsed} />
          ) : activeTab === 'sources' ? (
            <IntakeSourcesTab parsed={parsed} />
          ) : (
            <IntakeRawJsonTab content={content} filename={file.name} />
          )}
        </div>
      </div>
    </div>
  );
};
