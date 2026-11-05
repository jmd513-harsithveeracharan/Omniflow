import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Pin,
  MoreVertical,
  Plus,
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
  onStartProjectChat,
}) => {
  // Auto-expand if this is the active project, or user manually toggles
  const [isExpanded, setIsExpanded] = useState<boolean>(isActiveProject);

  const isPinned = Boolean(project.is_pinned);
  const displayName = project.name;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const handleProjectClick = () => {
    onSelectProject(project.id);
    setIsExpanded(true);
  };

  const handleCreateChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartProjectChat) {
      onStartProjectChat(project.id);
    } else {
      onSelectProject(project.id);
    }
    setIsExpanded(true);
  };

  return (
    <div className="flex flex-col mb-1 select-none">
      {/* Project Header Row */}
      <div
        className={`group relative flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isActiveProject
            ? 'bg-[#28282c] text-white font-medium shadow-sm'
            : 'text-[#c4c7c5] hover:bg-[#1f1f23] hover:text-white'
        } ${isMenuOpen ? 'bg-[#1f1f23]' : ''}`}
        onClick={handleProjectClick}
        title={displayName}
      >
        {/* Expand / Collapse Chevron */}
        <button
          type="button"
          onClick={handleToggleExpand}
          className="p-0.5 text-[#8e918f] hover:text-white transition-colors rounded"
          title={isExpanded ? 'Collapse project chats' : 'Expand project chats'}
        >
          {isExpanded ? (
            <ChevronDown width={13} height={13} />
          ) : (
            <ChevronRight width={13} height={13} />
          )}
        </button>

        {/* Project Folder / Pin Icon */}
        <span className="flex-shrink-0">
          {isPinned ? (
            <Pin
              width={14}
              height={14}
              className={isActiveProject ? 'text-white fill-white' : 'text-[#8e918f]'}
            />
          ) : isExpanded ? (
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

        {/* Project Name (Increased font size to 14px) */}
        <span className="flex-1 min-w-0 text-[14px] font-medium tracking-tight truncate">
          {displayName}
        </span>

        {/* Fast Action: Add Chat */}
        <button
          type="button"
          onClick={handleCreateChat}
          title="New conversation in this project"
          className="opacity-0 group-hover:opacity-100 p-1 text-[#8e918f] hover:text-white hover:bg-[#2e2f35] rounded transition-all"
        >
          <Plus width={13} height={13} />
        </button>

        {/* Project More Options */}
        <button
          type="button"
          onClick={(e) => onOpenProjectMenu(e, project.id)}
          title="More options"
          className="opacity-0 group-hover:opacity-100 p-1 text-[#8e918f] hover:text-white hover:bg-[#2e2f35] rounded transition-all"
        >
          <MoreVertical width={13} height={13} />
        </button>
      </div>

      {/* Collapsible Sub-Tree: Project Chats */}
      {isExpanded && (
        <div className="flex flex-col ml-3.5 pl-2.5 my-1 border-l border-[#2e2f35]/70 space-y-0.5">
          {chats.length === 0 ? (
            <div
              onClick={handleCreateChat}
              role="button"
              tabIndex={0}
              className="py-1 px-2 text-[12px] text-[#71717a] hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Plus width={11} height={11} />
              <span>Start first chat</span>
            </div>
          ) : (
            chats.map((chat) => {
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
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
                    {/* Chat Bullet Dot: White when active, gray otherwise */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                        isChatActive
                          ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]'
                          : 'bg-[#71717a] group-hover/chat:bg-[#a1a1aa]'
                      }`}
                    />
                    <span className="truncate">{chat.title || 'Conversation'}</span>
                  </div>

                  {onDeleteSession && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(chat.sessionId);
                      }}
                      title="Delete chat"
                      className="opacity-0 group-hover/chat:opacity-100 p-0.5 text-[#71717a] hover:text-red-400 transition-opacity"
                    >
                      <Trash2 width={12} height={12} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
