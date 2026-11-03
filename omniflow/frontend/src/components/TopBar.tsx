import React from 'react';
import { PlatformCube } from './PlatformCube';
import {
  PanelLeftOpen,
  Workflow,
  RefreshCw,
} from 'lucide-react';
import { FabricStatus } from '../types';

interface TopBarProps {
  viewTitle?: string;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isWorkbenchOpen: boolean;
  onToggleWorkbench: () => void;
  onNewSession?: () => void;
  onRefreshWorkspace: () => void;
  status?: FabricStatus | null;
  onOpenFabricConnection?: () => void;
  onOpenVoiceMode?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  viewTitle = 'New Chat',
  isSidebarCollapsed,
  onToggleSidebar,
  isWorkbenchOpen,
  onToggleWorkbench,
  onRefreshWorkspace,
}) => {
  return (
    <header className="studio-topbar">
      <div className="topbar-left">
        {isSidebarCollapsed && (
          <button
            type="button"
            className="topbar-brand-collapsed"
            onClick={onToggleSidebar}
            title="Expand Sidebar"
          >
            <PlatformCube platformId="fabric" size={18} />
          </button>
        )}
        <button
          type="button"
          className="topbar-sidebar-reveal-btn"
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <PanelLeftOpen width={15} height={15} />
        </button>
        <span className="topbar-view-heading">{viewTitle}</span>
      </div>

      <div className="topbar-right">
        {/* Visual Architecture Canvas Toggle Button */}
        <button
          type="button"
          className={`topbar-tool-icon ${isWorkbenchOpen ? 'active' : ''}`}
          onClick={onToggleWorkbench}
          title="Visual Architecture Canvas"
        >
          <Workflow width={16} height={16} />
        </button>

        {/* Sync Workspace Items */}
        <button
          type="button"
          className="topbar-tool-icon"
          onClick={onRefreshWorkspace}
          title="Sync Fabric Items"
        >
          <RefreshCw width={15} height={15} />
        </button>
      </div>
    </header>
  );
};
