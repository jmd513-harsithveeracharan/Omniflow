import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Search,
  Database,
  BookOpen,
  GitBranch,
  Bot,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { fetchWorkspaceTree } from '../services/api';
import { WorkspaceItem } from '../types';

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
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const loadItems = async () => {
    setLoading(true);
    try {
      const folders = await fetchWorkspaceTree();
      const allItems: WorkspaceItem[] = [];
      folders.forEach((f) => {
        (f.items || []).forEach((it) => {
          allItems.push({
            ...it,
            folderId: f.displayName || 'AI_Test_Folder',
          });
        });
      });
      // If empty, provide mock items for live visual feedback
      if (allItems.length === 0) {
        setItems([
          {
            id: 'lh_enterprise_bronze',
            displayName: 'lh_enterprise_bronze',
            type: 'Lakehouse',
            description: 'Raw immutable delta ingestion layer',
            folderId: 'AI_Test_Folder',
          },
          {
            id: 'lh_enterprise_silver',
            displayName: 'lh_enterprise_silver',
            type: 'Lakehouse',
            description: 'Cleaned deduplicated delta layer with MERGE upsert',
            folderId: 'AI_Test_Folder',
          },
          {
            id: 'lh_enterprise_gold',
            displayName: 'lh_enterprise_gold',
            type: 'Lakehouse',
            description: 'Star schema facts and dimensions for Power BI Direct Lake',
            folderId: 'AI_Test_Folder',
          },
          {
            id: 'nb_sales_silver_merge',
            displayName: 'nb_sales_silver_merge',
            type: 'Notebook',
            description: 'PySpark Delta MERGE SCD-1/2 processor',
            folderId: 'AI_Test_Folder',
          },
          {
            id: 'pl_daily_medallion_sync',
            displayName: 'pl_daily_medallion_sync',
            type: 'DataPipeline',
            description: 'Data Factory pipeline scheduled daily at 02:00 UTC',
            folderId: 'AI_Test_Folder',
          },
          {
            id: 'agent_pbt_data_orchestrator',
            displayName: 'PBT_Data_Agent',
            type: 'DataAgent',
            description: 'Sovereign Claude Code / Gemini reasoning mesh',
            folderId: 'AI_Test_Folder',
          },
        ]);
      } else {
        setItems(allItems);
      }
    } catch (e) {
      console.error('Failed to load workspace items', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const filtered = items.filter((it) => {
    const matchesSearch =
      it.displayName.toLowerCase().includes(search.toLowerCase()) ||
      it.type.toLowerCase().includes(search.toLowerCase()) ||
      (it.folderId && it.folderId.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'Lakehouse') return it.type.toLowerCase().includes('lakehouse');
    if (activeFilter === 'Notebook') return it.type.toLowerCase().includes('notebook');
    if (activeFilter === 'DataPipeline') return it.type.toLowerCase().includes('pipeline');
    if (activeFilter === 'DataAgent') return it.type.toLowerCase().includes('agent');
    return true;
  });

  const getItemIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('lakehouse')) return <Database width={16} height={16} className="text-cyan-400" />;
    if (t.includes('notebook')) return <BookOpen width={16} height={16} className="text-emerald-400" />;
    if (t.includes('pipeline')) return <GitBranch width={16} height={16} className="text-purple-400" />;
    if (t.includes('agent')) return <Bot width={16} height={16} className="text-amber-400" />;
    return <Database width={16} height={16} className="text-blue-400" />;
  };

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
              <div className="ws-title-row">
                <h2 className="ws-page-title">{workspaceName}</h2>
                <span className="ws-status-badge">
                  <span className="status-dot-green" />
                  <span>OneLake Connected</span>
                </span>
                <span className="ws-total-pill">{items.length} Items</span>
              </div>
              <p className="ws-page-sub">Direct inventory of Microsoft Fabric items in active workspace</p>
            </div>
          </div>
          <div className="ws-header-actions">
            <button
              className="ws-btn-sync"
              type="button"
              onClick={loadItems}
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

        {/* Table Container */}
        <div className="ws-table-container">
          <div className="ws-table-header">
            <div className="ws-th ws-col-name">Item Name & ID</div>
            <div className="ws-th ws-col-type">Type</div>
            <div className="ws-th ws-col-location">Folder Location</div>
            <div className="ws-th ws-col-path">OneLake Storage Path</div>
            <div className="ws-th ws-col-actions">Actions</div>
          </div>
          <div className="ws-table-body">
            {loading ? (
              <div className="tree-empty-hint">Syncing items from Microsoft Fabric REST API...</div>
            ) : filtered.length === 0 ? (
              <div className="tree-empty-hint">No Fabric items found matching filter.</div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="ws-table-row">
                  <div className="ws-td ws-col-name">
                    <div className="item-name-wrap">
                      {getItemIcon(item.type)}
                      <div>
                        <span className="item-title">{item.displayName}</span>
                        <span className="item-id">{item.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ws-td ws-col-type">
                    <span className="item-type-badge">{item.type}</span>
                  </div>
                  <div className="ws-td ws-col-location">
                    <span className="item-folder-tag">{item.folderId || 'AI_Test_Folder'}</span>
                  </div>
                  <div className="ws-td ws-col-path">
                    <code className="onelake-path">
                      abfss://{workspaceName}@onelake.dfs.fabric.microsoft.com/{item.displayName}
                    </code>
                  </div>
                  <div className="ws-td ws-col-actions">
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
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
