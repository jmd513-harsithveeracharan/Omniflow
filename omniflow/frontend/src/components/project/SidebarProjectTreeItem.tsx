import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Pin,
  MoreVertical,
  MessageSquare,
  Plus,
  Trash2,
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
        className={`group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isActiveProject
            ? 'bg-[#28282c] text-[#f0f0f2]'
            : 'text-[#c4c7c5] hover:bg-[#1f1f23] hover:text-[#f0f0f2]'
        } ${isMenuOpen ? 'bg-[#1f1f23]' : ''}`}
        onClick={handleProjectClick}
        title={displayName}
      >
        {/* Expand / Collapse Chevron */}
        <button
          type="button"
          onClick={handleToggleExpand}
          className="p-0.5 text-[#8e918f] hover:text-[#f0f0f2] transition-colors rounded"
          title={isExpanded ? 'Collapse project chats' : 'Expand project chats'}
        >
          {isExpanded ? (
            <ChevronDown width={12} height={12} />
          ) : (
            <ChevronRight width={12} height={12} />
          )}
        </button>

        {/* Project Icon */}
        <span className="flex-shrink-0">
          {isPinned ? (
            <Pin width={13} height={13} className="text-emerald-400 fill-emerald-400" />
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={isActiveProject ? 'text-emerald-400' : 'text-[#8e918f]'}
            >
              <rect x="4" y="3" width="16" height="5" rx="1.5" />
              <path d="M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <line x1="4" y1="13" x2="20" y2="13" />
            </svg>
          )}
        </span>

        {/* Project Name */}
        <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
          {displayName}
        </span>

        {/* Fast Action: Add Chat */}
        <button
          type="button"
          onClick={handleCreateChat}
          title="New conversation in this project"
          className="opacity-0 group-hover:opacity-100 p-1 text-[#8e918f] hover:text-emerald-400 hover:bg-[#2e2f35] rounded transition-all"
        >
          <Plus width={12} height={12} />
        </button>

        {/* Project More Options */}
        <button
          type="button"
          onClick={(e) => onOpenProjectMenu(e, project.id)}
          title="More options"
          className="opacity-0 group-hover:opacity-100 p-1 text-[#8e918f] hover:text-[#f0f0f2] hover:bg-[#2e2f35] rounded transition-all"
        >
          <MoreVertical width={12} height={12} />
        </button>
      </div>

      {/* Collapsible Sub-Tree: Project Chats */}
      {isExpanded && (
        <div className="flex flex-col ml-3 pl-2.5 my-0.5 border-l border-[#2e2f35]/60 space-y-0.5">
          {chats.length === 0 ? (
            <div
              onClick={handleCreateChat}
              role="button"
              tabIndex={0}
              className="py-1 px-2 text-[11.5px] text-[#71717a] hover:text-[#10b981] cursor-pointer flex items-center gap-1.5 transition-colors"
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
                  className={`group/chat relative flex items-center justify-between px-2 py-1 rounded-md text-[12.5px] cursor-pointer transition-colors ${
                    isChatActive
                      ? 'bg-[#1e1e22] text-[#10b981] font-medium'
                      : 'text-[#9ca3af] hover:bg-[#1a1a1e] hover:text-[#f3f4f6]'
                  }`}
                  title={chat.title || 'Conversation'}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                    <MessageSquare
                      width={12}
                      height={12}
                      className={isChatActive ? 'text-[#10b981]' : 'text-[#71717a] group-hover/chat:text-[#a1a1aa]'}
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
                      <Trash2 width={11} height={11} />
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
