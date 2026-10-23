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
}

export const TopBar: React.FC<TopBarProps> = ({
  viewTitle = 'Playground',
  isSidebarCollapsed,
  onToggleSidebar,
  isWorkbenchOpen,
  onToggleWorkbench,
  onRefreshWorkspace,
  status,
  onOpenFabricConnection,
}) => {
  const wsDisplayName =
    status?.workspaceName ||
    (status as Record<string, unknown> | undefined)?.['workspace_name'] ||
    (status?.workspaceId ? 'PBT_DATA_AGENT' : 'Workspace');

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
        {status?.authenticated && (
          <div
            onClick={onOpenFabricConnection}
            style={{ cursor: 'pointer' }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1e1f20] border border-[#2d2e31] text-[11px] font-mono text-[#10b981] mr-2 hover:border-[#10b981]/50 transition-all"
            title="Manage Microsoft Fabric Connection"
          >
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>Fabric: {String(wsDisplayName)}</span>
          </div>
        )}

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
