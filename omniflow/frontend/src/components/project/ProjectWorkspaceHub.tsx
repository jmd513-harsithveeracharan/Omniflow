import React, { useState, useRef, useEffect } from 'react';
import { Pin, MoreHorizontal, Network, Edit3, Trash2, PanelLeftOpen, FolderTree } from 'lucide-react';
import { ProjectRecord, ChatSession, ProjectContextFile, ProjectMetadata } from '../../types';
import { PromptDock } from '../PromptDock';
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
  onEditProject?: (p: ProjectRecord, initialTab?: 'general' | 'workspaces' | 'team' | 'git') => void;
  onDeleteProject?: (projectId: string) => void;
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
  onDeleteProject,
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

  // Clean formatted name
  const rawName = project.name || '';
  const isPeliProject = project.id === 'PRJ-PELI-BIOTHERMAL' || rawName.toLowerCase().includes('peli');
  const cleanFallbackName = (project.id || '').startsWith('PRJ-')
    ? project.id.replace(/^PRJ-/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
    : (project.id || '');

  const displayName = isPeliProject
    ? 'Peli Bio Thermal'
    : (rawName && !rawName.startsWith('PRJ-') ? rawName : (cleanFallbackName || 'Project'));
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

        {/* Project Header (Full width, Sans-serif Modern Typography) */}
        <div className="flex items-start justify-between mb-8">
          <div className="space-y-2 flex-1 min-w-0 pr-6">
            <h1 className="text-[30px] sm:text-[34px] font-semibold tracking-tight text-[#f0f0f2] leading-snug break-words">
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
              <Pin width={17} height={17} className={isPinned ? 'fill-zinc-300 text-zinc-300' : ''} />
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
                  className="sidebar-chat-menu-popup"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '195px',
                    zIndex: 999999,
                  }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div
                    className="chat-menu-item"
                    onClick={() => onOpenRelationshipGraph(project.id)}
                  >
                    <Network width={13} height={13} style={{ color: '#94a3b8' }} />
                    <span className="menu-label">Relationship Graph</span>
                  </div>

                  {onEditProject && (
                    <div
                      className="chat-menu-item"
                      onClick={() => onEditProject(project, 'general')}
                    >
                      <Edit3 width={13} height={13} style={{ color: '#94a3b8' }} />
                      <span className="menu-label">Edit details</span>
                    </div>
                  )}

                  <div className="chat-menu-divider" />

                  <div
                    className="chat-menu-item"
                    onClick={onBackToProjects}
                  >
                    <FolderTree width={13} height={13} style={{ color: '#94a3b8' }} />
                    <span className="menu-label">View All Projects</span>
                  </div>

                  {onDeleteProject && (
                    <>
                      <div className="chat-menu-divider" />
                      <div
                        className="chat-menu-item item-danger"
                        onClick={() => {
                          const name = project.name || project.id;
                          if (window.confirm(`Are you sure you want to delete "${name}"? This will remove all local mappings and lineage history.`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                      >
                        <Trash2 width={13} height={13} />
                        <span className="menu-label">Delete project</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          {/* Main Column: Exact Native Omniflow Prompt Dock + Recents */}
          <div className="flex-1 min-w-0 w-full flex flex-col">
            <div className="w-full project-prompt-dock-container">
              <PromptDock
                onSendMessage={(text, model, effort) => {
                  onStartNewChat(text, model || 'Tenali AI', effort || 'medium');
                }}
                isStreaming={false}
                activeProjectId={project.id}
              />
            </div>

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
