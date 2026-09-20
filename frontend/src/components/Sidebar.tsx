import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  FolderTree,
  BookOpen,
  LayoutGrid,
  Settings2,
  ChevronDown,
  Search,
  PanelLeftClose,
  LogOut,
  Sliders,
  MoreVertical,
  Edit3,
  Trash2,
  Pin,
  Archive,
  ExternalLink,
  EyeOff,
  Layers,
  Folder,
  ChevronRight,
  MessageSquare,
  Users,
} from 'lucide-react';
import { ChatSession, ProjectRecord } from '../types';
import { logoutFabric } from '../services/api';
import { AccountSwitcherModal } from './auth/AccountSwitcherModal';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userName?: string;
  userEmail?: string;
  sessions?: ChatSession[];
  activeSessionId?: string;
  isLoadingSessions?: boolean;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  projects?: ProjectRecord[];
  isLoadingProjects?: boolean;
  activeProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  onTogglePinProject?: (projectId: string, currentPinned: number) => void;
  onEditProject?: (project: ProjectRecord) => void;
  onArchiveProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onRefreshStatus?: () => void;
}

const PLATFORMS = [
  { id: 'fabric', name: 'Fabric.AI', icon: '/assets/logos/abstract-shape(1).png' },
  { id: 'databricks', name: 'Databricks.AI', icon: '/assets/logos/abstract-shape-databricks.png' },
  { id: 'snowflake', name: 'Snowflake.AI', icon: '/assets/logos/abstract-shape-snowflake.png' },
  { id: 'dbt', name: 'dbt.AI', icon: '/assets/logos/abstract-shape-dbt.png' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
  userName = 'Bheesetti Harsith',
  userEmail = 'bheesetti.harsith@fabric.ai',
  sessions = [],
  activeSessionId = '',
  isLoadingSessions = false,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  projects = [],
  isLoadingProjects = false,
  activeProjectId = null,
  onSelectProject,
  onTogglePinProject,
  onEditProject,
  onArchiveProject,
  onDeleteProject,
  onRefreshStatus,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState('fabric');
  const [isPlatformMenuOpen, setIsPlatformMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isChatsOpen, setIsChatsOpen] = useState(true);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);

  // Project Item Options Menu
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [projectMenuPos, setProjectMenuPos] = useState<{ top: number; left: number } | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // Chat Item Options Menu
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Menus Refs
  const platformMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuSessionId(null);
        setMenuPos(null);
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenuId(null);
        setProjectMenuPos(null);
      }
      if (platformMenuRef.current && !platformMenuRef.current.contains(target)) {
        setIsPlatformMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuSessionId(null);
        setMenuPos(null);
        setProjectMenuId(null);
        setProjectMenuPos(null);
        setIsPlatformMenuOpen(false);
        setIsProfileMenuOpen(false);
        setRenamingSessionId(null);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const limit = 5;
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

  const handleOpenMenu = (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (menuSessionId === sid) {
      setMenuSessionId(null);
      setMenuPos(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({
      top: Math.min(rect.bottom + 4, window.innerHeight - 240),
      left: Math.min(rect.left, window.innerWidth - 220),
    });
    setMenuSessionId(sid);
  };

  const handleStartRename = (sid: string, currentTitle: string) => {
    setMenuSessionId(null);
    setMenuPos(null);
    setRenamingSessionId(sid);
    setRenamingTitle(currentTitle);
  };

  const handleSaveRename = (sid: string) => {
    if (renamingTitle.trim() && onRenameSession) {
      onRenameSession(sid, renamingTitle.trim());
    }
    setRenamingSessionId(null);
  };

  const handleDelete = (sid: string) => {
    setMenuSessionId(null);
    setMenuPos(null);
    if (onDeleteSession) {
      onDeleteSession(sid);
    }
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
              {selectedPlatform === 'fabric' ? (
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                  <path d="M16 3L3 10.5V21.5L16 29L29 21.5V10.5L16 3Z" fill="#008272"/>
                  <path d="M16 3L29 10.5V21.5L16 29V3Z" fill="#00A88F"/>
                  <path d="M16 3L29 10.5L16 18L3 10.5L16 3Z" fill="#00D2A0"/>
                </svg>
              ) : (
                <img src={activePlatformObj.icon} alt={activePlatformObj.name} className="brand-logo-img" />
              )}
            </div>
            <div className="brand-text">
              <span className="brand-title">
                {activePlatformObj.name.split('.')[0]}
                <span className="brand-accent">.{activePlatformObj.name.split('.')[1]}</span>
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
                  <img src={p.icon} className="dropdown-brand-img" alt={p.name} />
                  <span className="dropdown-brand-name">{p.name}</span>
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
              style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px', borderRadius: '4px' }}
            >
              <Plus width={13} height={13} />
            </button>
          </div>
          {isProjectsOpen && (
            <div className="sidebar-projects-list">
              {isLoadingProjects ? (
                <div className="sidebar-skeleton-list" style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="skeleton-line" style={{ height: '28px', borderRadius: '6px' }} />
                  <div className="skeleton-line" style={{ height: '28px', borderRadius: '6px' }} />
                  <div className="skeleton-line" style={{ height: '28px', borderRadius: '6px' }} />
                </div>
              ) : sortedProjects.length === 0 ? (
                <div style={{ padding: '6px 8px', fontSize: '12px', color: '#71717a' }}>
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

        {/* Chats and Tasks Accordion */}
        <div className="sidebar-section sidebar-chats-section">
          <div className="sidebar-section-header">
            <div
              className="sidebar-section-title-wrap"
              onClick={() => setIsChatsOpen(!isChatsOpen)}
            >
              <span className="sidebar-section-title">Chats & Tasks</span>
              <span className="sidebar-chevron-inline">
                <ChevronDown
                  width={11}
                  height={11}
                  style={{ transform: isChatsOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                />
              </span>
            </div>
          </div>
          {isChatsOpen && (
            <div className="chats-scroll-list">
              {isLoadingSessions ? (
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ height: '26px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', animation: 'pulse 1.5s infinite ease-in-out' }} />
                  <div style={{ height: '26px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', animation: 'pulse 1.5s infinite ease-in-out', width: '75%' }} />
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ padding: '16px 12px', fontSize: '12px', color: '#71717a', textAlign: 'center' }}>
                  No saved conversations
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.sessionId}
                    className={`sidebar-chat-item ${activeSessionId === s.sessionId ? 'active' : ''} ${menuSessionId === s.sessionId ? 'menu-open' : ''}`}
                    onClick={() => onSelectSession?.(s.sessionId)}
                    title={s.title}
                  >
                    <MessageSquare
                      width={14}
                      height={14}
                      style={{
                        color: activeSessionId === s.sessionId ? '#10b981' : '#71717a',
                        flexShrink: 0,
                      }}
                    />
                    {renamingSessionId === s.sessionId ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSaveRename(s.sessionId);
                        }}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={renamingTitle}
                          onChange={(e) => setRenamingTitle(e.target.value)}
                          onBlur={() => handleSaveRename(s.sessionId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setRenamingSessionId(null);
                          }}
                          autoFocus
                          style={{
                            width: '100%',
                            background: '#131314',
                            border: '1px solid #10b981',
                            borderRadius: '4px',
                            color: '#ffffff',
                            fontSize: '12.5px',
                            padding: '2px 6px',
                            outline: 'none',
                          }}
                        />
                      </form>
                    ) : (
                      <>
                        <span className="chat-item-text" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.title}
                        </span>
                        <button
                          type="button"
                          className="sidebar-chat-more-btn"
                          onClick={(e) => handleOpenMenu(e, s.sessionId)}
                          title="More options"
                        >
                          <MoreVertical width={13} height={13} />
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Floating Context Menu Popup for Chat */}
          {menuSessionId && menuPos && (
            <div
              ref={menuRef}
              className="sidebar-chat-menu-popup"
              style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="chat-menu-item"
                onClick={() => {
                  window.open(`/?session=${menuSessionId}`, '_blank');
                  setMenuSessionId(null);
                  setMenuPos(null);
                }}
              >
                <ExternalLink width={14} height={14} />
                <span className="menu-label">Open in new tab</span>
              </div>
              <div
                className="chat-menu-item"
                onClick={() => {
                  setMenuSessionId(null);
                  setMenuPos(null);
                }}
              >
                <Pin width={14} height={14} />
                <span className="menu-label">Pin</span>
              </div>
              <div
                className="chat-menu-item"
                onClick={() => {
                  setMenuSessionId(null);
                  setMenuPos(null);
                }}
              >
                <EyeOff width={14} height={14} />
                <span className="menu-label">Mark as unread</span>
              </div>
              <div
                className="chat-menu-item"
                onClick={() => {
                  const target = sessions.find((x) => x.sessionId === menuSessionId);
                  handleStartRename(menuSessionId, target ? target.title : '');
                }}
              >
                <Edit3 width={14} height={14} />
                <span className="menu-label">Rename</span>
              </div>
              <div
                className="chat-menu-item"
                onClick={() => {
                  setMenuSessionId(null);
                  setMenuPos(null);
                }}
              >
                <Layers width={14} height={14} />
                <span className="menu-label">Add to project</span>
                <ChevronRight width={12} height={12} className="menu-arrow" />
              </div>
              <div
                className="chat-menu-item"
                onClick={() => {
                  setMenuSessionId(null);
                  setMenuPos(null);
                }}
              >
                <Folder width={14} height={14} />
                <span className="menu-label">Move to group</span>
                <ChevronRight width={12} height={12} className="menu-arrow" />
              </div>
              <div className="chat-menu-divider" />
              <div
                className="chat-menu-item item-danger"
                onClick={() => handleDelete(menuSessionId)}
              >
                <Trash2 width={14} height={14} />
                <span className="menu-label">Delete</span>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Footer User Profile Pill */}
      <div className="sidebar-footer">
        <div className="auth-card-wrapper" ref={profileMenuRef} style={{ position: 'relative', width: '100%' }}>
          <div
            className="auth-card"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          >
            <div className="auth-user-row">
              <div className="auth-avatar-ring">
                <div className="auth-avatar-inner">{userName[0]}</div>
              </div>
              <div className="auth-info">
                <span className="auth-username">{userName}</span>
              </div>
              <span className="auth-pro-badge">PRO</span>
            </div>
          </div>

          {/* Profile Dropdown Popup */}
          {isProfileMenuOpen && (
            <div className="user-profile-menu">
              <div className="profile-menu-header">
                <div className="profile-menu-avatar">{userName[0]}</div>
                <div className="profile-menu-info">
                  <span className="profile-menu-name">{userName}</span>
                  <span className="profile-menu-email">{userEmail}</span>
                </div>
              </div>
              <div className="dock-model-divider" />
              <button
                className="profile-menu-item"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setIsAccountModalOpen(true);
                }}
              >
                <Users width={14} height={14} />
                <span>Switch Fabric Account</span>
              </button>
              <button className="profile-menu-item" onClick={() => onSelectView('settings')}>
                <Settings2 width={14} height={14} />
                <span>Settings & Customize</span>
              </button>
              <button
                className="profile-menu-item"
                onClick={async () => {
                  setIsProfileMenuOpen(false);
                  try {
                    await logoutFabric();
                    if (onRefreshStatus) onRefreshStatus();
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                <LogOut width={14} height={14} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
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
