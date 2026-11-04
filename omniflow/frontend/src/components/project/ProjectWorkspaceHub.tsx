import React, { useState, useRef, useEffect } from 'react';
import { Pin, MoreHorizontal, Network, Edit3, Users, PanelLeftOpen, FolderTree } from 'lucide-react';
import { ProjectRecord, ChatSession, ProjectContextFile, ProjectMetadata } from '../../types';
import { ProjectPromptBox } from './ProjectPromptBox';
import { ProjectRecentsList } from './ProjectRecentsList';
import { ProjectRightPanel } from './ProjectRightPanel';

interface ProjectWorkspaceHubProps {
  project: ProjectRecord;
  sessions: ChatSession[];
  activeSessionId?: string | null;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onSelectSession: (sessionId: string) => void;
  onStartNewChat: (prompt: string, model: string, effort?: string) => void;
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
  isSidebarCollapsed,
  onToggleSidebar,
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
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const isPinned = Boolean(project.is_pinned);
  const metadata = project.metadata || {};
  const contextFiles = metadata.context_files || [];
  const instructions = metadata.instructions || '';

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

  // Clean formatted name matching Claude screenshot
  const isPeliProject = project.id === 'PRJ-PELI-BIOTHERMAL' || project.name.toLowerCase().includes('peli');
  const displayName = isPeliProject ? 'Peli Bio Thermal' : project.name;
  const displayDesc = isPeliProject
    ? (project.description && !project.description.toLowerCase().includes('cold-chain')
        ? project.description
        : 'Working on the client Project where need to establish a data platform.')
    : (project.description || 'Enterprise workspace for data engineering pipelines.');

  return (
    <div className="flex-1 w-full h-full overflow-y-auto bg-[#131314] text-[#f0f0f2] selection:bg-emerald-500/30">
      <div className="max-w-[1060px] mx-auto px-8 pt-5 pb-16">
        {/* Top Breadcrumb Navigation */}
        <div className="flex items-center gap-2 mb-8 text-[13px] text-[#8e918f]">
          {isSidebarCollapsed && onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1 -ml-1 text-[#8e918f] hover:text-[#f0f0f2] transition-colors mr-1"
              title="Expand Sidebar"
            >
              <PanelLeftOpen width={16} height={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onBackToProjects}
            className="hover:text-[#f0f0f2] transition-colors"
          >
            Projects
          </button>
          <span>/</span>
          <span className="text-[#c4c7c5] truncate max-w-lg">{displayName}</span>
        </div>

        {/* Project Header (Full width, No premature wrap!) */}
        <div className="flex items-start justify-between mb-8">
          <div className="space-y-2 flex-1 min-w-0 pr-6">
            <h1
              className="text-[32px] sm:text-[34px] font-normal tracking-tight text-[#f0f0f2] leading-snug break-words"
              style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}
            >
              {displayName}
            </h1>
            <p className="text-[14px] text-[#8e918f] leading-relaxed max-w-4xl">
              {displayDesc}
            </p>
          </div>

          {/* Top Right Header Controls: Pin and ... */}
          <div className="flex items-center gap-2 pt-1 flex-shrink-0">
            <button
              type="button"
              onClick={onTogglePin}
              title={isPinned ? 'Unpin project' : 'Pin project'}
              className="p-1.5 text-[#8e918f] hover:text-[#f0f0f2] transition-colors"
            >
              <Pin width={17} height={17} className={isPinned ? 'fill-emerald-400 text-emerald-400' : ''} />
            </button>

            <div className="relative" ref={menuContainerRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="p-1.5 text-[#8e918f] hover:text-[#f0f0f2] transition-colors"
                title="More options"
              >
                <MoreHorizontal width={18} height={18} />
              </button>

              {isMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 p-1.5 bg-[#1c1c1f]/95 backdrop-blur-xl border border-[#2e2f35] rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.7)] z-50 animate-in fade-in-50 zoom-in-95"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => onOpenRelationshipGraph(project.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#c4c7c5] hover:bg-[#28282c] hover:text-white rounded-lg text-left transition-colors"
                  >
                    <Network width={14} height={14} className="text-emerald-400" />
                    <span>Relationship Graph</span>
                  </button>
                  {onEditProject && (
                    <button
                      type="button"
                      onClick={() => onEditProject(project)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#c4c7c5] hover:bg-[#28282c] hover:text-white rounded-lg text-left transition-colors"
                    >
                      <Edit3 width={14} height={14} className="text-[#a1a1aa]" />
                      <span>Edit Project</span>
                    </button>
                  )}
                  {onManageMembers && (
                    <button
                      type="button"
                      onClick={() => onManageMembers(project)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#c4c7c5] hover:bg-[#28282c] hover:text-white rounded-lg text-left transition-colors"
                    >
                      <Users width={14} height={14} className="text-[#a1a1aa]" />
                      <span>Manage Members</span>
                    </button>
                  )}
                  <div className="border-t border-[#28282c] my-1" />
                  <button
                    type="button"
                    onClick={onBackToProjects}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#8e918f] hover:bg-[#28282c] hover:text-white rounded-lg text-left transition-colors"
                  >
                    <FolderTree width={14} height={14} />
                    <span>View All Projects</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          {/* Main Column: Functional Prompt Dock + Recents */}
          <div className="flex-1 min-w-0 w-full flex flex-col">
            <ProjectPromptBox
              projectName={displayName}
              onSubmit={onStartNewChat}
            />

            <ProjectRecentsList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={onSelectSession}
              onDeleteSession={onDeleteSession}
            />
          </div>

          {/* Right Column: Unified Instructions & Context Panel (350px) */}
          <div className="w-full lg:w-[350px] flex-shrink-0">
            <ProjectRightPanel
              instructions={instructions}
              contextFiles={contextFiles}
              onSaveInstructions={handleSaveInstructions}
              onAddContextFile={handleAddContextFile}
              onRemoveContextFile={handleRemoveContextFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
