import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Package,
  PackageOpen,
  Pin,
  ChevronDown,
  ChevronRight,
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

// Crisp, bold horizontal 3-dots icon matching the screenshot design
const HorizontalDotsIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" className="text-[#e4e4e7] hover:text-white transition-colors">
    <circle cx="3" cy="8" r="1.6" />
    <circle cx="8" cy="8" r="1.6" />
    <circle cx="13" cy="8" r="1.6" />
  </svg>
);

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
  // Highlight only the project if it is active AND no child chat is active
  const hasActiveChat = Boolean(activeSessionId && chats.some((c) => c.sessionId === activeSessionId));
  const isProjectHighlighted = isActiveProject && !hasActiveChat;

  const [isExpanded, setIsExpanded] = useState<boolean>(isActiveProject || hasActiveChat);

  // Automatically keep expanded when navigating into a project or its chats
  useEffect(() => {
    if (isActiveProject || hasActiveChat) {
      setIsExpanded(true);
    }
  }, [isActiveProject, hasActiveChat]);

  // Chat Context Menu State
  const [chatMenuId, setChatMenuId] = useState<string | null>(null);
  const [chatMenuPos, setChatMenuPos] = useState<{ top: number; left: number } | null>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);

  // Floating Full Name Tooltip State with intentional 700ms hover delay
  const [tooltipData, setTooltipData] = useState<{ text: string; top: number; left: number } | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPinned = Boolean(project.is_pinned);
  const displayName = project.name;
  const hasChats = chats.length > 0;

  useEffect(() => {
    const handleCloseMenu = (e: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) {
        setChatMenuId(null);
        setChatMenuPos(null);
      }
    };
    window.addEventListener('mousedown', handleCloseMenu);
    return () => {
      window.removeEventListener('mousedown', handleCloseMenu);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = (e: React.MouseEvent, text: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipData({
        text,
        top: rect.top + rect.height / 2,
        left: Math.min(window.innerWidth - 300, rect.right + 10),
      });
    }, 700);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setTooltipData(null);
  };

  const handleProjectClick = () => {
    handleMouseLeave();
    onSelectProject(project.id);
    if (hasChats) {
      setIsExpanded((prev) => !prev);
    }
  };

  const handleOpenChatMenu = (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (chatMenuId === sid) {
      setChatMenuId(null);
      setChatMenuPos(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setChatMenuPos({
      top: rect.bottom + 4,
      left: Math.max(12, rect.right - 140),
    });
    setChatMenuId(sid);
  };

  return (
    <div className="flex flex-col mb-0.5 select-none w-full">
      {/* Project Header Row */}
      <div
        className={`group/row relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isProjectHighlighted
            ? 'bg-[#28282c] text-[#e4e4e7] font-medium shadow-sm'
            : 'text-[#e4e4e7] hover:bg-[#1f1f23]'
        } ${isMenuOpen ? 'bg-[#1f1f23]' : ''}`}
        onClick={handleProjectClick}
        onMouseEnter={(e) => handleMouseEnter(e, displayName)}
        onMouseLeave={handleMouseLeave}
      >
        {/* Project Icon / Hover Arrow Swap (Arrow only shows when hovering directly over the icon) */}
        <div
          className="group/icon relative w-5 h-5 flex items-center justify-center flex-shrink-0 cursor-pointer"
          onClick={(e) => {
            if (hasChats) {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }
          }}
          title={hasChats ? (isExpanded ? 'Collapse chats' : 'Expand chats') : undefined}
        >
          {/* Default Project Icon: Package (closed) or PackageOpen (expanded), or Pin */}
          <span className={`${hasChats ? 'group-hover/icon:hidden' : ''} flex items-center justify-center`}>
            {isPinned ? (
              <Pin
                width={14}
                height={14}
                className={isProjectHighlighted ? 'text-white fill-[#e4e4e7]' : 'text-[#cbd5e1]'}
              />
            ) : isExpanded && hasChats ? (
              <PackageOpen width={15} height={15} className="text-[#cbd5e1]" />
            ) : (
              <Package width={15} height={15} className="text-[#cbd5e1]" />
            )}
          </span>

          {/* Hover Arrow: Swaps in place ONLY when hovering directly on the Project Icon */}
          {hasChats && (
            <span className="hidden group-hover/icon:flex w-5 h-5 rounded items-center justify-center bg-[#28282c] text-[#e4e4e7] hover:bg-[#38383e] hover:text-white transition-colors">
              {isExpanded ? (
                <ChevronDown width={12} height={12} strokeWidth={2.5} />
              ) : (
                <ChevronRight width={12} height={12} strokeWidth={2.5} />
              )}
            </span>
          )}
        </div>

        {/* Project Name (Soft off-white, smooth edge blur hiding right before the 3 dots) */}
        <span className="flex-1 min-w-0 text-[14px] font-medium tracking-tight text-[#e4e4e7] pr-7 sidebar-fade-truncate">
          {displayName}
        </span>

        {/* Horizontal 3-Dots Action Button with Gradient Blur / Haze Backdrop */}
        <div
          className={`absolute right-0 top-0 bottom-0 flex items-center pl-6 pr-1.5 rounded-r-lg opacity-0 group-hover/row:opacity-100 transition-opacity pointer-events-none ${
            isProjectHighlighted
              ? 'bg-gradient-to-r from-transparent via-[#28282c] to-[#28282c]'
              : 'bg-gradient-to-r from-transparent via-[#161618] to-[#161618] group-hover/row:via-[#1f1f23] group-hover/row:to-[#1f1f23]'
          }`}
        >
          <button
            type="button"
            onClick={(e) => onOpenProjectMenu(e, project.id)}
            title="More options"
            className="pointer-events-auto p-1 text-[#e4e4e7] hover:text-white hover:bg-[#34343a] rounded transition-all"
          >
            <HorizontalDotsIcon />
          </button>
        </div>
      </div>

      {/* Collapsible Sub-Tree: Project Chats (Spans 100% full width to match project row boundary) */}
      {isExpanded && hasChats && (
        <div className="flex flex-col my-0.5 space-y-0.5 w-full">
          {chats.map((chat) => {
            const isChatActive = activeSessionId === chat.sessionId;
            const chatTitle = chat.title || 'Conversation';
            return (
              <div
                key={chat.sessionId}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMouseLeave();
                  if (onSelectSession) onSelectSession(chat.sessionId);
                }}
                onMouseEnter={(e) => handleMouseEnter(e, chatTitle)}
                onMouseLeave={handleMouseLeave}
                role="button"
                tabIndex={0}
                className={`group/chat relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[14px] cursor-pointer transition-colors ${
                  isChatActive
                    ? 'bg-[#28282c] text-[#e4e4e7] font-medium shadow-sm'
                    : 'text-[#e4e4e7] hover:bg-[#1a1a1e]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-4 pr-7">
                  {/* Bullet Dot: Solid white when active, hollow ring when inactive */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                      isChatActive
                        ? 'bg-[#e4e4e7]'
                        : 'border border-[#71717a] group-hover/chat:border-[#a1a1aa]'
                    }`}
                  />
                  {/* Chat Title: Identical 14px size, soft off-white, smooth blur before 3 dots */}
                  <span className="min-w-0 flex-1 text-[14px] text-[#e4e4e7] sidebar-fade-truncate">
                    {chatTitle}
                  </span>
                </div>

                {/* Chat Horizontal 3-Dots Action Button with Gradient Blur / Haze Backdrop */}
                {onDeleteSession && (
                  <div
                    className={`absolute right-0 top-0 bottom-0 flex items-center pl-6 pr-1.5 rounded-r-lg opacity-0 group-hover/chat:opacity-100 transition-opacity pointer-events-none ${
                      isChatActive
                        ? 'bg-gradient-to-r from-transparent via-[#28282c] to-[#28282c]'
                        : 'bg-gradient-to-r from-transparent via-[#161618] to-[#161618] group-hover/chat:via-[#1a1a1e] group-hover/chat:to-[#1a1a1e]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleOpenChatMenu(e, chat.sessionId)}
                      title="Chat options"
                      className="pointer-events-auto p-1 text-[#e4e4e7] hover:text-white hover:bg-[#34343a] rounded transition-all"
                    >
                      <HorizontalDotsIcon />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Hover Tooltip: Matches screenshot design */}
      {tooltipData && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed pointer-events-none z-[999999] px-3 py-2 rounded-lg bg-[#18181b] border border-[#2e2f35] text-[#f4f4f5] text-[12.5px] leading-snug shadow-2xl max-w-[280px] break-words"
          style={{
            top: `${tooltipData.top}px`,
            left: `${tooltipData.left}px`,
            transform: 'translateY(-50%)',
          }}
        >
          {tooltipData.text}
        </div>,
        document.body
      )}

      {/* Floating Chat Options Menu Popup via Portal */}
      {chatMenuId && chatMenuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={chatMenuRef}
          className="sidebar-chat-menu-popup"
          style={{
            position: 'fixed',
            top: `${chatMenuPos.top}px`,
            left: `${chatMenuPos.left}px`,
            zIndex: 999999,
            background: '#18181b',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85)',
            padding: '4px',
            width: '145px',
            backdropFilter: 'blur(16px)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="chat-menu-item text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-[12.5px] transition-colors"
            onClick={() => {
              const sid = chatMenuId;
              setChatMenuId(null);
              setChatMenuPos(null);
              if (onDeleteSession) onDeleteSession(sid);
            }}
          >
            <Trash2 width={13} height={13} />
            <span>Delete chat</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
