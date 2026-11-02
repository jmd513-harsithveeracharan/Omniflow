import React, { useState, useEffect, useRef } from 'react';
import { PlatformCube } from './PlatformCube';
import {
  Plus,
  Sparkles,
  FolderTree,
  BookOpen,
  LayoutGrid,
  Network,
  Settings2,
  ChevronDown,
  Search,
  PanelLeftClose,
  Sliders,
  MoreVertical,
  Edit3,
  Trash2,
  Pin,
  Archive,
  Folder,
} from 'lucide-react';
import { ChatSession, ProjectRecord, UserProfile } from '../types';
import { AccountSwitcherModal } from './auth/AccountSwitcherModal';
import { UserProfileMenu } from './UserProfileMenu';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  currentUser?: UserProfile | null;
  onSignOut?: () => void;
  sessions?: ChatSession[];
  activeSessionId?: string;
  isLoadingSessions?: boolean;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  onMoveSessionToProject?: (sessionId: string, projectId: string) => void;
  projects?: ProjectRecord[];
  isLoadingProjects?: boolean;
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  onTogglePinProject?: (projectId: string, currentPinned: number) => void;
  onEditProject?: (project: ProjectRecord) => void;
  onArchiveProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onRefreshStatus?: () => void;
  onOpenAuthModal?: () => void;
}

interface PlatformConfig {
  id: string;
  name: string;
  platformName: string;
  flowColor: string;
}

