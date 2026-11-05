import React, { useState } from 'react';
import {
  Pin,
  MoreVertical,
  Trash2,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { ProjectRecord, ChatSession } from '../../types';

interface SidebarProjectTreeItemProps {
  project: ProjectRecord;
  isActiveProject: boolean;
  activeSessionId?: string;
  chats: ChatSession[];
  isMenuOpen: boolean;
  onSelectProject: (projectId: string) => void;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onOpenProjectMenu: (e: React.MouseEvent, projectId: string) => void;
  onStartProjectChat?: (projectId: string) => void;
}

export const SidebarProjectTreeItem: React.FC<SidebarProjectTreeItemProps> = ({
  project,
  isActiveProject,
  activeSessionId,
  chats,
  isMenuOpen,
  onSelectProject,
  onSelectSession,
  onDeleteSession,
  onOpenProjectMenu,
}) => {
  // Auto-expand if active project, or user clicks project
  const [isExpanded, setIsExpanded] = useState<boolean>(isActiveProject);

  const isPinned = Boolean(project.is_pinned);
  const displayName = project.name;
  const hasChats = chats.length > 0;

  const handleProjectClick = () => {
    onSelectProject(project.id);
    if (hasChats) {
      setIsExpanded((prev) => !prev);
    }
  };

  return (
    <div className="flex flex-col mb-1 select-none">
      {/* Project Header Row - No chevron arrow, perfectly aligned folder icons */}
      <div
        className={`group relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isActiveProject
            ? 'bg-[#28282c] text-white font-medium shadow-sm'
            : 'text-[#c4c7c5] hover:bg-[#1f1f23] hover:text-white'
        } ${isMenuOpen ? 'bg-[#1f1f23]' : ''}`}
        onClick={handleProjectClick}
        title={displayName}
      >
        {/* Project Folder / Pin Icon - Always flush aligned across all projects */}
        <span className="flex-shrink-0">
          {isPinned ? (
            <Pin
              width={15}
              height={15}
              className={isActiveProject ? 'text-white fill-white' : 'text-[#8e918f]'}
            />
          ) : isExpanded && hasChats ? (
            <FolderOpen
              width={15}
              height={15}
              className={isActiveProject ? 'text-white' : 'text-[#8e918f] group-hover:text-white'}
            />
          ) : (
            <Folder
              width={15}
              height={15}
              className={isActiveProject ? 'text-white' : 'text-[#8e918f] group-hover:text-white'}
            />
          )}
        </span>

        {/* Project Name (takes full space right until the end, edge-faded without '...' dots) */}
        <span className="flex-1 min-w-0 text-[14px] font-medium tracking-tight pr-5 sidebar-fade-truncate">
          {displayName}
        </span>

        {/* Project More Options (Hover action overlay at right edge) */}
        <button
          type="button"
          onClick={(e) => onOpenProjectMenu(e, project.id)}
          title="More options"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-[#8e918f] hover:text-white hover:bg-[#34343a] rounded transition-all"
        >
          <MoreVertical width={13} height={13} />
        </button>
      </div>

      {/* Collapsible Sub-Tree: Project Chats (No vertical line, no empty placeholder) */}
      {isExpanded && hasChats && (
        <div className="flex flex-col ml-3 pl-2.5 my-1 space-y-0.5">
          {chats.map((chat) => {
            const isChatActive = activeSessionId === chat.sessionId;
            return (
              <div
                key={chat.sessionId}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectSession) onSelectSession(chat.sessionId);
                }}
                role="button"
                tabIndex={0}
                className={`group/chat relative flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] cursor-pointer transition-colors ${
                  isChatActive
                    ? 'bg-[#28282c] text-white font-medium shadow-sm'
                    : 'text-[#9ca3af] hover:bg-[#1a1a1e] hover:text-white'
                }`}
                title={chat.title || 'Conversation'}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-5">
                  {/* Chat Bullet Ring: Solid filled white (no glow) when active, hollow ring when inactive */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                      isChatActive
                        ? 'bg-white'
                        : 'border border-[#71717a] group-hover/chat:border-[#a1a1aa]'
                    }`}
                  />
                  {/* Chat Title with smooth edge blur/fadeout right until the end without '...' 3 dots */}
                  <span className="min-w-0 flex-1 text-[13px] sidebar-fade-truncate">
                    {chat.title || 'Conversation'}
                  </span>
                </div>

                {onDeleteSession && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(chat.sessionId);
                    }}
                    title="Delete chat"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/chat:opacity-100 p-0.5 text-[#71717a] hover:text-red-400 transition-opacity"
                  >
                    <Trash2 width={12} height={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
