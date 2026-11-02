import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Search,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { WorkspaceItem, FabricWorkspaceSummary } from '../types';
import { fetchFabricWorkspaces } from '../services/api';
import { WorkspaceSelectorDropdown } from './workspace/WorkspaceSelectorDropdown';
import { getItemIcon, getBadgeClass } from './workspace/workspaceItemHelpers';

interface WorkspaceExplorerViewProps {
  workspaceName?: string;
  onInspectItem?: (item: WorkspaceItem) => void;
  onDeleteItem?: (item: WorkspaceItem) => void;
}

export const WorkspaceExplorerView: React.FC<WorkspaceExplorerViewProps> = ({
  workspaceName = 'PBT_DATA_AGENT',
  onInspectItem,
  onDeleteItem,
}) => {
  const [workspaces, setWorkspaces] = useState<FabricWorkspaceSummary[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<FabricWorkspaceSummary | null>(null);
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [folders, setFolders] = useState<{ id: string; displayName?: string; name?: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    fetchFabricWorkspaces().then((res) => {
      if (!isMounted) return;
      if (res.workspaces && res.workspaces.length > 0) {
        setWorkspaces(res.workspaces);
        const match =
          res.workspaces.find(
            (w) =>
              w.id === res.activeWorkspaceId ||
              w.displayName.toLowerCase() === (workspaceName || '').toLowerCase()
          ) || res.workspaces[0];
        setSelectedWorkspace(match);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [workspaceName]);

  const loadItems = async (wsId?: string) => {
    const targetId = wsId || selectedWorkspace?.id;
    setLoading(true);
    try {
      const url = targetId
        ? `/api/workspace/items?workspace_id=${encodeURIComponent(targetId)}`
        : '/api/workspace/items';
      const resp = await fetch(url);
      const data = await resp.json();
      if (data && Array.isArray(data.folders)) {
        setFolders(data.folders);
      }
      if (data && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (e) {
      console.error('Failed to load workspace items', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWorkspace?.id) {
      loadItems(selectedWorkspace.id);
    }
  }, [selectedWorkspace?.id]);

  const filtered = items.filter((it) => {
    const query = search.toLowerCase().trim();
    const matchesSearch =
      !query ||
      it.displayName.toLowerCase().includes(query) ||
      it.type.toLowerCase().includes(query) ||
      (it.folderId && it.folderId.toLowerCase().includes(query)) ||
      it.id.toLowerCase().includes(query);

    if (!matchesSearch) return false;
    const typeLower = it.type.toLowerCase();
    if (activeFilter === 'all') return true;
    if (activeFilter === 'Lakehouse') return typeLower === 'lakehouse';
    if (activeFilter === 'Notebook') return typeLower === 'notebook';
    if (activeFilter === 'DataPipeline') return typeLower === 'datapipeline' || typeLower === 'pipeline';
    if (activeFilter === 'DataAgent') return typeLower === 'dataagent';
    return true;
  });

  return (
    <section className="view-panel active" id="viewWorkspace">
      <div className="ws-page-container">
        {/* Top Banner */}
        <div className="ws-header-banner">
          <div className="ws-header-left">
            <div className="ws-header-icon" title="Microsoft Fabric Workspace">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <path d="M16 3L3 10.5V21.5L16 29L29 21.5V10.5L16 3Z" fill="#008272" />
                <path d="M16 3L29 10.5V21.5L16 29V3Z" fill="#00A88F" />
                <path d="M16 3L29 10.5L16 18L3 10.5L16 3Z" fill="#00D2A0" />
              </svg>
            </div>
            <div>
              <div className="ws-title-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <WorkspaceSelectorDropdown
                  workspaces={workspaces}
                  selectedWorkspace={selectedWorkspace}
                  onSelectWorkspace={(ws) => setSelectedWorkspace(ws)}
                  isLoading={loading}
                />
                <span className="ws-status-badge">
                  <span className="status-dot-green" />
                  <span>OneLake Connected</span>
                </span>
                <span className="ws-total-pill">{items.length} Items</span>
              </div>
              <p className="ws-page-sub">
                {selectedWorkspace?.description ||
                  `Direct inventory of Microsoft Fabric items in ${selectedWorkspace?.displayName || workspaceName}`}
              </p>
            </div>
          </div>
          <div className="ws-header-actions">
            <button
              className="ws-btn-sync"
              type="button"
              onClick={() => loadItems()}
              disabled={loading}
              title="Synchronize with live Microsoft Fabric REST API"
            >
              <RefreshCw width={14} height={14} className={loading ? 'animate-spin' : ''} />
              <span>Sync Workspace</span>
            </button>
          </div>
        </div>

        {/* Controls & Filter Bar */}
        <div className="ws-controls-bar">
          <div className="ws-search-box">
            <Search width={14} height={14} />
            <input
              type="text"
              placeholder="Filter by item name, type, ID, or folder..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="ws-filter-pills">
            <button
              className={`filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Items ({items.length})
            </button>
            <button
              className={`filter-pill ${activeFilter === 'Lakehouse' ? 'active' : ''}`}
              onClick={() => setActiveFilter('Lakehouse')}
            >
              Lakehouses
            </button>
            <button
              className={`filter-pill ${activeFilter === 'Notebook' ? 'active' : ''}`}
              onClick={() => setActiveFilter('Notebook')}
            >
              Notebooks
            </button>
            <button
              className={`filter-pill ${activeFilter === 'DataPipeline' ? 'active' : ''}`}
              onClick={() => setActiveFilter('DataPipeline')}
            >
              Pipelines
            </button>
            <button
              className={`filter-pill ${activeFilter === 'DataAgent' ? 'active' : ''}`}
              onClick={() => setActiveFilter('DataAgent')}
            >
              Data Agents
            </button>
          </div>
        </div>

        {/* Table Container with cleaned up columns */}
        <div className="ws-table-container">
          <div className="ws-table-header" style={{ gridTemplateColumns: 'minmax(260px, 2fr) 140px 180px 100px' }}>
            <div className="ws-th ws-col-name">Item Name & ID</div>
            <div className="ws-th ws-col-type">Type</div>
            <div className="ws-th ws-col-location">Folder Location</div>
            <div className="ws-th ws-col-actions" style={{ textAlign: 'right' }}>Actions</div>
          </div>
          <div className="ws-table-body">
            {loading ? (
              <div className="tree-empty-hint">Syncing items from Microsoft Fabric REST API...</div>
            ) : filtered.length === 0 ? (
              <div className="tree-empty-hint">No Fabric items found matching filter.</div>
            ) : (
              filtered.map((item) => {
                const matchedFolder = folders.find((f) => f.id === item.folderId);
                const rawFolder = matchedFolder?.displayName || matchedFolder?.name || item.folderId;
                const folderDisplay = rawFolder
                  ? (rawFolder.toLowerCase().includes('root') ? '📁 Workspace Root' : `📁 ${rawFolder}`)
                  : '📁 Workspace Root';

                return (
                  <div key={item.id} className="ws-table-row" style={{ gridTemplateColumns: 'minmax(260px, 2fr) 140px 180px 100px' }}>
                    <div className="ws-td ws-col-name" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {getItemIcon(item.type)}
                      <div className="ws-name-group" style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span className="ws-item-title" style={{ fontSize: '13.5px', fontWeight: 500, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.displayName}>
                          {item.displayName}
                        </span>
                        <span className="ws-item-subid" style={{ fontSize: '11px', color: '#71717a', fontFamily: 'var(--font-mono)' }}>
                          {item.id}
                        </span>
                      </div>
                    </div>
                    <div className="ws-td ws-col-type">
                      <span className={`ws-type-pill ${getBadgeClass(item.type)}`}>{item.type}</span>
                    </div>
                    <div className="ws-td ws-col-location">
                      <span className="ws-folder-tag">{folderDisplay}</span>
                    </div>
                    <div className="ws-td ws-col-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        className="ws-action-icon-btn"
                        title="Inspect Definition"
                        onClick={() => onInspectItem?.(item)}
                      >
                        <ExternalLink width={14} height={14} />
                      </button>
                      <button
                        className="ws-action-icon-btn delete-btn"
                        title="Safe Delete with Blast-Radius Check"
                        onClick={() => onDeleteItem?.(item)}
                      >
                        <Trash2 width={14} height={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkspaceExplorerView;