const PLATFORMS: PlatformConfig[] = [
  { id: 'fabric', name: 'Microsoft Fabric', platformName: 'Fabric', flowColor: '#10b981' },
  { id: 'databricks', name: 'Databricks Lakehouse', platformName: 'Databricks', flowColor: '#ff3621' },
  { id: 'snowflake', name: 'Snowflake Cortex', platformName: 'Snowflake', flowColor: '#29b5e8' },
  { id: 'dbt', name: 'dbt Core & Cloud', platformName: 'dbt', flowColor: '#ff694b' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
  currentUser,
  onSignOut,
  sessions = [],
  activeSessionId = '',
  isLoadingSessions = false,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onMoveSessionToProject,
  projects = [],
  isLoadingProjects = false,
  activeProjectId = null,
  onSelectProject,
  onTogglePinProject,
  onEditProject,
  onArchiveProject,
  onDeleteProject,
  onRefreshStatus,
  onOpenAuthModal,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState('fabric');
  const [isPlatformMenuOpen, setIsPlatformMenuOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);

  // Project Item Options Menu
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [projectMenuPos, setProjectMenuPos] = useState<{ top: number; left: number } | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // Chats Section State
  const [isChatsOpen, setIsChatsOpen] = useState(true);
  const [chatMenuSessionId, setChatMenuSessionId] = useState<string | null>(null);
  const [chatMenuPos, setChatMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState<string>('');
  const [isMoveSubmenuOpen, setIsMoveSubmenuOpen] = useState<boolean>(false);
  const chatMenuRef = useRef<HTMLDivElement>(null);


  // Menus Refs
  const platformMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenuId(null);
        setProjectMenuPos(null);
      }
      if (chatMenuRef.current && !chatMenuRef.current.contains(target)) {
        setChatMenuSessionId(null);
        setChatMenuPos(null);
        setIsMoveSubmenuOpen(false);
      }
      if (platformMenuRef.current && !platformMenuRef.current.contains(target)) {
        setIsPlatformMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProjectMenuId(null);
        setProjectMenuPos(null);
        setChatMenuSessionId(null);
        setChatMenuPos(null);
        setIsMoveSubmenuOpen(false);
        setRenamingSessionId(null);
        setIsPlatformMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleOpenChatMenu = (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (chatMenuSessionId === sid) {
      setChatMenuSessionId(null);
      setChatMenuPos(null);
      setIsMoveSubmenuOpen(false);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setChatMenuPos({
      top: Math.min(rect.bottom + 4, window.innerHeight - 240),
      left: Math.min(rect.left, window.innerWidth - 220),
    });
    setChatMenuSessionId(sid);
    setIsMoveSubmenuOpen(false);
  };

  const handleStartRename = (session: ChatSession) => {
    const sId = session.sessionId || (session as any).id;
    setRenamingSessionId(sId);
    setRenamingTitle(session.title || 'Untitled Chat');
    setChatMenuSessionId(null);
    setChatMenuPos(null);
  };

  const handleSaveRename = (sid: string) => {
    if (renamingTitle.trim() && onRenameSession) {
      onRenameSession(sid, renamingTitle.trim());
    }
    setRenamingSessionId(null);
    setRenamingTitle('');
  };

  // Filter & Sort Projects: non-archived, pinned first, then updated_at
  const activeProjectsList = projects.filter((p) => !p.is_archived);
  const sortedProjects = [...activeProjectsList].sort((a, b) => {
    const pinA = a.is_pinned ? 1 : 0;
    const pinB = b.is_pinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  const limit = 20;
  const visibleProjects = isProjectsExpanded ? sortedProjects : sortedProjects.slice(0, limit);
  const hasMoreProjects = sortedProjects.length > limit;

  const handleOpenProjectMenu = (e: React.MouseEvent, pid: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (projectMenuId === pid) {
      setProjectMenuId(null);
      setProjectMenuPos(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setProjectMenuPos({
      top: Math.min(rect.bottom + 4, window.innerHeight - 200),
      left: Math.min(rect.left, window.innerWidth - 180),
    });
    setProjectMenuId(pid);
  };



  const activePlatformObj = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];

  return (
    <aside className={`studio-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand-wrapper" ref={platformMenuRef}>
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => setIsPlatformMenuOpen(!isPlatformMenuOpen)}
          >
            <div className="brand-logo-icon-wrap" style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PlatformCube platformId={selectedPlatform} size={20} />
            </div>
            <div className="brand-text">
              <span className="brand-title" style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                Omni<span className="brand-accent" style={{ color: activePlatformObj.flowColor || '#10b981', fontWeight: 700 }}>flow</span>
              </span>
            </div>
            <ChevronDown className="brand-chevron" width={11} height={11} />
          </button>

          {/* Platform Switcher Dropdown */}
          {isPlatformMenuOpen && (
            <div className="brand-dropdown-menu">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  className={`brand-dropdown-item ${selectedPlatform === p.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedPlatform(p.id);
                    setIsPlatformMenuOpen(false);
                  }}
                >
                  <PlatformCube platformId={p.id} size={20} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                    <span className="dropdown-brand-name" style={{ fontWeight: 600 }}>
                      Omni<span style={{ color: p.flowColor }}>flow</span>
                    </span>
                    <span style={{ fontSize: '10px', color: '#71717a' }}>{p.name}</span>
                  </div>
                  {selectedPlatform === p.id && <span className="dropdown-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-header-actions">
          <button
            className="sidebar-header-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <PanelLeftClose width={14} height={14} />
          </button>
          <button className="sidebar-header-btn" title="Search Chats & Items">
            <Search width={14} height={14} />
          </button>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="sidebar-nav">
        {/* + New Chat Button Card */}
        <button
          className={`sidebar-new-chat-btn ${activeView === 'chat' ? 'active' : ''}`}
          onClick={onNewChat}
        >
          <span className="nav-item-icon">
            <Plus width={18} height={18} />
          </span>
          <span>New Chat</span>
        </button>

        <button
          className={`nav-item ${activeView === 'projects' ? 'active' : ''}`}
          onClick={() => onSelectView('projects')}
        >
          <span className="nav-item-icon">
            <FolderTree width={18} height={18} />
          </span>
          <span>Projects</span>
        </button>

        <button
          className={`nav-item ${activeView === 'skills' ? 'active' : ''}`}
          onClick={() => onSelectView('skills')}
        >
          <span className="nav-item-icon">
            <BookOpen width={18} height={18} />
          </span>
          <span>Skills</span>
        </button>

        <button
          className={`nav-item ${activeView === 'workspaces' ? 'active' : ''}`}
          onClick={() => onSelectView('workspaces')}
        >
          <span className="nav-item-icon">
            <LayoutGrid width={18} height={18} />
          </span>
          <span>Workspaces</span>
        </button>

        <button
          className={`nav-item ${activeView === 'mesh' ? 'active' : ''}`}
          onClick={() => onSelectView('mesh')}
          title="Knowledge Mesh (Graph RAG)"
        >
          <span className="nav-item-icon">
            <Network width={18} height={18} />
          </span>
          <span>Knowledge Mesh</span>
        </button>

        <button
          className={`nav-item ${activeView === 'apps' ? 'active' : ''}`}
          onClick={() => onSelectView('apps')}
        >
          <span className="nav-item-icon">
            <Sliders width={18} height={18} />
          </span>
          <span>Apps & Connectors</span>
        </button>

        <button
          className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectView('settings')}
        >
          <span className="nav-item-icon">
            <Settings2 width={18} height={18} />
          </span>
          <span>Customize</span>
        </button>

        {/* Projects Accordion Section */}
        <div className="sidebar-section sidebar-projects-section">
          <div className="sidebar-section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              className="sidebar-section-title-wrap"
              onClick={() => setIsProjectsOpen(!isProjectsOpen)}
            >
              <span className="sidebar-section-title">Projects</span>
              <span className="sidebar-chevron-inline">
                <ChevronDown
                  width={11}
                  height={11}
                  style={{ transform: isProjectsOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                />
              </span>
            </div>
            <button
              type="button"
              className="sidebar-section-action-btn"
              onClick={() => onSelectView('projects')}
              title="New project / Manage projects"
              style={{ background: 'transparent', border: 'none', color: '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px', borderRadius: '4px' }}
            >
              <Plus width={13} height={13} />
            </button>
          </div>
          {isProjectsOpen && (
            <div className="sidebar-projects-list">
              {/* Top Item: Playground / Quick Scratchpad */}
              <div
                className={`sidebar-project-item ${activeProjectId === 'playground' || !activeProjectId ? 'active' : ''}`}
                onClick={() => {
                  if (onSelectProject) {
                    onSelectProject('playground');
                  }
                }}
                title="Playground - Ad-hoc data engineering tasks and testing"
                style={{ marginBottom: '6px' }}
              >
                <span className="sidebar-project-icon">
                  <Sparkles width={13} height={13} style={{ color: '#38bdf8' }} />
                </span>
                <span className="sidebar-project-name" style={{ fontWeight: 600 }}>Playground</span>
                <span
                  style={{
                    fontSize: '9.5px',
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    marginLeft: 'auto',
                  }}
                >
                  Scratchpad
                </span>
              </div>
              {isLoadingProjects ? (
                <div className="sidebar-skeleton-list" style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="skeleton-line" style={{ height: '28px', borderRadius: '6px' }} />
                  <div className="skeleton-line" style={{ height: '28px', borderRadius: '6px' }} />
                  <div className="skeleton-line" style={{ height: '28px', borderRadius: '6px' }} />
                </div>
              ) : sortedProjects.length === 0 ? (
                <div style={{ padding: '6px 8px', fontSize: '12px', color: '#94a3b8' }}>
                  No projects yet
                </div>
              ) : (
                <>
                  {visibleProjects.map((p) => {
                    const isPinned = Boolean(p.is_pinned);
                    const isActive = activeProjectId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`sidebar-project-item ${isActive ? 'active' : ''} ${isPinned ? 'pinned' : ''} ${projectMenuId === p.id ? 'menu-open' : ''}`}
                        onClick={() => {
                          if (onSelectProject) {
                            onSelectProject(p.id);
                          } else {
                            onSelectView('projects');
                          }
                        }}
                        title={p.name}
                      >
                        <span className="sidebar-project-icon">
                          {isPinned ? (
                            <Pin width={13} height={13} style={{ color: '#10b981' }} />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <rect x="4" y="3" width="16" height="5" rx="1.5" />
                              <path d="M4 8v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                              <line x1="4" y1="13" x2="20" y2="13" />
                            </svg>
                          )}
                        </span>
                        <span className="sidebar-project-name">{p.name}</span>
                        <button
                          type="button"
                          className="sidebar-project-more-btn"
                          onClick={(e) => handleOpenProjectMenu(e, p.id)}
                          title="More options"
                        >
                          <MoreVertical width={13} height={13} />
                        </button>
                      </div>
                    );
                  })}
                  {hasMoreProjects && (
                    <button
                      className="sidebar-projects-show-more-btn"
                      type="button"
                      onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                    >
                      <span>
                        {isProjectsExpanded
                          ? 'Show less'
                          : `Show ${sortedProjects.length - limit} more`}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Floating Context Menu Popup for Project */}
          {projectMenuId && projectMenuPos && (() => {
            const targetProject = sortedProjects.find((p) => p.id === projectMenuId);
            if (!targetProject) return null;
            const isPinned = Boolean(targetProject.is_pinned);
            return (
              <div
                ref={projectMenuRef}
                className="sidebar-project-menu-popup"
                style={{ top: `${projectMenuPos.top}px`, left: `${projectMenuPos.left}px` }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="sidebar-project-menu-item"
                  onClick={() => {
                    setProjectMenuId(null);
                    setProjectMenuPos(null);
                    onTogglePinProject?.(targetProject.id, targetProject.is_pinned || 0);
                  }}
                >
                  <Pin width={13} height={13} style={isPinned ? { color: '#10b981' } : undefined} />
                  <span>{isPinned ? 'Unpin' : 'Pin to top'}</span>
                </button>

                <button
                  type="button"
                  className="sidebar-project-menu-item"
                  onClick={() => {
                    setProjectMenuId(null);
                    setProjectMenuPos(null);
                    onEditProject?.(targetProject);
                  }}
                >
                  <Edit3 width={13} height={13} />
                  <span>Edit details</span>
                </button>

                <button
                  type="button"
                  className="sidebar-project-menu-item"
                  onClick={() => {
                    setProjectMenuId(null);
                    setProjectMenuPos(null);
                    onArchiveProject?.(targetProject.id);
                  }}
                >
                  <Archive width={13} height={13} />
                  <span>Archive</span>
                </button>

                <div className="chat-menu-divider" />

                <button
                  type="button"
                  className="sidebar-project-menu-item item-danger"
                  onClick={() => {
                    setProjectMenuId(null);
                    setProjectMenuPos(null);
                    onDeleteProject?.(targetProject.id);
                  }}
                >
                  <Trash2 width={13} height={13} />
                  <span>Delete</span>
                </button>
              </div>
            );
          })()}
        </div>

        {/* Chats Accordion Section */}
        <div className="sidebar-section sidebar-chats-section">
          <div className="sidebar-section-header">
            <div
              className="sidebar-section-title-wrap"
              onClick={() => setIsChatsOpen(!isChatsOpen)}
            >
              <span className="sidebar-section-title">Chats</span>
              <span className={`sidebar-chevron-inline ${!isChatsOpen ? 'collapsed' : ''}`}>
                <ChevronDown width={11} height={11} />
              </span>
            </div>
            <button
              type="button"
              className="sidebar-section-action-btn"
              onClick={onNewChat}
              title="New Chat"
              style={{ background: 'transparent', border: 'none', color: '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px', borderRadius: '4px' }}
            >
              <Plus width={13} height={13} />
            </button>
          </div>

          <div className={`chats-scroll-list ${!isChatsOpen ? 'collapsed' : ''}`}>
            {isLoadingSessions ? (
              <div className="sidebar-skeleton-list" style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skeleton-line" style={{ height: '26px', borderRadius: '6px' }} />
                <div className="skeleton-line" style={{ height: '26px', borderRadius: '6px' }} />
                <div className="skeleton-line" style={{ height: '26px', borderRadius: '6px' }} />
              </div>
            ) : sessions.length === 0 ? (
              <div className="sidebar-empty-chats">
                No recent chats
              </div>
            ) : (
              sessions.map((s) => {
                const sId = s.sessionId || (s as any).id;
                const isActive = activeSessionId === sId;
                const isRenaming = renamingSessionId === sId;

                if (isRenaming) {
                  return (
                    <div key={sId} className="sidebar-chat-item active" style={{ padding: '4px 6px' }}>
                      <input
                        type="text"
                        value={renamingTitle}
                        autoFocus
                        onChange={(e) => setRenamingTitle(e.target.value)}
                        onBlur={() => handleSaveRename(sId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(sId);
                          if (e.key === 'Escape') setRenamingSessionId(null);
                        }}
                        style={{
                          width: '100%',
                          background: '#18181b',
                          border: '1px solid #10b981',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '13px',
                          padding: '3px 6px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={sId}
                    className={`sidebar-chat-item ${isActive ? 'active' : ''} ${chatMenuSessionId === sId ? 'menu-open' : ''}`}
                    onClick={() => onSelectSession?.(sId)}
                    title={s.title || 'Untitled Chat'}
                  >
                    <span className="chat-bullet">●</span>
                    <span className="chat-item-text">{s.title || 'Untitled Chat'}</span>
                    <button
                      type="button"
                      className="sidebar-chat-more-btn"
                      onClick={(e) => handleOpenChatMenu(e, sId)}
                      title="Chat options"
                    >
                      <MoreVertical width={13} height={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Floating Context Menu Popup for Chat */}
          {chatMenuSessionId && chatMenuPos && (() => {
            const targetSession = sessions.find((s) => (s.sessionId || (s as any).id) === chatMenuSessionId);
            if (!targetSession) return null;
            const targetId = targetSession.sessionId || (targetSession as any).id;
            return (
              <div
                ref={chatMenuRef}
                className="sidebar-chat-menu-popup"
                style={{ top: `${chatMenuPos.top}px`, left: `${chatMenuPos.left}px` }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="chat-menu-item"
                  onClick={() => handleStartRename(targetSession)}
                >
                  <Edit3 width={14} height={14} />
                  <span className="menu-label">Rename</span>
                </div>

                {/* Move to Project Option */}
                <div
                  className="chat-menu-item"
                  onClick={() => setIsMoveSubmenuOpen(!isMoveSubmenuOpen)}
                  style={{ position: 'relative' }}
                >
                  <Folder width={14} height={14} />
                  <span className="menu-label">Move to project</span>
                  <span className="menu-arrow">{isMoveSubmenuOpen ? '▾' : '▸'}</span>
                </div>

                {/* Project picker submenu */}
                {isMoveSubmenuOpen && (
                  <div
                    style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      padding: '4px',
                      background: '#121214',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      margin: '4px 0',
                    }}
                  >
                    {activeProjectsList.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#71717a', padding: '6px 8px' }}>
                        No projects available
                      </div>
                    ) : (
                      activeProjectsList.map((p) => (
                        <div
                          key={p.id}
                          className="chat-menu-item"
                          style={{ padding: '5px 8px', fontSize: '12px' }}
                          onClick={() => {
                            setChatMenuSessionId(null);
                            setChatMenuPos(null);
                            setIsMoveSubmenuOpen(false);
                            onMoveSessionToProject?.(targetId, p.id);
                          }}
                        >
                          <Folder width={12} height={12} style={{ color: '#10b981' }} />
                          <span className="menu-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="chat-menu-divider" />

                <div
                  className="chat-menu-item item-danger"
                  onClick={() => {
                    setChatMenuSessionId(null);
                    setChatMenuPos(null);
                    setIsMoveSubmenuOpen(false);
                    onDeleteSession?.(targetId);
                  }}
                >
                  <Trash2 width={14} height={14} />
                  <span className="menu-label">Delete</span>
                </div>
              </div>
            );
          })()}
        </div>
      </nav>

      {/* Footer User Profile Pill & Claude Menu */}
      <div className="sidebar-footer">
        <UserProfileMenu
          currentUser={currentUser}
          isCollapsed={isCollapsed}
          onSignOut={onSignOut}
          onSelectView={onSelectView}
          onOpenAuthModal={onOpenAuthModal}
        />
      </div>

      <AccountSwitcherModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onAccountSwitched={() => {
          if (onRefreshStatus) onRefreshStatus();
        }}
      />
    </aside>
  );
};
