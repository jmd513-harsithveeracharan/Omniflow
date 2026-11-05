import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PlatformCube } from './PlatformCube';
import {
  Plus,
  FolderTree,
  BookOpen,
  LayoutGrid,
  Network,
  Settings2,
  ChevronDown,
  Search,
  PanelLeftClose,
  Sliders,
  Edit3,
  Trash2,
  Pin,
  Archive,
} from 'lucide-react';
import { ChatSession, ProjectRecord, UserProfile } from '../types';
import { AccountSwitcherModal } from './auth/AccountSwitcherModal';
import { UserProfileMenu } from './UserProfileMenu';
import { SidebarProjectTreeItem } from './project/SidebarProjectTreeItem';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  onNewChat?: () => void;
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
  onStartProjectChat?: (projectId: string) => void;
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
  onNewChat: _onNewChat,
  isCollapsed,
  onToggleCollapse,
  currentUser,
  onSignOut,
  sessions = [],
  activeSessionId = '',
  isLoadingSessions: _isLoadingSessions = false,
  onSelectSession,
  onDeleteSession,
  onRenameSession: _onRenameSession,
  onMoveSessionToProject: _onMoveSessionToProject,
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
  onStartProjectChat,
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
      if (platformMenuRef.current && !platformMenuRef.current.contains(target)) {
        setIsPlatformMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProjectMenuId(null);
        setProjectMenuPos(null);
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
    const menuWidth = 190;
    const menuHeight = 200;
    let left = rect.right + 6;
    if (left + menuWidth > window.innerWidth - 12) {
      left = Math.max(12, rect.left - menuWidth - 6);
    }
    let top = rect.top - 4;
    if (top + menuHeight > window.innerHeight - 16) {
      top = Math.max(12, window.innerHeight - menuHeight - 16);
    }
    setProjectMenuPos({ top, left });
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
        <button
          className={`nav-item ${activeView === 'projects' || activeView === 'project' ? 'active' : ''}`}
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
          title="Relationship Graph"
        >
          <span className="nav-item-icon">
            <Network width={18} height={18} />
          </span>
          <span>Relationship Graph</span>
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
                    const projectChats = sessions.filter(
                      (s) => s.projectId === p.id || s.sessionId.startsWith(`proj_${p.id}`)
                    );
                    return (
                      <SidebarProjectTreeItem
                        key={p.id}
                        project={p}
                        isActiveProject={activeProjectId === p.id}
                        activeSessionId={activeSessionId}
                        chats={projectChats}
                        isMenuOpen={projectMenuId === p.id}
                        onSelectProject={(pid) => {
                          if (onSelectProject) {
                            onSelectProject(pid);
                          } else {
                            onSelectView('projects');
                          }
                        }}
                        onSelectSession={onSelectSession}
                        onDeleteSession={onDeleteSession}
                        onOpenProjectMenu={handleOpenProjectMenu}
                        onStartProjectChat={onStartProjectChat}
                      />
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

          {/* Floating Context Menu Popup for Project via Portal (Matching Chat Menu Design) */}
          {projectMenuId && projectMenuPos && typeof document !== 'undefined' && createPortal(
            (() => {
              const targetProject = sortedProjects.find((p) => p.id === projectMenuId);
              if (!targetProject) return null;
              const isPinned = Boolean(targetProject.is_pinned);
              return (
                <div
                  ref={projectMenuRef}
                  className="sidebar-chat-menu-popup"
                  style={{
                    position: 'fixed',
                    top: `${projectMenuPos.top}px`,
                    left: `${projectMenuPos.left}px`,
                    zIndex: 999999,
                    background: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 48px rgba(0, 0, 0, 0.9)',
                    padding: '6px',
                    width: '190px',
                    backdropFilter: 'blur(16px)',
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="chat-menu-item"
                    onClick={() => {
                      setProjectMenuId(null);
                      setProjectMenuPos(null);
                      onTogglePinProject?.(targetProject.id, targetProject.is_pinned || 0);
                    }}
                  >
                    <Pin width={14} height={14} style={isPinned ? { color: '#10b981' } : undefined} />
                    <span className="menu-label">{isPinned ? 'Unpin' : 'Pin to top'}</span>
                  </div>

                  <div
                    className="chat-menu-item"
                    onClick={() => {
                      setProjectMenuId(null);
                      setProjectMenuPos(null);
                      onEditProject?.(targetProject);
                    }}
                  >
                    <Edit3 width={14} height={14} />
                    <span className="menu-label">Edit details</span>
                  </div>

                  <div
                    className="chat-menu-item"
                    onClick={() => {
                      setProjectMenuId(null);
                      setProjectMenuPos(null);
                      onArchiveProject?.(targetProject.id);
                    }}
                  >
                    <Archive width={14} height={14} />
                    <span className="menu-label">Archive</span>
                  </div>

                  <div className="chat-menu-divider" />

                  <div
                    className="chat-menu-item item-danger"
                    onClick={() => {
                      setProjectMenuId(null);
                      setProjectMenuPos(null);
                      onDeleteProject?.(targetProject.id);
                    }}
                  >
                    <Trash2 width={14} height={14} />
                    <span className="menu-label">Delete</span>
                  </div>
                </div>
              );
            })(),
            document.body
          )}
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
          onOpenAccountSwitcher={() => setIsAccountModalOpen(true)}
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
