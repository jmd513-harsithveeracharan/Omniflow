import React, { useState } from 'react';
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
  MessageSquare,
} from 'lucide-react';
import { ChatSession } from '../types';

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
  onSelectSession?: (sessionId: string) => void;
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
  onSelectSession,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState('fabric');
  const [isPlatformMenuOpen, setIsPlatformMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isChatsOpen, setIsChatsOpen] = useState(true);

  const activePlatformObj = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];

  return (
    <aside className={`studio-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand-wrapper">
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => setIsPlatformMenuOpen(!isPlatformMenuOpen)}
          >
            <img src={activePlatformObj.icon} alt="Brand" className="brand-logo-img" />
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
          <div className="sidebar-section-header">
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
          </div>
          {isProjectsOpen && (
            <div className="sidebar-projects-list">
              <div className="sidebar-project-item active">
                <span className="project-bullet" />
                <span>Enterprise Retail Medallion</span>
              </div>
            </div>
          )}
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
              {sessions.length === 0 ? (
                <div className="sidebar-chat-item active">
                  <MessageSquare width={13} height={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                  <span>Architect Orders Medallion Flow</span>
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.sessionId}
                    className={`sidebar-chat-item ${activeSessionId === s.sessionId ? 'active' : ''}`}
                    onClick={() => onSelectSession?.(s.sessionId)}
                    title={s.title}
                  >
                    <MessageSquare width={13} height={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Footer User Profile Pill */}
      <div className="sidebar-footer">
        <div className="auth-card-wrapper" style={{ position: 'relative', width: '100%' }}>
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
              <button className="profile-menu-item" onClick={() => onSelectView('settings')}>
                <Settings2 width={14} height={14} />
                <span>Settings & Customize</span>
              </button>
              <button className="profile-menu-item" onClick={() => setIsProfileMenuOpen(false)}>
                <LogOut width={14} height={14} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
