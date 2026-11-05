import React from 'react';
import { PlatformCube } from './PlatformCube';
import {
  PanelLeftOpen,
  Workflow,
  RefreshCw,
  ChevronDown,
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
  viewTitle = 'Workspace',
  isSidebarCollapsed,
  onToggleSidebar,
  isWorkbenchOpen,
  onToggleWorkbench,
  onRefreshWorkspace,
  status,
  onOpenFabricConnection,
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
        {/* Active Fabric Account / Tenant Chip */}
        {onOpenFabricConnection && (
          <button
            type="button"
            className="topbar-account-chip flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#18181b] hover:bg-[#222226] border border-white/10 hover:border-white/20 text-[12px] text-[#cbd5e1] hover:text-white transition-all cursor-pointer mr-1"
            onClick={onOpenFabricConnection}
            title={`Active Fabric Tenant: ${status?.tenantId || 'PELICAN PRODUCTS INC'}. Click to switch account`}
          >
            <PlatformCube platformId="fabric" size={13} />
            <span className="font-medium max-w-[130px] truncate text-[12px] text-[#e4e4e7]">
              {status?.workspaceName || 'PBT_DATA_AGENT'}
            </span>
            <ChevronDown size={11} className="text-[#71717a]" />
          </button>
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
