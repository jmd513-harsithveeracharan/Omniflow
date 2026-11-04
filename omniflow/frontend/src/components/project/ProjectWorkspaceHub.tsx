import React, { useState } from 'react';
import { Pin, MoreHorizontal, ArrowLeft, Network, Edit2, Users } from 'lucide-react';
import { ProjectRecord, ChatSession, ProjectContextFile, ProjectMetadata } from '../../types';
import { ProjectPromptBox } from './ProjectPromptBox';
import { ProjectRecentsList } from './ProjectRecentsList';
import { ProjectInstructionsCard } from './ProjectInstructionsCard';
import { ProjectContextCard } from './ProjectContextCard';

interface ProjectWorkspaceHubProps {
  project: ProjectRecord;
  sessions: ChatSession[];
  activeSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
  onStartNewChat: (prompt: string, model: string, mode: 'chat' | 'cowork') => void;
  onOpenRelationshipGraph: (projectId: string) => void;
  onBackToProjects: () => void;
  onUpdateProject: (updated: ProjectRecord) => Promise<void>;
  onTogglePin?: () => void;
  onEditProject?: (p: ProjectRecord) => void;
  onManageMembers?: (p: ProjectRecord) => void;
  onDeleteSession?: (sessionId: string) => void;
}

export const ProjectWorkspaceHub: React.FC<ProjectWorkspaceHubProps> = ({
  project,
  sessions,
  activeSessionId,
  onSelectSession,
  onStartNewChat,
  onOpenRelationshipGraph,
  onBackToProjects,
  onUpdateProject,
  onTogglePin,
  onEditProject,
  onManageMembers,
  onDeleteSession,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const isPinned = Boolean(project.is_pinned);
  const metadata = project.metadata || {};
  const contextFiles = metadata.context_files || [];
  const instructions = metadata.instructions || '';

  const handleSaveInstructions = async (newInstructions: string) => {
    const updatedMeta: ProjectMetadata = {
      ...metadata,
      instructions: newInstructions,
    };
    await onUpdateProject({
      ...project,
      metadata: updatedMeta,
    });
  };

  const handleAddContextFile = async (newFile: ProjectContextFile) => {
    const updatedFiles = [...contextFiles.filter((f) => f.id !== newFile.id), newFile];
    const updatedMeta: ProjectMetadata = {
      ...metadata,
      context_files: updatedFiles,
    };
    await onUpdateProject({
      ...project,
      metadata: updatedMeta,
    });
  };

  const handleRemoveContextFile = async (fileId: string) => {
    const updatedFiles = contextFiles.filter((f) => f.id !== fileId);
    const updatedMeta: ProjectMetadata = {
      ...metadata,
      context_files: updatedFiles,
    };
    await onUpdateProject({
      ...project,
      metadata: updatedMeta,
    });
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto bg-[#0e0e12] text-[#ececf1] selection:bg-emerald-500/30">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Navigation Breadcrumb / Back */}
        <div className="mb-4">
          <button
            type="button"
            onClick={onBackToProjects}
            className="inline-flex items-center gap-1.5 text-xs text-[#8e8ea0] hover:text-white transition-colors"
          >
            <ArrowLeft width={13} height={13} />
            <span>Projects</span>
          </button>
        </div>

        {/* Project Header */}
        <div className="flex items-start justify-between mb-8 pb-4 border-b border-[#1c1c24]">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-serif">
              {project.name}
            </h1>
            <p className="text-sm text-[#8e8ea0] leading-relaxed">
              {project.description || 'Working on the client Project where need to establish a data platform.'}
            </p>
          </div>

          {/* Top Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Relationship Graph Jump Button */}
            <button
              type="button"
              onClick={() => onOpenRelationshipGraph(project.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
              title="Open spherical relationship graph for this project"
            >
              <Network width={13} height={13} />
              <span>Relationship Graph</span>
            </button>

            {/* Pin Toggle */}
            <button
              type="button"
              onClick={onTogglePin}
              title={isPinned ? 'Unpin project' : 'Pin project'}
              className={`p-2 rounded-lg transition-colors ${
                isPinned
                  ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'text-[#8e8ea0] hover:text-white hover:bg-[#1e1e26]'
              }`}
            >
              <Pin width={16} height={16} className={isPinned ? 'fill-emerald-400' : ''} />
            </button>

            {/* More Options Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="p-2 rounded-lg text-[#8e8ea0] hover:text-white hover:bg-[#1e1e26] transition-colors"
                title="More options"
              >
                <MoreHorizontal width={16} height={16} />
              </button>

              {isMenuOpen && (
                <div
                  className="absolute right-0 mt-1 w-44 py-1 bg-[#18181f] border border-[#2b2b36] rounded-xl shadow-2xl z-50 animate-in fade-in-50 zoom-in-95"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {onEditProject && (
                    <button
                      type="button"
                      onClick={() => onEditProject(project)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#d1d1db] hover:bg-[#22222c] hover:text-white text-left transition-colors"
                    >
                      <Edit2 width={13} height={13} />
                      <span>Edit Project</span>
                    </button>
                  )}
                  {onManageMembers && (
                    <button
                      type="button"
                      onClick={() => onManageMembers(project)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#d1d1db] hover:bg-[#22222c] hover:text-white text-left transition-colors"
                    >
                      <Users width={13} height={13} />
                      <span>Manage Members</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Column: Prompt Dock + Recents (8 cols) */}
          <div className="lg:col-span-8 flex flex-col">
            <ProjectPromptBox
              projectName={project.name}
              onSubmit={onStartNewChat}
            />

            <ProjectRecentsList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={onSelectSession}
              onDeleteSession={onDeleteSession}
            />
          </div>

          {/* Right Panel: Instructions + Context (4 cols) */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            <ProjectInstructionsCard
              instructions={instructions}
              onSaveInstructions={handleSaveInstructions}
            />

            <ProjectContextCard
              files={contextFiles}
              onAddFile={handleAddContextFile}
              onRemoveFile={handleRemoveContextFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
